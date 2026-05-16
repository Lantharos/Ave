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

const memoryFallback = new Map<string, StoredRateLimit>();

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

async function updateBucket(
  current: StoredRateLimit | undefined,
  limit: number,
  windowMs: number,
): Promise<{ next: StoredRateLimit; result: RateLimitResult }> {
  const now = Date.now();
  const active = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + windowMs };

  const next = {
    count: active.count + 1,
    resetAt: active.resetAt,
  };

  const retryAfterSeconds = Math.max(1, Math.ceil((next.resetAt - now) / 1000));
  return {
    next,
    result: {
      allowed: next.count <= limit,
      retryAfterSeconds,
      resetAt: next.resetAt,
    },
  };
}

export class RateLimitDurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    const rule = await request.json() as Pick<RateLimitRule, "limit" | "windowMs">;
    const result = await this.state.storage.transaction(async (txn) => {
      const current = await txn.get<StoredRateLimit>("bucket");
      const { next, result } = await updateBucket(current, rule.limit, rule.windowMs);
      await txn.put("bucket", next, { expiration: Math.ceil(next.resetAt / 1000) });
      return result;
    });

    return Response.json(result);
  }
}

function getRateLimitNamespace(c: Context): DurableObjectNamespace | null {
  return ((c.env as { RATE_LIMITER?: DurableObjectNamespace } | undefined)?.RATE_LIMITER) ?? null;
}

async function checkRule(c: Context, rule: RateLimitRule): Promise<RateLimitResult> {
  const key = storageKey(rule);
  const namespace = getRateLimitNamespace(c);
  if (namespace) {
    const id = namespace.idFromName(key);
    const response = await namespace.get(id).fetch("https://rate-limit/check", {
      method: "POST",
      body: JSON.stringify({
        limit: rule.limit,
        windowMs: rule.windowMs,
      }),
    });

    if (response.ok) {
      return await response.json() as RateLimitResult;
    }
  }

  const { next, result } = await updateBucket(memoryFallback.get(key), rule.limit, rule.windowMs);
  memoryFallback.set(key, next);
  return result;
}

export async function enforceRateLimits(c: Context, rules: RateLimitRule[]): Promise<Response | null> {
  const results = await Promise.all(rules.map((rule) => checkRule(c, rule)));
  for (const [index, result] of results.entries()) {
    if (!result.allowed) {
      const rule = rules[index];
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
