import { Context } from "hono";
import { createHash } from "node:crypto";

type StoredRateLimit = {
  count: number;
  resetAt: number;
};

export type RateLimitRule = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  failClosed?: boolean;
};

export type NativeRateLimitRule = {
  binding: string;
  key: string;
  periodSeconds: 10 | 60;
  fallback: RateLimitRule;
};

export type NativeRateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  resetAt: number;
  unavailable?: boolean;
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
    const bucket = await this.state.storage.transaction(async (txn) => {
      const current = await txn.get<StoredRateLimit>("bucket");
      const { next, result } = await updateBucket(current, rule.limit, rule.windowMs);
      await txn.put("bucket", next);
      return { result, resetAt: next.resetAt };
    });
    await this.state.storage.setAlarm(bucket.resetAt);

    return Response.json(bucket.result);
  }

  async alarm(): Promise<void> {
    await this.state.storage.delete("bucket");
  }
}

function getRateLimitNamespace(c: Context): DurableObjectNamespace | null {
  return ((c.env as { RATE_LIMITER?: DurableObjectNamespace } | undefined)?.RATE_LIMITER) ?? null;
}

async function checkRule(c: Context, rule: RateLimitRule): Promise<RateLimitResult> {
  const key = storageKey(rule);
  const namespace = getRateLimitNamespace(c);
  if (namespace) {
    try {
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
    } catch {
      // fall through
    }

    if (rule.failClosed) {
      return {
        allowed: false,
        retryAfterSeconds: 30,
        resetAt: Date.now() + 30_000,
        unavailable: true,
      };
    }
  } else if (rule.failClosed) {
    return {
      allowed: false,
      retryAfterSeconds: 30,
      resetAt: Date.now() + 30_000,
      unavailable: true,
    };
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
      if (result.unavailable) {
        return c.json({ error: "Rate limiting temporarily unavailable. Try again shortly." }, 503);
      }
      return c.json({ error: "Too many attempts. Try again shortly." }, 429);
    }
  }

  return null;
}

export async function enforceNativeRateLimits(c: Context, rules: NativeRateLimitRule[]): Promise<Response | null> {
  const env = c.env as Record<string, unknown> | undefined;
  const bindings = rules.map((rule) => env?.[rule.binding] as NativeRateLimitBinding | undefined);

  if (bindings.some((binding) => !binding)) {
    return enforceRateLimits(c, rules.map((rule) => rule.fallback));
  }

  let results: Array<{ success: boolean }>;
  try {
    results = await Promise.all(rules.map((rule, index) => bindings[index]!.limit({ key: rule.key })));
  } catch {
    return enforceRateLimits(c, rules.map((rule) => rule.fallback));
  }

  for (const [index, result] of results.entries()) {
    if (result.success) continue;

    const rule = rules[index];
    c.header("Retry-After", String(rule.periodSeconds));
    c.header("X-RateLimit-Limit", String(rule.fallback.limit));
    c.header("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + rule.periodSeconds));
    return c.json({ error: "Too many attempts. Try again shortly." }, 429);
  }

  return null;
}

export function ipRateLimit(
  c: Context,
  namespace: string,
  limit: number,
  windowMs: number,
  options: { failClosed?: boolean } = {},
): RateLimitRule {
  return {
    namespace,
    key: `ip:${getClientIp(c)}`,
    limit,
    windowMs,
    failClosed: options.failClosed,
  };
}

export function subjectRateLimit(
  namespace: string,
  subject: string,
  limit: number,
  windowMs: number,
  options: { failClosed?: boolean } = {},
): RateLimitRule {
  return {
    namespace,
    key: `subject:${subject}`,
    limit,
    windowMs,
    failClosed: options.failClosed,
  };
}
