import { eq } from "drizzle-orm";
import { db, identities, identityEncryptionKeys, type Identity } from "../db";

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

export function serializeIdentityForApp(identity: Identity) {
  return {
    id: identity.id,
    displayName: identity.displayName,
    handle: identity.handle,
    email: identity.email || undefined,
    avatarUrl: identity.avatarUrl,
    isPrimary: identity.isPrimary,
  };
}

export function hasVerifiedEmail(identity: Pick<Identity, "email">): boolean {
  return Boolean(identity.email);
}
