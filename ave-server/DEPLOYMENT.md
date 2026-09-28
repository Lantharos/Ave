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

D1 enforces foreign keys during migrations and ignores `PRAGMA foreign_keys = OFF`, so dropping a table also runs its `ON DELETE CASCADE` actions. Never let a migration drop or rebuild a table that other rows still reference. Move the referencing rows aside first, the way `0031_slim_ave.sql` rebuilds `organizations`, and rehearse on a local copy before applying remotely.

`oauth_apps.owner_id` is still in the table with every value cleared, because rebuilding `oauth_apps` would cascade into authorizations and tokens.

Do not roll back to a Worker that selects removed columns after a cleanup migration. Use a forward fix, or restore the matching database and Worker together during a controlled recovery.

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

Verify public health and OIDC discovery, authenticated account and developer access, passkey registration/login, OAuth code exchange and refresh, recovery, and encrypted key delivery. Exercise push delivery with an enrolled device when available; a successful build cannot prove notification delivery or physical authenticator behavior.

Publish SDK packages through the npm workflow after the API is deployed.
