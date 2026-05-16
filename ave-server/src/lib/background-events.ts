import type { Context } from "hono";
import {
  activityLogs,
  appAnalyticsEvents,
  db,
  oauthDelegationAuditLogs,
  type NewActivityLog,
} from "../db";
import { writeBusinessAuditEvent } from "./business";
import { runInBackground } from "./background";

type AppAnalyticsEventInsert = typeof appAnalyticsEvents.$inferInsert;
type OAuthDelegationAuditLogInsert = typeof oauthDelegationAuditLogs.$inferInsert;
type BusinessAuditInput = Parameters<typeof writeBusinessAuditEvent>[0];

export type BackgroundEvent =
  | { type: "activity_log"; values: NewActivityLog }
  | { type: "app_analytics_event"; values: AppAnalyticsEventInsert }
  | { type: "oauth_delegation_audit_log"; values: OAuthDelegationAuditLogInsert }
  | { type: "business_audit_event"; values: BusinessAuditInput };

type BackgroundEventEnv = {
  BACKGROUND_EVENTS?: Queue<BackgroundEvent>;
};

function getQueue(c: Context): Queue<BackgroundEvent> | null {
  return ((c.env as BackgroundEventEnv | undefined)?.BACKGROUND_EVENTS) ?? null;
}

function enqueueOrFallback(c: Context, event: BackgroundEvent, fallback: () => Promise<unknown>, label: string): void {
  const queue = getQueue(c);
  const work = queue
    ? queue.send(event).catch(async (error) => {
        console.error(`${label} queue send failed:`, error);
        await fallback();
      })
    : fallback();

  runInBackground(c, work, label);
}

export function recordActivityLog(c: Context, values: NewActivityLog): void {
  enqueueOrFallback(
    c,
    { type: "activity_log", values },
    () => db.insert(activityLogs).values(values),
    "Activity log",
  );
}

export function recordAppAnalyticsEvent(c: Context, values: AppAnalyticsEventInsert): void {
  enqueueOrFallback(
    c,
    { type: "app_analytics_event", values },
    () => db.insert(appAnalyticsEvents).values(values),
    "App analytics event",
  );
}

export function recordOAuthDelegationAuditLog(c: Context, values: OAuthDelegationAuditLogInsert): void {
  enqueueOrFallback(
    c,
    { type: "oauth_delegation_audit_log", values },
    () => db.insert(oauthDelegationAuditLogs).values(values),
    "OAuth delegation audit log",
  );
}

export function recordBusinessAuditEvent(c: Context, values: BusinessAuditInput): void {
  enqueueOrFallback(
    c,
    { type: "business_audit_event", values },
    () => writeBusinessAuditEvent(values),
    "Business audit event",
  );
}

export async function processBackgroundEvent(event: BackgroundEvent): Promise<void> {
  switch (event.type) {
    case "activity_log":
      await db.insert(activityLogs).values(event.values);
      return;
    case "app_analytics_event":
      await db.insert(appAnalyticsEvents).values(event.values);
      return;
    case "oauth_delegation_audit_log":
      await db.insert(oauthDelegationAuditLogs).values(event.values);
      return;
    case "business_audit_event":
      await writeBusinessAuditEvent(event.values);
      return;
  }
}

export async function processBackgroundEventBatch(batch: MessageBatch<BackgroundEvent>): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processBackgroundEvent(message.body);
      message.ack();
    } catch (error) {
      console.error("Background event failed:", error);
      message.retry({ delaySeconds: 60 });
    }
  }
}
