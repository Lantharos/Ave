import { eq } from "drizzle-orm";
import { db, identities, identityEncryptionKeys, type Identity } from "../db";
import { parseOAuthScopes } from "./oauth-scopes";

export type SerializedIdentity = {
  id: string;
  displayName: string;
  handle: string;
  email?: string;
  pendingEmail?: string | null;
  birthday?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  isPrimary: boolean;
  createdAt: Date;
  hasEncryptionKey?: boolean;
};

export function serializeIdentityForOwner(identity: Identity, hasEncryptionKey?: boolean): SerializedIdentity {
  return {
    id: identity.id,
    displayName: identity.displayName,
    handle: identity.handle,
    email: identity.email || undefined,
    pendingEmail: identity.pendingEmail,
    birthday: identity.birthday,
    avatarUrl: identity.avatarUrl,
    bannerUrl: identity.bannerUrl,
    isPrimary: identity.isPrimary,
    createdAt: identity.createdAt,
    ...(hasEncryptionKey === undefined ? {} : { hasEncryptionKey }),
  };
}

export async function listIdentitiesForOwner(userId: string): Promise<SerializedIdentity[]> {
  const rows = await db
    .select({ identity: identities, encryptionKeyId: identityEncryptionKeys.id })
    .from(identities)
    .leftJoin(identityEncryptionKeys, eq(identityEncryptionKeys.identityId, identities.id))
    .where(eq(identities.userId, userId));

  return rows.map(({ identity, encryptionKeyId }) =>
    serializeIdentityForOwner(identity, encryptionKeyId !== null)
  );
}

export function identityClaimsForApp(identity: Identity, scope: string) {
  const scopes = new Set(parseOAuthScopes(scope));
  return {
    sub: identity.id,
    ...(scopes.has("profile") ? {
      name: identity.displayName,
      preferred_username: identity.handle,
      picture: identity.avatarUrl,
    } : {}),
    ...(scopes.has("email") ? { email: identity.email || undefined } : {}),
  };
}

export function serializeIdentityForApp(identity: Identity, scope: string) {
  const claims = identityClaimsForApp(identity, scope);
  return {
    id: claims.sub,
    displayName: claims.name,
    handle: claims.preferred_username,
    avatarUrl: claims.picture,
    email: claims.email,
  };
}

export function hasVerifiedEmail(identity: Pick<Identity, "email">): boolean {
  return Boolean(identity.email);
}
