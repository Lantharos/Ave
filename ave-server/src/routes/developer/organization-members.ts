import { recordActivityLog } from "../../lib/platform/background-events";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, identities, developerMembers } from "../../db";
import { requireOrganizationAccess } from "../../lib/developer/dev-portal";

const app = new Hono();

app.post("/:organizationId/members", zValidator("json", z.object({
  email: z.string().email(),
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const email = c.req.valid("json").email.trim().toLowerCase();

  const membership = await requireOrganizationAccess(user, organizationId);
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const [targetIdentity] = await db
    .select()
    .from(identities)
    .where(eq(identities.email, email))
    .limit(1);

  if (!targetIdentity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [created] = await db
    .insert(developerMembers)
    .values({ organizationId, identityId: targetIdentity.id })
    .onConflictDoNothing({ target: [developerMembers.organizationId, developerMembers.identityId] })
    .returning();

  if (!created) {
    return c.json({ error: "Member already exists" }, 409);
  }

  recordActivityLog(c, {
    userId: user.id,
    action: "workspace.member.added",
    details: { organizationId, email },
    deviceId: user.deviceId,
    ipAddress: c.req.header("cf-connecting-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({
    member: {
      id: created.id,
      userId: targetIdentity.userId,
      name: targetIdentity.displayName || targetIdentity.handle,
      email: targetIdentity.email,
      avatarUrl: targetIdentity.avatarUrl,
      joinedAt: created.createdAt,
    },
  }, 201);
});

app.delete("/:organizationId/members/:memberId", async (c) => {
  const user = c.get("user")!;
  const { organizationId, memberId } = c.req.param();

  const membership = await requireOrganizationAccess(user, organizationId);
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const [removed] = await db
    .delete(developerMembers)
    .where(and(
      eq(developerMembers.id, memberId),
      eq(developerMembers.organizationId, organizationId),
      sql`(select count(*) from ${developerMembers} where ${developerMembers.organizationId} = ${organizationId}) > 1`,
    ))
    .returning();

  if (!removed) {
    return c.json({ error: "Member not found, or they are the last member of this team" }, 400);
  }

  recordActivityLog(c, {
    userId: user.id,
    action: "workspace.member.removed",
    details: { organizationId, memberId },
    deviceId: user.deviceId,
    ipAddress: c.req.header("cf-connecting-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ success: true });
});

export default app;
