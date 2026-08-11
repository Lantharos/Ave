export const QUICK_AUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const QUICK_AUTH_SCOPES = ["openid", "profile", "email"];

export function isQuickClient(clientId: string): boolean {
  return typeof clientId === "string" && clientId.startsWith("origin:");
}

export function getQuickOrigin(clientId: string): string | null {
  try {
    const raw = clientId.slice("origin:".length);
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function buildQuickApp(clientId: string) {
  return {
    id: clientId,
    clientId,
    name: "Quick Ave",
    description: null as string | null,
    iconUrl: null as string | null,
    websiteUrl: null as string | null,
    clientSecretHash: "",
    redirectUris: [] as string[],
    allowedScopes: [...QUICK_AUTH_SCOPES],
    accessTokenTtlSeconds: QUICK_AUTH_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: 0,
    developmentMode: false,
    supportsE2ee: false,
    ownerId: null as string | null,
    createdAt: new Date(),
  };
}
