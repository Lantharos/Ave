import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { db, oauthApps } from "../../db";
import { isScopeAllowedForApp } from "../../lib/e2ee-scopes";
import { consumeAuthorizationCode } from "../../lib/oauth-store";
import {
  buildQuickApp,
  getQuickOrigin,
  isClientSecretValid,
  isQuickClient,
  isValidPkceCodeVerifier,
  parseScopes,
  timingSafeEqualString,
} from "./shared";
import { buildTokenResponseFromAuthorizationCode } from "./token-response";
import type { AuthorizationCodeRequest } from "./token-schema";

export async function handleAuthorizationCode(c: Context, payload: AuthorizationCodeRequest) {
  const { code, redirectUri, clientId, clientSecret, codeVerifier } = payload;


  // Find authorization code
  const authCodeResult = await consumeAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({
      error: "invalid_grant",
      error_description: authCodeResult.expired ? "Authorization code expired" : "Authorization code not found",
    }, 400);
  }
  const authCode = authCodeResult.value;
  if (!isQuickClient(clientId) && !authCode.authorizationId) {
    return c.json({ error: "invalid_grant", error_description: "App authorization was revoked" }, 400);
  }

  if (authCode.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "Redirect URI mismatch" }, 400);
  }

  // Find (or derive) the OAuth app
  let oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;
  if (isQuickClient(clientId)) {
    // Quick Auth: PKCE is mandatory — it must have been set at authorize time
    if (!authCode.codeChallenge) {
      return c.json({ error: "invalid_request", error_description: "PKCE is required for Quick Ave" }, 400);
    }
    // Validate that the redirect_uri origin matches the client_id origin
    // (mirrors the check performed at authorize time)
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "invalid_client", error_description: "Invalid client_id" }, 400);
    }
    let redirectOrigin: string;
    try { redirectOrigin = new URL(redirectUri).origin; } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      return c.json({ error: "invalid_grant", error_description: "Invalid redirect_uri" }, 400);
    }
    if (redirectOrigin !== quickOrigin) {
      return c.json({ error: "invalid_grant", error_description: "redirect_uri origin does not match client_id" }, 400);
    }
    // When the browser sends an Origin header (always present for cross-origin fetch),
    // it must match the client_id origin — this cannot be forged by browser code.
    const requestOrigin = c.req.header("Origin");
    if (requestOrigin && requestOrigin !== quickOrigin) {
      return c.json({ error: "invalid_client", error_description: "Request origin does not match client_id" }, 400);
    }
    oauthApp = buildQuickApp(clientId);
  } else {
    const [app] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!app) {
      return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
    }
    oauthApp = app;
  }

  // Verify the client presenting the code is the same one that received it at
  // authorize time. For Quick clients oauthApp.id === clientId; for standard
  // clients oauthApp.id is the database UUID stored in the auth code.
  if (oauthApp.id !== authCode.appId) {
    return c.json({ error: "invalid_grant", error_description: "client_id does not match authorization" }, 400);
  }

  let clientSecretAuthenticated = false;
  let pkceAuthenticated = false;

  // Verify client secret or PKCE code verifier
  if (authCode.codeChallenge) {
    if (clientSecret) {
      if (!isClientSecretValid(oauthApp.clientSecretHash, clientSecret)) {
        return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
      }
      clientSecretAuthenticated = true;
    }

    // PKCE flow
    if (!codeVerifier) {
      return c.json({ error: "invalid_request", error_description: "Code verifier required" }, 400);
    }
    if (!isValidPkceCodeVerifier(codeVerifier)) {
      return c.json({ error: "invalid_request", error_description: "Code verifier must be 43-128 characters and use the PKCE character set" }, 400);
    }

    let computedChallenge: string;
    if (authCode.codeChallengeMethod === "S256") {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hash = await crypto.subtle.digest("SHA-256", data);
      computedChallenge = Buffer.from(hash).toString("base64url");
    } else {
      computedChallenge = codeVerifier;
    }

    if (!timingSafeEqualString(computedChallenge, authCode.codeChallenge)) {
      return c.json({ error: "invalid_grant", error_description: "Code verifier mismatch" }, 400);
    }
    pkceAuthenticated = true;
  } else if (clientSecret) {
    // Client secret flow
    if (!isClientSecretValid(oauthApp.clientSecretHash, clientSecret)) {
      return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
    }
    clientSecretAuthenticated = true;
  } else {
    return c.json({ error: "invalid_request", error_description: "Client authentication required" }, 400);
  }

  const allowedScopes = (oauthApp.allowedScopes && oauthApp.allowedScopes.length > 0
    ? oauthApp.allowedScopes
    : ["openid", "profile", "email", "offline_access"]) as string[];
  const requestedScopes = parseScopes(authCode.scope);
  const invalidScopes = requestedScopes.filter(
    (s) => !isScopeAllowedForApp(s, allowedScopes),
  );
  if (invalidScopes.length > 0) {
    return c.json({ error: "invalid_scope", error_description: `Invalid scopes: ${invalidScopes.join(", ")}` }, 400);
  }

  const response = await buildTokenResponseFromAuthorizationCode({
    authCode,
    oauthApp,
    clientId,
    redirectUri,
    issueRefreshToken: clientSecretAuthenticated || pkceAuthenticated,
  });

  // Note: the app key is NOT included in the JSON token response.
  // The Ave authorization UI decrypts the server-stored encrypted key using the user's master key
  // during the consent step and passes the plaintext key to the app as #app_key=... in the
  // callback redirect URL fragment — it never appears in server logs or JSON response bodies.

  return c.json(response);
}
