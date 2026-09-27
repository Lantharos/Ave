# Ave

Ave is an open-source identity platform built around passkeys, OAuth 2.0, and OpenID Connect. It provides hosted sign-in, account recovery, Quick Ave, app-to-app delegation, identity-backed signing, and per-app encryption key delivery.

Apps own their workspaces, membership, billing, and authorization. Ave supplies the verified identity and the capabilities explicitly granted by that identity.

## Repository

| Package | Purpose |
| --- | --- |
| `ave-server` | Hono API on Cloudflare Workers, with D1, R2, Queues, and Durable Objects |
| `ave-web` | SvelteKit frontend for `aveid.net` and `devs.aveid.net` |
| `ave-docs` | Public documentation at `docs.aveid.net` |
| `sdks/ave-sdk` | TypeScript SDK and browser, server, Expo, Svelte, Next.js, and Convex integrations |
| `sdks/ave-embed` | Browser embed for auth, Connector, and signing |

Developer teams in `devs.aveid.net` manage OAuth apps, resources, credentials, and team access. Owners manage the team profile and administrators; administrators manage applications and viewer memberships; viewers have read access.

## Development

Install [Bun](https://bun.sh/) and install dependencies once from the repository root:

```bash
bun install --frozen-lockfile
```

Copy `ave-server/.dev.vars.example` to `ave-server/.dev.vars` and configure local signing keys and secrets. Use local values rather than production credentials. R2 and email use Worker bindings.

```bash
cd ave-server
bun run db:migrate:local
cd ..
bun run dev:api
```

In another terminal:

```bash
bun run dev:web
```

Configure the frontend's local environment when using the local API:

```env
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000/ws"
VITE_AVE_ORIGIN="http://localhost:5173"
```

The local frontend serves the product at `/` and the developer portal at `/devs`. API development uses port 3000.

## Validation

From the repository root:

```bash
bun run check
bun run build
```

Package scripts remain available from their directories. `ave-server` generates its passkey module during checks and Worker builds. SDK builds replace their output directory so removed exports cannot survive in published packages.

The API entrypoint is `ave-server/src/index.ts`. HTTP composition, request metadata, origins, and the login channel live in `src/runtime`; database tables are grouped under `src/db/schema`; API routes and their domain helpers live under `src/routes` and `src/lib`.

## Cloudflare deployment

The API and frontend each have a `wrangler.jsonc`. Cloudflare builds should install from the repository root with `bun install --frozen-lockfile`, then run the relevant package's deploy script.

The API uses D1 read sessions and bookmarks, R2 uploads, Cloudflare email, login-approval and rate-limit Durable Objects, background event queues, Analytics Engine, and Smart Placement. Passkey operations load a separately bundled module within the API Worker. Push delivery runs in the same Worker.

For a new account, create the queues before deploying:

```bash
cd ave-server
bunx wrangler queues create ave-background-events
bunx wrangler queues create ave-background-events-dlq
bun run db:migrate:remote
bun run deploy
cd ../ave-web
bun run deploy
```

For an existing deployment, inspect pending migrations before applying them. Back up D1 before destructive schema changes. The developer membership migration must precede the API deployment; the subsequent retirement migration is applied after the API has switched to the new tables. See [deployment notes](ave-server/DEPLOYMENT.md).

Keep D1 read replication enabled. Clients send D1 bookmarks to preserve read-your-writes consistency.

## SDK publication

`.github/workflows/publish-npm.yml` publishes `sdks/ave-sdk` or `sdks/ave-embed` through npm trusted publishing. Configure each npm package's trusted publisher for this repository and workflow, then run the workflow from a branch with the package path, requested version, and access level. It updates the package version and root Bun lockfile, builds, commits the version bump, and publishes with provenance.

Packages must retain `repository.url` pointing to `https://github.com/Lantharos/Ave` so npm can validate provenance. No npm token is required.

## Documentation

Public guides cover Quick Ave, OAuth/PKCE, confidential clients, FedCM, Connector, signing, encryption, app authorization, and framework integrations. Update `ave-docs` when changing public behavior or SDK contracts.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [SECURITY.md](SECURITY.md) for private vulnerability reporting.
