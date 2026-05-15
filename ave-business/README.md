# ave-business

Business organization console for Ave. It runs as the separate business surface for organization identity membership, wrapped org keys, verified domains, and SSO setup.

Install dependencies:

```bash
bun install
```

Run locally:

```bash
bun run dev
```

By default the console calls `http://localhost:3000` on localhost and `https://api.aveid.net` everywhere else. Set `VITE_API_URL` when the Ave API is running somewhere else. Set `VITE_AVE_ORIGIN` when sign-in should go to a non-default Ave web origin:

```env
VITE_API_URL="https://api.aveid.net"
VITE_AVE_ORIGIN="https://aveid.net"
```

Check the app:

```bash
bun run check
```

Cloudflare Pages:

```txt
Root directory: ave-business
Build command: bun run build
Build output directory: dist
Production domain: business.aveid.net
```
