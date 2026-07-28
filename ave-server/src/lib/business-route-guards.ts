import type { Context } from "hono";
import {
  buildAuditPayload,
  requireBusinessAccess,
  shouldRequireEnterpriseSsoForBusinessAccess,
  verifySignedBusinessAction,
} from "./business";
import { getRequiredEnterpriseSsoForOrganization } from "./enterprise-sso-policy";

export async function requireSignedAction(
  c: Context,
  actorIdentityId: string,
  action: string,
  details: Record<string, unknown>,
  signature?: string,
) {
  if (!signature) return c.json({ error: "Action signature required" }, 400);
  const result = await verifySignedBusinessAction({
    actorIdentityId,
    payload: buildAuditPayload(action, details),
    signature,
  });
  if (result.status === "verified") return null;
  if (result.status === "missing_key") return c.json({ error: "Acting identity needs a signing key" }, 400);
  return c.json({ error: "Invalid action signature" }, 400);
}

export function rejectWithoutSigningAuthority(c: Context, member: { signingAuthority: boolean }) {
  if (member.signingAuthority) return null;
  return c.json({ error: "Signing authority required" }, 403);
}

export async function rejectWithoutRequiredSso(
  c: Context,
  access: NonNullable<Awaited<ReturnType<typeof requireBusinessAccess>>>,
) {
  const user = c.get("user")!;
  if (!shouldRequireEnterpriseSsoForBusinessAccess(user, access)) return null;
  const policy = await getRequiredEnterpriseSsoForOrganization(access.organization);
  return c.json({
    error: "enterprise_sso_required",
    loginUrl: policy?.loginUrl,
    organization: { id: access.organization.id, name: access.organization.name },
  }, 403);
}
