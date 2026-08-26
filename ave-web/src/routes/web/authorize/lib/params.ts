function parseCodeChallengeMethod(value: string | null): "S256" | "plain" | undefined {
  return value === "S256" || value === "plain" ? value : undefined;
}

export function parseAuthorizationParams(querystring: string) {
  const searchParams = new URLSearchParams(querystring);
  return {
    clientId: searchParams.get("client_id") || "",
    redirectUri: searchParams.get("redirect_uri") || "",
    scope: searchParams.get("scope") || "openid profile email",
    state: searchParams.get("state") || "",
    nonce: searchParams.get("nonce") || "",
    identityId: searchParams.get("identity_id") || "",
    organizationId: searchParams.get("organization_id") || "",
    resource: searchParams.get("resource") || "",
    embed: searchParams.get("embed") === "1",
    fedcmContinue: searchParams.get("fedcm_continue") === "1",
    codeChallenge: searchParams.get("code_challenge") || undefined,
    codeChallengeMethod: parseCodeChallengeMethod(searchParams.get("code_challenge_method")),
    prompt: searchParams.get("prompt") || "",
  };
}
