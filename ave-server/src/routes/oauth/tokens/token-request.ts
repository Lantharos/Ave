import type { Context } from "hono";
import { oauthTokenRequestSchema } from "./token-schema";

const SUPPORTED_GRANT_TYPES = new Set(["authorization_code", "refresh_token"]);

type TokenRequestResult =
  | { ok: true; payload: ReturnType<typeof oauthTokenRequestSchema.parse> }
  | { ok: false; error: "invalid_request" | "unsupported_grant_type" | "invalid_client"; description: string };

async function readBody(c: Context): Promise<Record<string, unknown>> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(await c.req.text()));
  }
  const body = await c.req.json();
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

function decodeCredentialPart(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

function readBasicClientCredentials(c: Context): { client_id: string; client_secret: string } | null | undefined {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Basic ")) return undefined;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      client_id: decodeCredentialPart(decoded.slice(0, separator)),
      client_secret: decodeCredentialPart(decoded.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

export async function readTokenRequest(c: Context): Promise<TokenRequestResult> {
  const body = await readBody(c);
  const grantType = body.grant_type ?? body.grantType;
  if (typeof grantType !== "string" || !SUPPORTED_GRANT_TYPES.has(grantType)) {
    return { ok: false, error: "unsupported_grant_type", description: "Supported grant types are authorization_code and refresh_token" };
  }

  const basicCredentials = readBasicClientCredentials(c);
  if (basicCredentials === null) {
    return { ok: false, error: "invalid_client", description: "Malformed Basic client credentials" };
  }

  const parsed = oauthTokenRequestSchema.safeParse(basicCredentials ? { ...body, ...basicCredentials } : body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean))];
    return { ok: false, error: "invalid_request", description: fields.length ? `Invalid or missing: ${fields.join(", ")}` : "Invalid token request" };
  }
  return { ok: true, payload: parsed.data };
}
