export const onRequest: PagesFunction = async () => {
  const upstream = await fetch(
    "https://api.aveid.net/.well-known/jwks.json",
    { cf: { cacheEverything: true, cacheTtl: 86400 } } as RequestInit & { cf?: Record<string, unknown> }
  );

  if (!upstream.ok) {
    return new Response("Failed to fetch JWKS", { status: 502 });
  }

  const body = await upstream.text();

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
