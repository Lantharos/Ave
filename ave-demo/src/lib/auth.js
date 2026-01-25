import { openAveSheet, openAvePopup, openAveSigningSheet } from "@ave-id/embed";
import { DEMO_CLIENT_ID, DEMO_REDIRECT_URI, DEMO_SCOPES } from "./config.js";
import { store } from "./store.svelte.js";

export function tryPopupAuth() {
  openAvePopup({
    clientId: DEMO_CLIENT_ID,
    redirectUri: DEMO_REDIRECT_URI,
    scope: DEMO_SCOPES,
    onSuccess: (payload) => {
      console.log("Auth success:", payload);
      // The embed returns a redirectUrl - for demo purposes we just mark as logged in
      // In a real app, you'd follow the redirect to exchange the code for tokens
      store.user = { method: "popup", redirectUrl: payload.redirectUrl };
      store.activeDemo = null;
    },
    onError: (err) => {
      console.error("Auth error:", err);
    },
    onClose: () => {
      console.log("Popup closed");
    }
  });
}

export function trySheetAuth() {
  openAveSheet({
    clientId: DEMO_CLIENT_ID,
    redirectUri: DEMO_REDIRECT_URI,
    scope: DEMO_SCOPES,
    onSuccess: (payload) => {
      console.log("Auth success:", payload);
      // The embed returns a redirectUrl - for demo purposes we just mark as logged in
      // In a real app, you'd follow the redirect to exchange the code for tokens
      store.user = { method: "sheet", redirectUrl: payload.redirectUrl };
      store.activeDemo = null;
    },
    onError: (err) => {
      console.error("Auth error:", err);
    },
    onClose: () => {
      console.log("Sheet closed");
    }
  });
}

export function trySigningDemo() {
  // In a real app, you'd create the request server-side first
  // For the demo, we'll show the UI concept
  openAveSigningSheet({
    requestId: "demo-request-id",
    onSigned: (result) => {
      store.signResult = result;
      console.log("Signed:", result);
    },
    onDenied: () => {
      store.signResult = { denied: true };
      console.log("Denied");
    },
    onClose: () => {
      console.log("Signing closed");
    }
  });
}
