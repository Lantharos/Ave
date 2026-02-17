import { buildAuthorizeUrl, buildConnectorUrl, generateCodeChallenge, generateCodeVerifier, generateNonce } from "./index";

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

export async function startConnectorFlow(params: {
  clientId: string;
  redirectUri: string;
  resource: string;
  scope: string;
  mode?: "user_present" | "background";
  issuer?: string;
}): Promise<void> {
  const state = generateNonce();
  sessionStorage.setItem("ave_connector_state", state);

  const url = buildConnectorUrl(
    {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      issuer: params.issuer,
    },
    {
      resource: params.resource,
      scope: params.scope,
      mode: params.mode || "user_present",
      state,
    }
  );

  window.location.href = url;
}
