# Deploying Ave

Ave runs as two Workers: `ave-server` and `ave-web`. The API serves `api.aveid.net`; the frontend serves `aveid.net` and `devs.aveid.net`. Documentation is published separately from `ave-docs`.

## Qualification

From the repository root:

```sh
bun install --frozen-lockfile
bun run check
bun run build
```

The API build produces an additional WebAuthn module. Deploy through Wrangler so that both the entry point and `generated/webauthn.mjs` are uploaded. Ordinary API requests do not load WebAuthn verification code.

For local development, copy `.dev.vars.example` to `.dev.vars` and configure local signing keys. The browser can target a different API port with `VITE_API_URL`. Never use production credentials or a production database for local qualification.

## Database changes

Keep applied D1 migrations. Rehearse changes against an export and check retained records and foreign keys before changing production. Store database exports outside the repository with access restricted to the operator.

The developer-team transition uses two migrations:

1. `0029_developer_members.sql` creates and copies developer memberships. Apply this before deploying the API that reads `developer_members`.
2. Deploy the API and frontend, verify health, passkey options, OAuth discovery, and developer access, and allow previous requests to finish.
3. `0030_retire_business.sql` removes enterprise-only data and columns. Apply this after the new API is serving all traffic. It preserves ordinary accounts, app ownership, sessions, grants, signing keys, and personal encryption keys.

For an existing deployment, apply only the additive migration first by pointing a temporary Wrangler configuration at a directory containing migrations through `0029`. After deployment, use the normal configuration to apply the remaining migration. A fresh local database can apply the whole history at once.

Do not roll back to a Worker that selects removed columns after the cleanup migration. Use a forward fix, or restore the matching database and Worker together during a controlled recovery.

## Workers and secrets

From each package directory:

```sh
# ave-server
bun run deploy

# ave-web
bun run deploy
```

The API's non-secret configuration is declared in `wrangler.jsonc`. Wrangler preserves deployed secrets. `OIDC_PRIVATE_KEY_PEM`, `VAPID_PRIVATE_KEY`, and `DEMO_PASSWORD` belong in Worker secrets, never source control. Keep the existing VAPID key pair so enrolled devices remain subscribed.

Check both queue backlog and the dead-letter queue before retiring an event producer. After the consolidated API is verified, remove the `ave-heavy-services` Worker, the `business.aveid.net` custom domain, and the unused `SESSION_SECRET` secret. The API must have no `HEAVY_SERVICES` binding or `BUSINESS_ORIGIN` variable.

## Verification

Verify public health and OIDC discovery, authenticated account and developer access, passkey registration/login, OAuth code exchange and refresh, signing, recovery, and encrypted key delivery. Exercise push delivery with an enrolled device when available; a successful build cannot prove notification delivery or physical authenticator behavior.

Publish SDK packages through the npm workflow after the API is deployed. SDK 0.11 removes the workspace API; app-owned workspaces use the verified Ave identity as their member identifier.
