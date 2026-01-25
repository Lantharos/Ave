import { openAveSheet, openAvePopup } from "@ave-id/embed";
import { DEMO_CLIENT_ID, DEMO_REDIRECT_URI, DEMO_SCOPES } from "./config.js";
import { exchangeCode, fetchUserInfo } from "./api.js";
import { store } from "./store.svelte.js";

// PKCE helpers
function generateCodeVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

let pendingCodeVerifier = null;

export async function tryPopupAuth() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  pendingCodeVerifier = codeVerifier;

  openAvePopup({
    clientId: DEMO_CLIENT_ID,
    redirectUri: DEMO_REDIRECT_URI,
    scope: DEMO_SCOPES,
    codeChallenge,
    codeChallengeMethod: "S256",
    onSuccess: async (payload) => {
      console.log("Auth success:", payload);
      await handleAuthCallback(payload.redirectUrl);
    },
    onError: (err) => {
      console.error("Auth error:", err);
      pendingCodeVerifier = null;
    },
    onClose: () => {
      console.log("Popup closed");
    }
  });
}

export async function trySheetAuth() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  pendingCodeVerifier = codeVerifier;

  openAveSheet({
    clientId: DEMO_CLIENT_ID,
    redirectUri: DEMO_REDIRECT_URI,
    scope: DEMO_SCOPES,
    codeChallenge,
    codeChallengeMethod: "S256",
    onSuccess: async (payload) => {
      console.log("Auth success:", payload);
      await handleAuthCallback(payload.redirectUrl);
    },
    onError: (err) => {
      console.error("Auth error:", err);
      pendingCodeVerifier = null;
    },
    onClose: () => {
      console.log("Sheet closed");
    }
  });
}

async function handleAuthCallback(redirectUrl) {
  try {
    const url = new URL(redirectUrl);
    const code = url.searchParams.get("code");
    
    if (!code) {
      throw new Error("Missing authorization code");
    }

    if (!pendingCodeVerifier) {
      throw new Error("Missing PKCE verifier");
    }
    
    // Exchange code for tokens
    const tokens = await exchangeCode(code, pendingCodeVerifier);
    console.log("Got tokens:", tokens);
    
    // Fetch user info
    const userInfo = await fetchUserInfo(tokens.access_token_jwt || tokens.access_token);
    console.log("User info:", userInfo);
    
    // Store in state
    store.user = {
      accessToken: tokens.access_token_jwt || tokens.access_token,
      refreshToken: tokens.refresh_token,
      userInfo,
    };
    store.activeDemo = null;
    
  } catch (err) {
    console.error("Token exchange failed:", err);
  } finally {
    pendingCodeVerifier = null;
  }
}
