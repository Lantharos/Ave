export const onRequest: PagesFunction = async () => {
  const upstream = await fetch(
    "https://api.aveid.net/.well-known/openid-configuration",
    { cf: { cacheEverything: true, cacheTtl: 3600 } } as RequestInit & { cf?: Record<string, unknown> }
  );

  if (!upstream.ok) {
    return new Response("Failed to fetch discovery document", { status: 502 });
  }

  const body = await upstream.text();

  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
