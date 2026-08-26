import { deflateRawSync } from "node:zlib";
import type { OrganizationSsoConnection } from "../db";
import { randomBase64Url } from "./business-oidc";
import { buildSamlServiceProviderUrls } from "./sso-metadata";

const SAML_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildSamlRedirectUrl(connection: OrganizationSsoConnection, relayState: string) {
  if (!connection.ssoUrl) throw new Error("SAML SSO URL is missing");
  const requestId = `_${randomBase64Url(18)}`;
  const urls = buildSamlServiceProviderUrls(connection.id);
  const requestXml = `<samlp:AuthnRequest xmlns:samlp="${SAML_PROTOCOL_NS}" xmlns:saml="${SAML_NS}" ID="${requestId}" Version="2.0" IssueInstant="${new Date().toISOString()}" Destination="${escapeXml(connection.ssoUrl)}" ProtocolBinding="${POST_BINDING}" AssertionConsumerServiceURL="${escapeXml(urls.acsUrl)}"><saml:Issuer>${escapeXml(urls.entityId)}</saml:Issuer><samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/></samlp:AuthnRequest>`;
  const url = new URL(connection.ssoUrl);
  url.searchParams.set("SAMLRequest", deflateRawSync(Buffer.from(requestXml)).toString("base64"));
  url.searchParams.set("RelayState", relayState);
  return { url: url.toString(), requestId };
}
