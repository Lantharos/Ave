import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import { deflateRawSync } from "node:zlib";
import type { OrganizationSsoConnection } from "../db";
import { buildSamlServiceProviderUrls } from "./sso-metadata";
import { randomBase64Url } from "./business-oidc";

const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const SAML_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";
const SUCCESS_STATUS = "urn:oasis:names:tc:SAML:2.0:status:Success";
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export type SamlValidationResult = {
  email: string;
  displayName?: string | null;
  nameId?: string | null;
  sessionIndex?: string | null;
};

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function localName(node: any) {
  return node?.localName || String(node?.nodeName || "").split(":").pop() || "";
}

function textContent(node: any) {
  return String(node?.textContent || "").trim();
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function elements(root: any, name: string, namespace?: string): any[] {
  const result: any[] = [];
  const visit = (node: any) => {
    if (node?.nodeType === 1 && localName(node) === name && (!namespace || node.namespaceURI === namespace)) result.push(node);
    for (let child = node?.firstChild; child; child = child.nextSibling) visit(child);
  };
  visit(root);
  return result;
}

function first(root: any, name: string, namespace?: string) {
  return elements(root, name, namespace)[0] || null;
}

function normalizeCertificatePem(value: string | null) {
  const body = (value || "")
    .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, "")
    .trim();
  if (!body) throw new Error("SAML signing certificate is missing");
  return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)?.join("\n")}\n-----END CERTIFICATE-----`;
}

function isoDate(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid SAML timestamp");
  return timestamp;
}

function assertTimeWindow(notBefore: string | null, notOnOrAfter: string | null) {
  const now = Date.now();
  const startsAt = isoDate(notBefore);
  const expiresAt = isoDate(notOnOrAfter);
  if (startsAt && now + CLOCK_SKEW_MS < startsAt) throw new Error("SAML assertion is not valid yet");
  if (expiresAt && now - CLOCK_SKEW_MS >= expiresAt) throw new Error("SAML assertion expired");
}

function attributeValue(assertion: any, names: string[]) {
  const allowed = new Set(names.map((name) => name.toLowerCase()));
  for (const attribute of elements(assertion, "Attribute", SAML_NS)) {
    const name = String(attribute.getAttribute("Name") || "").toLowerCase();
    const friendly = String(attribute.getAttribute("FriendlyName") || "").toLowerCase();
    if (!allowed.has(name) && !allowed.has(friendly)) continue;
    const value = first(attribute, "AttributeValue", SAML_NS);
    if (value && textContent(value)) return textContent(value);
  }
  return null;
}

function extractIdentity(assertion: any): SamlValidationResult {
  const nameId = textContent(first(assertion, "NameID", SAML_NS));
  const email = attributeValue(assertion, [
    "email",
    "mail",
    "emailaddress",
    "email_address",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "urn:oid:0.9.2342.19200300.100.1.3",
  ]) || (nameId.includes("@") ? nameId : "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("SAML assertion did not include a usable email");

  const displayName = attributeValue(assertion, [
    "name",
    "displayname",
    "display_name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  ]);
  const authnStatement = first(assertion, "AuthnStatement", SAML_NS);
  return {
    email: email.toLowerCase(),
    displayName,
    nameId: nameId || null,
    sessionIndex: authnStatement?.getAttribute("SessionIndex") || null,
  };
}

function verifySignature(xml: string, signature: any, certificatePem: string) {
  const verifier = new SignedXml({
    publicCert: certificatePem,
    getCertFromKeyInfo: () => null,
    implicitTransforms: [
      "http://www.w3.org/2001/10/xml-exc-c14n#",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });
  verifier.loadSignature(signature);
  if (!verifier.checkSignature(xml)) return [];
  return verifier.getSignedReferences();
}

function signedAssertionFromReference(signedXml: string) {
  const doc = parseXml(signedXml);
  const root = doc.documentElement;
  if (!root) return null;
  if (localName(root) === "Assertion" && root.namespaceURI === SAML_NS) return { assertion: root, response: null };
  if (localName(root) === "Response" && root.namespaceURI === SAML_PROTOCOL_NS) {
    const assertions = elements(root, "Assertion", SAML_NS);
    if (assertions.length !== 1) throw new Error("SAML response must contain exactly one assertion");
    return { assertion: assertions[0], response: root };
  }
  return null;
}

function validateSignedData(input: {
  assertion: any;
  response: any;
  rawResponse: any;
  connection: OrganizationSsoConnection;
  expectedRequestId?: string;
}) {
  const { assertion, response, rawResponse, connection, expectedRequestId } = input;
  const urls = buildSamlServiceProviderUrls(connection.id);
  const responseIssuer = response ? textContent(first(response, "Issuer", SAML_NS)) : "";
  const assertionIssuer = textContent(first(assertion, "Issuer", SAML_NS));
  if (connection.entityId && ![responseIssuer, assertionIssuer].includes(connection.entityId)) {
    throw new Error("SAML issuer mismatch");
  }
  if (response?.getAttribute("Destination") && response.getAttribute("Destination") !== urls.acsUrl) {
    throw new Error("SAML response destination mismatch");
  }

  const conditions = first(assertion, "Conditions", SAML_NS);
  assertTimeWindow(conditions?.getAttribute("NotBefore") || null, conditions?.getAttribute("NotOnOrAfter") || null);
  const audiences = elements(conditions || assertion, "Audience", SAML_NS).map(textContent);
  if (!audiences.includes(urls.entityId)) throw new Error("SAML audience mismatch");

  const confirmationData = first(assertion, "SubjectConfirmationData", SAML_NS);
  if (confirmationData?.getAttribute("Recipient") && confirmationData.getAttribute("Recipient") !== urls.acsUrl) {
    throw new Error("SAML recipient mismatch");
  }
  assertTimeWindow(null, confirmationData?.getAttribute("NotOnOrAfter") || null);

  if (expectedRequestId) {
    const ids = [
      rawResponse?.getAttribute("InResponseTo"),
      response?.getAttribute("InResponseTo"),
      confirmationData?.getAttribute("InResponseTo"),
    ].filter(Boolean);
    if (!ids.includes(expectedRequestId)) throw new Error("SAML InResponseTo mismatch");
  }

  return extractIdentity(assertion);
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

export function validateSamlResponse(input: {
  encodedResponse: string;
  connection: OrganizationSsoConnection;
  expectedRequestId?: string;
}) {
  if (input.encodedResponse.length > 1_000_000) throw new Error("SAML response is too large");
  const xml = Buffer.from(input.encodedResponse, "base64").toString("utf8");
  if (!xml.includes("<") || xml.length > 1_000_000) throw new Error("Malformed SAML response");
  const rawDoc = parseXml(xml);
  const rawResponse = rawDoc.documentElement;
  if (localName(rawResponse) !== "Response") throw new Error("SAML response root is invalid");
  const statusCode = first(rawResponse, "StatusCode", SAML_PROTOCOL_NS);
  if (statusCode?.getAttribute("Value") !== SUCCESS_STATUS) throw new Error("SAML response was not successful");

  const certificatePem = normalizeCertificatePem(input.connection.x509Certificate);
  for (const signature of elements(rawResponse, "Signature", DS_NS)) {
    for (const signedReference of verifySignature(xml, signature, certificatePem)) {
      const signed = signedAssertionFromReference(signedReference);
      if (!signed) continue;
      return validateSignedData({
        assertion: signed.assertion,
        response: signed.response,
        rawResponse,
        connection: input.connection,
        expectedRequestId: input.expectedRequestId,
      });
    }
  }
  throw new Error("SAML signature could not be validated");
}
