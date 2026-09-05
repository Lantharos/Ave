import { createPopupFlow, createSheetFlow, DEFAULT_ISSUER, flowUrl } from "./browser.js";

function connectorFlow({ clientId, redirectUri, resource, scope = "resource.access", mode = "user_present", issuer = DEFAULT_ISSUER, onSuccess, onError, onClose, width = 460, height = 700 }) {
  return {
    url: flowUrl(issuer, "/connect", { client_id: clientId, redirect_uri: redirectUri, resource, scope, mode }),
    issuer,
    handlers: { "ave:success": onSuccess, "ave:error": onError },
    onError,
    onClose,
    width,
    height,
    redirectOnPopupBlocked: true,
  };
}

export function openAveConnectorSheet(options) {
  return createSheetFlow(connectorFlow(options));
}

export function openAveConnectorPopup(options) {
  return createPopupFlow(connectorFlow(options));
}

function signingFlow({ requestId, issuer = DEFAULT_ISSUER, onSigned, onDenied, onClose, width = 500, height = 600 }) {
  return {
    url: flowUrl(issuer, "/sign", { requestId, parent_origin: window.location.origin }),
    issuer,
    handlers: { "ave:signed": onSigned, "ave:denied": onDenied, "ave:error": onDenied },
    onError: onDenied,
    onClose,
    width,
    height,
    signing: true,
  };
}

export function openAveSigningSheet(options) {
  return createSheetFlow(signingFlow(options));
}

export function openAveSigningPopup(options) {
  return createPopupFlow(signingFlow(options));
}
