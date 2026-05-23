# Ave

Ave is an open-source identity platform built around passkeys, OAuth 2.0, and OpenID Connect.

It combines the hosted sign-in experience, the OAuth/OIDC API, a developer portal, a business organization console, public SDKs, and product docs in one repository. The codebase also includes higher-level features layered on top of auth itself: Quick Ave for zero-registration sign-in, delegated app-to-app access, identity-backed signing, organization identity containers, and per-app encryption key delivery.

## What lives here

Ave is split into a few separate packages instead of one root workspace:

| Path | Purpose | Stack |
| --- | --- | --- |
| `ave-frontend` | Unified frontend Worker for `aveid.net`, `www.aveid.net`, `devs.aveid.net`, and `business.aveid.net` | SvelteKit, Cloudflare Workers, Tailwind CSS v4 |
| `ave-server` | OAuth/OIDC API, auth flows, app management, signing, encryption, uploads | Hono, Cloudflare Workers, Durable Objects, D1, Drizzle |
| `ave-docs` | Product and SDK documentation | Mintlify content |
| `sdks/ave-sdk` | Typed JavaScript/TypeScript SDK for OAuth, OIDC, session, Convex, Expo, Svelte, and Next.js helpers | TypeScript |
| `sdks/ave-embed` | Lightweight browser embed for iframe, sheet, popup, connector, and signing flows | Plain JS |

## Core capabilities

- Passkey-first authentication and account recovery flows
- OAuth 2.0 + OpenID Connect provider support
- Quick Ave for zero-registration auth tied to the caller origin
- Developer portal for app registration, redirect URIs, scopes, secrets, resources, and organizations
- Business organizations for identity membership, roles, signed admin actions, org key grants, verified domains, and SSO setup
- Connector delegation for app-to-app access
- Identity-backed Ed25519 signing flows
- Per-app encryption key delivery for end-to-end encrypted integrations
- Public SDKs and first-party docs for browser, server, Expo, Svelte, Next.js, and Convex use cases

## Production surfaces

The repository is organized around the same split used in production:

- `ave-frontend` serves the end-user product UI on `aveid.net` and `www.aveid.net`
- `ave-frontend` serves the developer portal on `devs.aveid.net`
- `ave-frontend` serves the business organization console on `business.aveid.net`, including standard org encryption, customer KMS references, and opt-in E2EE org-key grants
- `api.aveid.net` serves the OAuth/OIDC and product API
- `docs.aveid.net` serves the documentation

## Local development

### Prerequisites

- [Bun](https://bun.sh/)
- A Cloudflare account if you want to run or deploy the Worker-backed API against real infrastructure

There is currently no root `package.json` workspace. Install and run each package from its own directory.

### 1. Start the API

The API is the center of the stack. `ave-frontend` talks to it for the product, developer, and business surfaces.

```bash
cd ave-server
bun install
```

Create local environment files from the examples:

- Copy `.env.example` to `.env`
- Copy `.dev.vars.example` to `.dev.vars`

Apply the D1 migrations locally:

```bash
bun run db:migrate:local
```

Start the Worker locally:

```bash
bun run dev
```

Useful API commands:

```bash
bun run check
bun run db:generate
bun run db:migrate:remote
```

The API Worker also uses Durable Objects for realtime login approval fanout and sharded rate-limit counters, Cloudflare Queues for background audit and analytics writes, Workers Analytics Engine for request timing metrics, and Smart Placement. Create the background queues once per Cloudflare account before the first deploy that references them:

```bash
cd ave-server
bunx wrangler queues create ave-background-events
bunx wrangler queues create ave-background-events-dlq
bunx wrangler d1 migrations apply ave --remote
bunx wrangler deploy
```

Workers Analytics Engine datasets are created on first write after the binding is deployed. D1 read replication should stay enabled; Ave clients send D1 bookmarks on follow-up requests so reads can remain fast without losing read-your-writes behavior.

The API defaults to `http://localhost:3000` in local development.

### 2. Start the unified frontend

```bash
cd ave-frontend
bun install
```

Set local frontend env values if you want the app to talk to your local API instead of production:

```env
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000/ws"
VITE_AVE_ORIGIN="http://localhost:5173"
```

Run the app:

```bash
bun run dev
```

The local frontend serves all surfaces from one SvelteKit app:

- `http://localhost:5173` for the main Ave UI
- `http://localhost:5173/devs` for the developer portal surface
- `http://localhost:5173/business` for the business organization console

Useful frontend commands:

```bash
bun run check
bun run build
bun run preview
```

### 3. Work on the SDKs

`sdks/ave-sdk` ships the typed integration surface used throughout the docs and examples:

```bash
cd sdks/ave-sdk
bun install
bun run build
```

`sdks/ave-embed` ships the browser embed runtime:

```bash
cd sdks/ave-embed
bun run build:windows
```

### Publishing SDK packages

SDK packages publish through `.github/workflows/publish-npm.yml` with npm trusted publishing. The workflow is manual, only accepts the SDK package folders, writes the requested `version` into the selected package, commits the bump back to the branch, and then publishes.

Before first use, configure each npm package's trusted publisher on npmjs.com for this repository and workflow file:

```txt
.github/workflows/publish-npm.yml
```

Then run the workflow with:

```txt
package: sdks/ave-sdk or sdks/ave-embed
version: the package version to write and publish
access: public or restricted
```

Run it from a branch, not a tag, so the release commit can be pushed. No npm token is required. The workflow uses GitHub OIDC, so the npm package trusted publisher must point at this repository and workflow file before the first publish. Each published package must also keep `repository.url` set to `https://github.com/Lantharos/Ave`, because npm validates that value against the GitHub provenance bundle.

## Docs

The documentation source lives in `ave-docs`. It covers:

- Quick Ave
- Full OAuth authorization code flow
- PKCE and confidential clients
- Connector delegation
- Signing
- End-to-end encryption
- Framework integrations including Expo, Next.js, Convex, SQL/Postgres, and Better Auth

If you change behavior in the SDKs, auth flows, developer portal, or business organization console, the matching docs in `ave-docs` should usually move with it.

## Where to look first

If you are new to the repo, these files are the quickest way to orient yourself:

- `ave-server/src/index.ts` for API composition, CORS, Durable Object entrypoints, and scheduled cleanup
- `ave-server/src/routes/oauth.ts` for OAuth/OIDC, Quick Ave, refresh rotation, and FedCM
- `ave-server/src/routes/apps.ts` for developer portal app and resource management
- `ave-server/src/routes/organizations.ts` for multi-workspace developer portal support
- `ave-server/src/routes/business.ts` for business organization identity containers, roles, org keys, and SSO setup
- `ave-frontend/src/hooks.ts` for host-based frontend routing across Ave domains
- `ave-frontend/src/routes/web` for the main product UI
- `ave-frontend/src/routes/devs` for the developer portal
- `ave-frontend/src/routes/business` for the business organization console
- `ave-docs/index.mdx` and `ave-docs/quickstart.mdx` for the public product story and integration path

## Database and storage notes

- The API uses Cloudflare D1 with Drizzle migrations stored in `ave-server/drizzle`
- The Worker binds a Durable Object named `API_APP`
- Uploads and public assets are wired through Cloudflare R2
- The scheduled Worker task triggers daily cleanup for stale devices and expired activity data

## Open source

Ave is licensed under the GNU Affero General Public License v3.0. See [LICENSE](./LICENSE).

For contribution and disclosure guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).
