import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const upstream = await fetch("https://api.aveid.net/.well-known/jwks.json", {
    cf: { cacheEverything: true, cacheTtl: 86400 },
  } as RequestInit & { cf?: Record<string, unknown> });

  if (!upstream.ok) {
    return new Response("Failed to fetch JWKS", { status: 502 });
  }

  return new Response(await upstream.text(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "application/json",
    },
  });
};
