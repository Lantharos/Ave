import { z } from "zod";
import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import {
  appAnalyticsEvents,
  db,
  identities,
  oauthAuthorizations,
  oauthDelegationAuditLogs,
  oauthDelegationGrants,
  oauthRefreshTokens,
  oauthResources,
} from "../../db";

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const activityPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
  cursor: z.string().max(512).optional(),
});

type AppActivityRow = {
  id: string;
  action: string;
  details: string | Record<string, unknown> | null;
  severity: string;
  createdAt: number | string | Date;
  source: "activity" | "delegation";
};

type AppActivityCursor = {
  createdAt: number;
  source: AppActivityRow["source"];
  id: string;
};

function encodeActivityCursor(cursor: AppActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeActivityCursor(value: string | undefined): AppActivityCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AppActivityCursor>;
    if (
      !Number.isSafeInteger(parsed.createdAt)
      || (parsed.source !== "activity" && parsed.source !== "delegation")
      || typeof parsed.id !== "string"
      || !parsed.id
    ) {
      return null;
    }
    return parsed as AppActivityCursor;
  } catch {
    return null;
  }
}

function parseActivityDetails(details: AppActivityRow["details"]): Record<string, unknown> | null {
  if (!details) return null;
  if (typeof details === "object") return details;
  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toDate(value: number | string | Date): Date {
  if (value instanceof Date) return value;
  const normalized = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return new Date(normalized);
}

export async function getAppInsights(appId: string, redirectUris: string[]) {
  const now = Date.now();
  const nowDate = new Date(now);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const [authorizationGroups, weeklyAuthorizations, refreshTokens, analyticsCount, delegationAuditCount, revocations, delegations, resources] = await Promise.all([
    db
      .select({
        lastAuthMethod: oauthAuthorizations.lastAuthMethod,
        identityCount: sql<number>`count(*)`,
        authorizationCount: sql<number>`sum(${oauthAuthorizations.authorizationCount})`,
      })
      .from(oauthAuthorizations)
      .where(eq(oauthAuthorizations.appId, appId))
      .groupBy(oauthAuthorizations.lastAuthMethod),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthAuthorizations)
      .where(and(eq(oauthAuthorizations.appId, appId), gte(oauthAuthorizations.lastAuthorizedAt, weekAgo))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthRefreshTokens)
      .where(and(eq(oauthRefreshTokens.appId, appId), isNull(oauthRefreshTokens.revokedAt), gt(oauthRefreshTokens.expiresAt, nowDate))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appAnalyticsEvents)
      .where(eq(appAnalyticsEvents.appId, appId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthDelegationAuditLogs)
      .where(eq(oauthDelegationAuditLogs.sourceAppId, appId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appAnalyticsEvents)
      .where(and(eq(appAnalyticsEvents.appId, appId), eq(appAnalyticsEvents.eventType, "authorization_revoked"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthDelegationGrants)
      .where(and(eq(oauthDelegationGrants.sourceAppId, appId), isNull(oauthDelegationGrants.revokedAt))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthResources)
      .where(eq(oauthResources.ownerAppId, appId)),
  ]);

  const methodCounts = {
    passkey: 0,
    deviceApproval: 0,
    trustCode: 0,
    unknown: 0,
  };

  for (const authorization of authorizationGroups) {
    const count = Number(authorization.identityCount || 0);
    const method = authorization.lastAuthMethod;
    if (method === "passkey") methodCounts.passkey += count;
    else if (method === "instant") methodCounts.deviceApproval += count;
    else if (method === "fallback" || method === "trust_code" || method === "device_approval") methodCounts.trustCode += count;
    else methodCounts.unknown += count;
  }

  const totalMethodEvents = methodCounts.passkey + methodCounts.deviceApproval + methodCounts.trustCode + methodCounts.unknown;
  const instantRate = totalMethodEvents
    ? Math.round(((methodCounts.passkey + methodCounts.deviceApproval) / totalMethodEvents) * 100)
    : 0;

  const httpsRedirects = redirectUris.filter((uri) => uri.startsWith("https://")).length;

  return {
    totalIdentities: authorizationGroups.reduce((total, entry) => total + Number(entry.identityCount || 0), 0),
    totalAuthorizations: authorizationGroups.reduce((total, entry) => total + Number(entry.authorizationCount || 0), 0),
    weeklyAuthorizations: Number(weeklyAuthorizations[0]?.count || 0),
    activeRefreshTokens: Number(refreshTokens[0]?.count || 0),
    instantSignInRate: instantRate,
    methodCounts,
    redirectSecurityRate: redirectUris.length ? Math.round((httpsRedirects / redirectUris.length) * 100) : 0,
    resources: Number(resources[0]?.count || 0),
    activeDelegations: Number(delegations[0]?.count || 0),
    revocations: Number(revocations[0]?.count || 0),
    totalActivityEvents: Number(analyticsCount[0]?.count || 0) + Number(delegationAuditCount[0]?.count || 0),
  };
}

export async function getAppIdentities(appId: string, limit = 25, offset = 0) {
  const refreshCount = sql<number>`count(${oauthRefreshTokens.id})`;
  const lastRefreshAt = sql<number | null>`max(${oauthRefreshTokens.createdAt})`;
  const lastActiveAt = sql<number>`max(
    coalesce(${oauthRefreshTokens.createdAt}, 0),
    ${oauthAuthorizations.lastAuthorizedAt}
  )`;

  const [totalRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthAuthorizations)
      .where(eq(oauthAuthorizations.appId, appId)),
    db
      .select({
        id: identities.id,
        displayName: identities.displayName,
        handle: identities.handle,
        email: identities.email,
        avatarUrl: identities.avatarUrl,
        isPrimary: identities.isPrimary,
        identityCreatedAt: identities.createdAt,
        firstSeen: oauthAuthorizations.createdAt,
        lastAuthorizedAt: oauthAuthorizations.lastAuthorizedAt,
        authorizationCount: oauthAuthorizations.authorizationCount,
        lastMethod: oauthAuthorizations.lastAuthMethod,
        refreshCount,
        lastRefreshAt,
      })
      .from(oauthAuthorizations)
      .innerJoin(identities, eq(identities.id, oauthAuthorizations.identityId))
      .leftJoin(
        oauthRefreshTokens,
        and(
          eq(oauthRefreshTokens.appId, oauthAuthorizations.appId),
          eq(oauthRefreshTokens.identityId, oauthAuthorizations.identityId),
        ),
      )
      .where(eq(oauthAuthorizations.appId, appId))
      .groupBy(oauthAuthorizations.id, identities.id)
      .orderBy(desc(lastActiveAt), desc(oauthAuthorizations.id))
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(totalRow[0]?.count || 0);
  const items = rows.map((row) => {
    const authorizationCount = Number(row.authorizationCount || 0);
    const refreshCountValue = Number(row.refreshCount || 0);
    const lastRefresh = row.lastRefreshAt ? toDate(row.lastRefreshAt) : null;
    return {
      id: row.id,
      displayName: row.displayName,
      handle: row.handle,
      email: row.email,
      avatarUrl: row.avatarUrl,
      isPrimary: row.isPrimary,
      firstSeen: row.firstSeen || row.identityCreatedAt,
      lastActive: lastRefresh || row.lastAuthorizedAt || row.identityCreatedAt,
      signInCount: authorizationCount + refreshCountValue,
      authorizationCount,
      refreshCount: refreshCountValue,
      lastMethod: row.lastMethod,
    };
  });

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

export async function getAppActivity(appId: string, limit = 25, cursor?: AppActivityCursor) {
  const d1 = (db as unknown as { $client?: D1Database }).$client;
  if (!d1) {
    throw new Error("D1 client unavailable for activity query");
  }

  const cursorPredicate = cursor
    ? `AND (
        created_at < ?
        OR (created_at = ? AND (? < ? OR (? = ? AND id < ?)))
      )`
    : "";
  const query = `SELECT id, action, details, severity, createdAt, source FROM (
      SELECT id, event_type AS action, metadata AS details, severity, created_at AS createdAt, 'activity' AS source, 0 AS sourceRank
      FROM app_analytics_events
      WHERE app_id = ? ${cursorPredicate}
      UNION ALL
      SELECT id, event_type AS action, details, 'info' AS severity, created_at AS createdAt, 'delegation' AS source, 1 AS sourceRank
      FROM oauth_delegation_audit_logs
      WHERE source_app_id = ? ${cursorPredicate}
    )
    ORDER BY createdAt DESC, sourceRank DESC, id DESC
    LIMIT ?`;

  const cursorBindings = (sourceRank: 0 | 1) => cursor
    ? [cursor.createdAt, cursor.createdAt, sourceRank, cursor.source === "delegation" ? 1 : 0, sourceRank, cursor.source === "delegation" ? 1 : 0, cursor.id]
    : [];
  const activityResult = await d1
    .prepare(query)
    .bind(appId, ...cursorBindings(0), appId, ...cursorBindings(1), limit + 1)
    .all<AppActivityRow>();

  const rows = activityResult.results || [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map((row) => ({
    id: row.id,
    action: row.action,
    details: parseActivityDetails(row.details),
    severity: row.severity,
    createdAt: toDate(row.createdAt),
    source: row.source,
  }));

  const lastRow = pageRows.at(-1);

  return {
    items,
    nextCursor: hasMore && lastRow
      ? encodeActivityCursor({
          createdAt: toDate(lastRow.createdAt).getTime(),
          source: lastRow.source,
          id: lastRow.id,
        })
      : null,
    hasMore,
  };
}
