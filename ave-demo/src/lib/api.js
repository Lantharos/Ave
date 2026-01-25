import { API_BASE, DEMO_CLIENT_ID, DEMO_REDIRECT_URI } from "./config.js";

export async function exchangeCode(code, codeVerifier) {
  const body = {
    grantType: "authorization_code",
    code,
    redirectUri: DEMO_REDIRECT_URI,
    clientId: DEMO_CLIENT_ID,
  };

  body.codeVerifier = codeVerifier;

  const response = await fetch(`${API_BASE}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to exchange token");
  }

  return response.json();
}

export async function fetchUserInfo(accessToken) {
  const response = await fetch(`${API_BASE}/api/oauth/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  return response.json();
}

export async function createDemoSigningRequest(accessToken, payload) {
  const response = await fetch(`${API_BASE}/api/signing/demo/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ payload }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to create signing request");
  }

  return response.json();
}
