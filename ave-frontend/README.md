# Ave frontend

Unified SvelteKit frontend for the Ave product, developer, and business surfaces.

## Domains

One Cloudflare Worker serves the frontend domains:

- `aveid.net` and `www.aveid.net` render the main Ave product UI
- `devs.aveid.net` renders the developer portal
- `business.aveid.net` renders the business organization console

Host-based routing lives in `src/hooks.ts`. Locally, use path prefixes instead:

- `http://localhost:5173`
- `http://localhost:5173/devs`
- `http://localhost:5173/business`

Route-level UI lives in `src/routes`. Shared clients, stores, and reusable controls live in `src/lib/surfaces`.

## Development

```bash
bun install
bun run dev
```

Optional local API overrides:

```env
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000/ws"
VITE_AVE_ORIGIN="http://localhost:5173"
```

## Checks and build

```bash
bun run check
bun run build
bun run preview
```

The Worker is configured in `wrangler.jsonc` with custom domains for all frontend surfaces.
