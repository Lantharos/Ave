import type { OrganizationSsoConnection } from "../db";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getBusinessBaseUrl(): string {
  return process.env.BUSINESS_ORIGIN || "https://business.aveid.net";
}

export function getApiBaseUrl(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

export function buildSamlServiceProviderUrls(connectionId: string) {
  const apiBase = getApiBaseUrl();
  return {
    entityId: `${apiBase}/api/business/sso/saml/${connectionId}/metadata.xml`,
    acsUrl: `${apiBase}/api/business/sso/saml/${connectionId}/acs`,
    metadataUrl: `${apiBase}/api/business/sso/saml/${connectionId}/metadata.xml`,
  };
}

export function buildSamlServiceProviderMetadata(connection: OrganizationSsoConnection): string {
  const urls = buildSamlServiceProviderUrls(connection.id);
  const entityId = escapeXml(urls.entityId);
  const acsUrl = escapeXml(urls.acsUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

export function serializeSsoConnection(connection: OrganizationSsoConnection) {
  const samlUrls = connection.type === "saml" ? buildSamlServiceProviderUrls(connection.id) : null;

  return {
    id: connection.id,
    type: connection.type,
    provider: connection.provider,
    name: connection.name,
    domain: connection.domain,
    status: connection.status,
    metadataUrl: connection.metadataUrl,
    entityId: connection.entityId,
    ssoUrl: connection.ssoUrl,
    issuer: connection.issuer,
    authorizationEndpoint: connection.authorizationEndpoint,
    tokenEndpoint: connection.tokenEndpoint,
    jwksUri: connection.jwksUri,
    clientId: connection.clientId,
    attributeMappings: connection.attributeMappings || {},
    keyAccessMode: connection.keyAccessMode,
    e2eeSupported: false,
    e2eeNote: "Enterprise SSO authenticates organization access only. Encrypted org keys require Ave identity key grants.",
    saml: samlUrls,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}
