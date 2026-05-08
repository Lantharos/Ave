import { Context } from "hono";
import { createHash } from "node:crypto";

type StoredRateLimit = {
  count: number;
  resetAt: number;
};

type RateLimitRule = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  resetAt: number;
};

let durableStorage: DurableObjectStorage | null = null;
const memoryFallback = new Map<string, StoredRateLimit>();

export function initRateLimitStorage(storage: DurableObjectStorage): void {
  durableStorage = storage;
}

export function getClientIp(c: Context): string {
  const forwardedFor = c.req.header("cf-connecting-ip")
    || c.req.header("x-real-ip")
    || c.req.header("x-forwarded-for")?.split(",")[0]?.trim();

  return forwardedFor || "unknown";
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function storageKey(rule: RateLimitRule): string {
  return `rate:${rule.namespace}:${hashKey(rule.key)}`;
}

async function checkRule(rule: RateLimitRule): Promise<RateLimitResult> {
  const key = storageKey(rule);
  const now = Date.now();

  const update = async (current: StoredRateLimit | undefined) => {
    const active = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + rule.windowMs };

    const next = {
      count: active.count + 1,
      resetAt: active.resetAt,
    };

    const retryAfterSeconds = Math.max(1, Math.ceil((next.resetAt - now) / 1000));
    return {
      next,
      result: {
        allowed: next.count <= rule.limit,
        retryAfterSeconds,
        resetAt: next.resetAt,
      },
    };
  };

  if (durableStorage) {
    return durableStorage.transaction(async (txn) => {
      const current = await txn.get<StoredRateLimit>(key);
      const { next, result } = await update(current);
      await txn.put(key, next, { expiration: Math.ceil(next.resetAt / 1000) });
      return result;
    });
  }

  const { next, result } = await update(memoryFallback.get(key));
  memoryFallback.set(key, next);
  return result;
}

export async function enforceRateLimits(c: Context, rules: RateLimitRule[]): Promise<Response | null> {
  for (const rule of rules) {
    const result = await checkRule(rule);
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSeconds));
      c.header("X-RateLimit-Limit", String(rule.limit));
      c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
      return c.json({ error: "Too many attempts. Try again shortly." }, 429);
    }
  }

  return null;
}

export function ipRateLimit(c: Context, namespace: string, limit: number, windowMs: number): RateLimitRule {
  return {
    namespace,
    key: `ip:${getClientIp(c)}`,
    limit,
    windowMs,
  };
}

export function subjectRateLimit(namespace: string, subject: string, limit: number, windowMs: number): RateLimitRule {
  return {
    namespace,
    key: `subject:${subject.toLowerCase()}`,
    limit,
    windowMs,
  };
}
