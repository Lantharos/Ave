import { exchangeCode, refreshToken as refreshTokenRequest } from "./api";
import { generateCodeChallenge, generateCodeVerifier, generateRandomString } from "./pkce";
import { clearSession, loadSession, saveSession } from "./storage";

const AVE_AUTH_URL = "https://aveid.net/signin";
const REDIRECT_URI = "https://devs.aveid.net/callback";

export interface AuthConfig {
  clientId: string;
}

export async function startLogin(config: AuthConfig): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);
  const nonce = generateRandomString(32);

  sessionStorage.setItem("ave_code_verifier", codeVerifier);
  sessionStorage.setItem("ave_oauth_state", state);
  sessionStorage.setItem("ave_oauth_nonce", nonce);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email user_id",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${AVE_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(config: AuthConfig): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state) {
    throw new Error("Missing callback parameters");
  }

  const expectedState = sessionStorage.getItem("ave_oauth_state");
  if (state !== expectedState) {
    throw new Error("State mismatch");
  }

  const verifier = sessionStorage.getItem("ave_code_verifier");
  if (!verifier) {
    throw new Error("Missing PKCE verifier");
  }

  const tokenResponse = await exchangeCode({
    code,
    codeVerifier: verifier,
    clientId: config.clientId,
    redirectUri: REDIRECT_URI,
  });

  saveSession({
    accessTokenJwt: tokenResponse.access_token_jwt,
    refreshToken: tokenResponse.refresh_token,
    clientId: config.clientId,
  });

  sessionStorage.removeItem("ave_code_verifier");
  sessionStorage.removeItem("ave_oauth_state");
  sessionStorage.removeItem("ave_oauth_nonce");
}

export async function refreshSession(): Promise<void> {
  const session = loadSession();
  if (!session?.refreshToken || !session.clientId) {
    throw new Error("No refresh token available");
  }

  const tokenResponse = await refreshTokenRequest({
    refreshToken: session.refreshToken,
    clientId: session.clientId,
  });

  saveSession({
    accessTokenJwt: tokenResponse.access_token_jwt,
    refreshToken: tokenResponse.refresh_token || session.refreshToken,
    clientId: session.clientId,
  });
}

export function logout(): void {
  clearSession();
}
