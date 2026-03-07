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

let durableStorage: DurableObjectStorage | null = null;
const memoryFallback = new Map<string, StoredOAuthRecord<unknown>>();

function key(namespace: "auth-code" | "access-token", id: string): string {
  return `oauth:${namespace}:${id}`;
}

export function initOAuthStorage(storage: DurableObjectStorage): void {
  durableStorage = storage;
}

async function setRecord<T>(
  namespace: "auth-code" | "access-token",
  id: string,
  value: T,
  expiresAt: number,
): Promise<void> {
  const record: StoredOAuthRecord<T> = { value, expiresAt };
  const storageKey = key(namespace, id);
  if (durableStorage) {
    await durableStorage.put(storageKey, record);
    return;
  }
  memoryFallback.set(storageKey, record as StoredOAuthRecord<unknown>);
}

async function getRecord<T>(
  namespace: "auth-code" | "access-token",
  id: string,
): Promise<StoredOAuthRecord<T> | null> {
  const storageKey = key(namespace, id);
  if (durableStorage) {
    return (await durableStorage.get<StoredOAuthRecord<T>>(storageKey)) ?? null;
  }
  return (memoryFallback.get(storageKey) as StoredOAuthRecord<T> | undefined) ?? null;
}

async function deleteRecord(namespace: "auth-code" | "access-token", id: string): Promise<void> {
  const storageKey = key(namespace, id);
  if (durableStorage) {
    await durableStorage.delete(storageKey);
    return;
  }
  memoryFallback.delete(storageKey);
}

export async function setAuthorizationCode(id: string, value: AuthorizationCodeRecord): Promise<void> {
  await setRecord("auth-code", id, value, value.expiresAt);
}

export async function getAuthorizationCode(id: string): Promise<AuthorizationCodeRecord | null> {
  const record = await getRecord<AuthorizationCodeRecord>("auth-code", id);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    await deleteAuthorizationCode(id);
    return null;
  }
  return record.value;
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
