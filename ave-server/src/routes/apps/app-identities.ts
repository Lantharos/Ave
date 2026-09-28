import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, identities, oauthAuthorizations, oauthRefreshTokens } from "../../db";

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

function toDate(value: number | string | Date): Date {
  if (value instanceof Date) return value;
  const normalized = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return new Date(normalized);
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
