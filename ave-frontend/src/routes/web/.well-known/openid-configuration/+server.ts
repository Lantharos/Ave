import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const upstream = await fetch("https://api.aveid.net/.well-known/openid-configuration", {
    cf: { cacheEverything: true, cacheTtl: 3600 },
  } as RequestInit & { cf?: Record<string, unknown> });

  if (!upstream.ok) {
    return new Response("Failed to fetch discovery document", { status: 502 });
  }

  return new Response(await upstream.text(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
};
