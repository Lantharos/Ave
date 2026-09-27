# Ave frontend

Unified SvelteKit frontend for the Ave product and developer surfaces.

## Domains

One Cloudflare Worker serves the frontend domains:

- `aveid.net` renders the main Ave product UI
- `devs.aveid.net` renders the developer portal

Host-based routing lives in `src/hooks.ts`. Locally, use path prefixes instead:

- `http://localhost:5173`
- `http://localhost:5173/devs`

Route-level UI lives in `src/routes`, with flow state and actions colocated beside each screen. Authorization separates consent, embedded session access, and encryption-key recovery. Signing and identity editing each keep their state in dedicated controllers. The developer portal separates navigation and loading, reactive state, and application actions.

Shared clients, stores, and reusable controls live in `src/lib/surfaces`. Developer teams manage their own apps and membership; apps implement their own end-user workspaces and permissions.

## Development

```bash
bun install # from the repository root
bun run --cwd ave-web dev
```

Optional local API overrides:

```env
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000/ws"
VITE_AVE_ORIGIN="http://localhost:5173"
```

## Checks and build

```bash
bun run --cwd ave-web check
bun run --cwd ave-web build
bun run --cwd ave-web preview
```

The Worker is configured in `wrangler.jsonc` with custom domains for all frontend surfaces.
