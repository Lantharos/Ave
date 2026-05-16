# Ave

Ave is an open-source identity platform built around passkeys, OAuth 2.0, and OpenID Connect.

It combines the hosted sign-in experience, the OAuth/OIDC API, a developer portal, a business organization console, public SDKs, and product docs in one repository. The codebase also includes higher-level features layered on top of auth itself: Quick Ave for zero-registration sign-in, delegated app-to-app access, identity-backed signing, organization identity containers, and per-app encryption key delivery.

## What lives here

Ave is split into a few separate packages instead of one root workspace:

| Path | Purpose | Stack |
| --- | --- | --- |
| `ave-web` | Main Ave product UI at `aveid.net` | Svelte 5, Vite, Tailwind CSS v4 |
| `ave-server` | OAuth/OIDC API, auth flows, app management, signing, encryption, uploads | Hono, Cloudflare Workers, Durable Objects, D1, Drizzle |
| `ave-devs` | Developer portal for app registration, secrets, resources, analytics, and orgs | Svelte 5, Vite, Tailwind CSS v4 |
| `ave-business` | Business organization console at `business.aveid.net` | Svelte 5, Vite, Tailwind CSS v4 |
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

- `aveid.net` serves the end-user product UI
- `api.aveid.net` serves the OAuth/OIDC and product API
- `devs.aveid.net` serves the developer portal
- `business.aveid.net` serves the business organization console, including standard org encryption, customer KMS references, and opt-in E2EE org-key grants
- `docs.aveid.net` serves the documentation

## Local development

### Prerequisites

- [Bun](https://bun.sh/)
- A Cloudflare account if you want to run or deploy the Worker-backed API against real infrastructure

There is currently no root `package.json` workspace. Install and run each package from its own directory.

### 1. Start the API

The API is the center of the stack. `ave-web`, `ave-devs`, and `ave-business` all talk to it.

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

### 2. Start the main Ave web app

```bash
cd ave-web
bun install
```

Set local frontend env values if you want the app to talk to your local API instead of production:

```env
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000/ws"
```

Run the app:

```bash
bun run dev
```

Useful web commands:

```bash
bun run check
bun run build
```

### 3. Start the developer portal

```bash
cd ave-devs
bun install
```

The portal supports a local API override through `VITE_API_URL`. It also reads `VITE_DEV_PORTAL_CLIENT_ID` for its own Ave app configuration.

Run it with:

```bash
bun run dev
```

Useful portal commands:

```bash
bun run check
bun run build
```

### 4. Start the business organization console

```bash
cd ave-business
bun install
```

The console calls `http://localhost:3000` on localhost and `https://api.aveid.net` in production. Set `VITE_API_URL` when the Ave API is running somewhere else. Set `VITE_AVE_ORIGIN` only when sign-in should go to a non-default Ave web origin.

```env
VITE_API_URL="https://api.aveid.net"
VITE_AVE_ORIGIN="https://aveid.net"
```

Run it with:

```bash
bun run dev
```

Useful business console commands:

```bash
bun run check
bun run build
```

### 5. Work on the SDKs

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
- `ave-web/src/App.svelte` for the main product routing surface
- `ave-devs/src/App.svelte` for the developer portal shell and workspace/app flows
- `ave-business/src/App.svelte` for the business organization console
- `ave-docs/index.mdx` and `ave-docs/quickstart.mdx` for the public product story and integration path

## Database and storage notes

- The API uses Cloudflare D1 with Drizzle migrations stored in `ave-server/drizzle`
- The Worker binds a Durable Object named `API_APP`
- Uploads and public assets are wired through Cloudflare R2
- The scheduled Worker task triggers daily cleanup for stale devices and expired activity data

## Open source

Ave is licensed under the GNU Affero General Public License v3.0. See [LICENSE](./LICENSE).

For contribution and disclosure guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).
