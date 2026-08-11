import { Hono } from "hono";
import { getIssuer, getJwtPublicJwk } from "../lib/oidc";
import accountRoutes from "./oauth/account";
import appKeyRecoveryRoutes from "./oauth/app-key-recovery";
import authorizationBootstrapRoutes from "./oauth/authorization-bootstrap";
import authorizationRoutes from "./oauth/authorize";
import fedCmRoutes from "./oauth/fedcm";
import metadataRoutes from "./oauth/metadata";
import tokenRoutes from "./oauth/token";
import { getDiscoveryBase, publicCache } from "./oauth/shared";

const app = new Hono();
export const oidcRoutes = new Hono();

app.route("/", metadataRoutes);
app.route("/", fedCmRoutes);
app.route("/", authorizationBootstrapRoutes);
app.route("/", authorizationRoutes);
app.route("/", tokenRoutes);
app.route("/", accountRoutes);
app.route("/", appKeyRecoveryRoutes);

oidcRoutes.get("/webfinger", (c) => {
  const resource = c.req.query("resource");
  if (!resource) {
    return c.json({ error: "resource required" }, 400);
  }

  return c.json({
    subject: resource,
    links: [
      {
        rel: "http://openid.net/specs/connect/1.0/issuer",
        href: getIssuer(),
      },
    ],
  });
});

oidcRoutes.get("/openid-configuration", (c) => {
  const issuer = getIssuer();
  const discoveryBase = getDiscoveryBase();
  publicCache(c, 3600);
  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/signin`,
    token_endpoint: `${discoveryBase}/api/oauth/token`,
    userinfo_endpoint: `${discoveryBase}/api/oauth/userinfo`,
    jwks_uri: `${discoveryBase}/.well-known/jwks.json`,
    scopes_supported: ["openid", "profile", "email", "offline_access", "user_id"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:token-exchange"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
  });
});

oidcRoutes.get("/jwks.json", async (c) => {
  try {
    publicCache(c, 300);
    return c.json({ keys: [await getJwtPublicJwk()] });
  } catch {
    return c.json({ error: "JWKS not configured" }, 500);
  }
});

export default app;
