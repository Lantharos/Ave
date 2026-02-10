import { buildAuthorizeUrl, generateCodeChallenge, generateCodeVerifier, generateNonce } from "./index";

export async function startPkceLogin(params: {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
}): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const nonce = generateNonce();

  sessionStorage.setItem("ave_code_verifier", verifier);
  sessionStorage.setItem("ave_nonce", nonce);

  const url = buildAuthorizeUrl(
    {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      issuer: params.issuer,
    },
    {
      scope: (params.scope || "openid profile email").split(" ") as any,
      nonce,
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
    }
  );

  window.location.href = url;
}
