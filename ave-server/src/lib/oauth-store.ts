import { AsyncLocalStorage } from "node:async_hooks";

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
  codeChallenge?: string;
  codeChallengeMethod?: string;
  encryptedAppKey?: string;
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
  nonce?: string;
};

/**
 * Mirror the request-scoped DB pattern so OAuth storage is bound to the
 * current Durable Object request rather than shared at module scope.
 */
const oauthStorage = new AsyncLocalStorage<DurableObjectStorage>();

function key(namespace: "auth-code" | "access-token", id: string): string {
  return `oauth:${namespace}:${id}`;
}

function getStorage(): DurableObjectStorage {
  const storage = oauthStorage.getStore();
  if (!storage) {
    throw new Error("OAuth storage not initialized. This function must be called within runWithOAuthStorage().");
  }
  return storage;
}

export async function runWithOAuthStorage<T>(
  storage: DurableObjectStorage,
  callback: () => Promise<T>,
): Promise<T> {
  return oauthStorage.run(storage, callback);
}

async function setRecord<T>(
  namespace: "auth-code" | "access-token",
  id: string,
  value: T,
  expiresAt: number,
): Promise<void> {
  await getStorage().put(
    key(namespace, id),
    {
      value,
      expiresAt,
    } satisfies StoredOAuthRecord<T>,
    {
      expiration: Math.floor(expiresAt / 1000),
    },
  );
}

async function getRecord<T>(
  namespace: "auth-code" | "access-token",
  id: string,
): Promise<StoredOAuthRecord<T> | null> {
  return (await getStorage().get<StoredOAuthRecord<T>>(key(namespace, id))) ?? null;
}

async function deleteRecord(namespace: "auth-code" | "access-token", id: string): Promise<void> {
  await getStorage().delete(key(namespace, id));
}

async function takeRecord<T>(
  namespace: "auth-code" | "access-token",
  id: string,
): Promise<StoredOAuthRecord<T> | null> {
  const storageKey = key(namespace, id);
  return getStorage().transaction(async (txn) => {
    const record = (await txn.get<StoredOAuthRecord<T>>(storageKey)) ?? null;
    if (!record) {
      return null;
    }

    await txn.delete(storageKey);
    return record;
  });
}

export async function setAuthorizationCode(id: string, value: AuthorizationCodeRecord): Promise<void> {
  await setRecord("auth-code", id, value, value.expiresAt);
}

export async function getAuthorizationCode(id: string): Promise<{
  value: AuthorizationCodeRecord | null;
  expired: boolean;
}> {
  const record = await getRecord<AuthorizationCodeRecord>("auth-code", id);
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
  const record = await takeRecord<AuthorizationCodeRecord>("auth-code", id);
  if (!record) {
    return { value: null, expired: false };
  }
  if (Date.now() > record.expiresAt) {
    return { value: null, expired: true };
  }
  return { value: record.value, expired: false };
}

export async function deleteAuthorizationCode(id: string): Promise<void> {
  await deleteRecord("auth-code", id);
}

export async function setAccessToken(id: string, value: AccessTokenRecord): Promise<void> {
  await setRecord("access-token", id, value, value.expiresAt);
}

export async function getAccessToken(id: string): Promise<AccessTokenRecord | null> {
  const record = await getRecord<AccessTokenRecord>("access-token", id);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    await deleteAccessToken(id);
    return null;
  }
  return record.value;
}

export async function deleteAccessToken(id: string): Promise<void> {
  await deleteRecord("access-token", id);
}
