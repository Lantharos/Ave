import { eq, lt } from "drizzle-orm";
import { db, oauthAccessTokens, oauthAuthorizationCodes } from "../db";

type StoredOAuthRecord<T> = {
  value: T;
  expiresAt: number;
};

export type AuthorizationCodeRecord = {
  userId: string;
  appId: string;
  identityId: string;
  redirectUri: string;
  scope: string;
  expiresAt: number;
  organizationId?: string;
  organizationName?: string;
  organizationMemberId?: string;
  organizationRole?: string;
  organizationScopes?: string[];
  organizationSigningAuthority?: boolean;
  organizationEncryptionMode?: string;
  organizationKeyCustody?: string;
  organizationAuthMethod?: string;
  organizationSsoConnectionId?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  encryptedAppKey?: string;
  appPublicKey?: string;
  encryptedAppPrivateKey?: string;
  appEncryptionMode?: string;
  nonce?: string;
  requestedResource?: string;
  requestedScope?: string;
  communicationMode?: "user_present" | "background";
  delegationGrantId?: string;
};

export type AccessTokenRecord = {
  userId: string;
  identityId: string;
  appId: string;
  scope: string;
  expiresAt: number;
  redirectUri: string;
  organizationId?: string;
  organizationName?: string;
  organizationMemberId?: string;
  organizationRole?: string;
  organizationScopes?: string[];
  organizationSigningAuthority?: boolean;
  organizationEncryptionMode?: string;
  organizationKeyCustody?: string;
  organizationAuthMethod?: string;
  organizationSsoConnectionId?: string;
  nonce?: string;
};

export async function setAuthorizationCode(id: string, value: AuthorizationCodeRecord): Promise<void> {
  await db.insert(oauthAuthorizationCodes)
    .values({
      id,
      value: value as unknown as Record<string, unknown>,
      expiresAt: new Date(value.expiresAt),
    })
    .onConflictDoUpdate({
      target: oauthAuthorizationCodes.id,
      set: {
        value: value as unknown as Record<string, unknown>,
        expiresAt: new Date(value.expiresAt),
      },
    });
}

export async function getAuthorizationCode(id: string): Promise<{
  value: AuthorizationCodeRecord | null;
  expired: boolean;
}> {
  const [row] = await db
    .select()
    .from(oauthAuthorizationCodes)
    .where(eq(oauthAuthorizationCodes.id, id))
    .limit(1);
  const record = row
    ? {
        value: row.value as unknown as AuthorizationCodeRecord,
        expiresAt: new Date(row.expiresAt).getTime(),
      } satisfies StoredOAuthRecord<AuthorizationCodeRecord>
    : null;
  if (!record) {
    return { value: null, expired: false };
  }
  if (Date.now() > record.expiresAt) {
    await deleteAuthorizationCode(id);
    return { value: null, expired: true };
  }
  return { value: record.value, expired: false };
}

export async function consumeAuthorizationCode(id: string): Promise<{
  value: AuthorizationCodeRecord | null;
  expired: boolean;
}> {
  const [row] = await db
    .delete(oauthAuthorizationCodes)
    .where(eq(oauthAuthorizationCodes.id, id))
    .returning();
  const record = row
    ? {
        value: row.value as unknown as AuthorizationCodeRecord,
        expiresAt: new Date(row.expiresAt).getTime(),
      } satisfies StoredOAuthRecord<AuthorizationCodeRecord>
    : null;
  if (!record) {
    return { value: null, expired: false };
  }
  if (Date.now() > record.expiresAt) {
    return { value: null, expired: true };
  }
  return { value: record.value, expired: false };
}

export async function deleteAuthorizationCode(id: string): Promise<void> {
  await db.delete(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.id, id));
}

export async function setAccessToken(id: string, value: AccessTokenRecord): Promise<void> {
  await db.insert(oauthAccessTokens)
    .values({
      id,
      value: value as unknown as Record<string, unknown>,
      expiresAt: new Date(value.expiresAt),
    })
    .onConflictDoUpdate({
      target: oauthAccessTokens.id,
      set: {
        value: value as unknown as Record<string, unknown>,
        expiresAt: new Date(value.expiresAt),
      },
    });
}

export async function getAccessToken(id: string): Promise<AccessTokenRecord | null> {
  const [row] = await db
    .select()
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.id, id))
    .limit(1);
  const record = row
    ? {
        value: row.value as unknown as AccessTokenRecord,
        expiresAt: new Date(row.expiresAt).getTime(),
      } satisfies StoredOAuthRecord<AccessTokenRecord>
    : null;
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    await deleteAccessToken(id);
    return null;
  }
  return record.value;
}

export async function deleteAccessToken(id: string): Promise<void> {
  await db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.id, id));
}

export async function cleanupExpiredOAuthStorage(): Promise<{ expiredOAuthRecordsRemoved: number | null }> {
  const now = new Date();
  await Promise.all([
    db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, now)),
    db.delete(oauthAccessTokens).where(lt(oauthAccessTokens.expiresAt, now)),
  ]);
  return { expiredOAuthRecordsRemoved: null };
}
