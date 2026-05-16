import { eq, lt } from "drizzle-orm";
import { db, ephemeralChallenges } from "../db";

type StoredChallenge<T> = {
  value: T;
  expiresAt: number;
};

function key(namespace: string, id: string): string {
  return `challenge:${namespace}:${id}`;
}

export async function setChallenge<T>(
  namespace: string,
  id: string,
  value: T,
  ttlMs: number
): Promise<void> {
  const record: StoredChallenge<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  const storageKey = key(namespace, id);
  await db.insert(ephemeralChallenges)
    .values({
      id: storageKey,
      namespace,
      challengeKey: id,
      value,
      expiresAt: new Date(record.expiresAt),
    })
    .onConflictDoUpdate({
      target: ephemeralChallenges.id,
      set: {
        value,
        expiresAt: new Date(record.expiresAt),
      },
    });
}

export async function getChallenge<T>(namespace: string, id: string): Promise<T | null> {
  const storageKey = key(namespace, id);
  const [row] = await db
    .select({
      value: ephemeralChallenges.value,
      expiresAt: ephemeralChallenges.expiresAt,
    })
    .from(ephemeralChallenges)
    .where(eq(ephemeralChallenges.id, storageKey))
    .limit(1);

  const record = row
    ? {
        value: row.value,
        expiresAt: new Date(row.expiresAt).getTime(),
      } as StoredChallenge<T>
    : null;

  if (!record) return null;

  if (Date.now() > record.expiresAt) {
    await deleteChallenge(namespace, id);
    return null;
  }

  return record.value;
}

export async function deleteChallenge(namespace: string, id: string): Promise<void> {
  const storageKey = key(namespace, id);
  await db.delete(ephemeralChallenges).where(eq(ephemeralChallenges.id, storageKey));
}

export async function cleanupExpiredChallenges(): Promise<{ expiredChallengesRemoved: number | null }> {
  await db.delete(ephemeralChallenges).where(lt(ephemeralChallenges.expiresAt, new Date()));
  return { expiredChallengesRemoved: null };
}
