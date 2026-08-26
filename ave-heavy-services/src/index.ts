import { DOMParser, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import webpush from "web-push";
import { SignedXml } from "xml-crypto";

type SamlConnection = {
  id: string;
  entityId: string | null;
  x509Certificate: string | null;
};

type SamlServiceProviderUrls = {
  entityId: string;
  acsUrl: string;
};

type SamlValidationResult = {
  email: string;
  displayName?: string | null;
  nameId?: string | null;
  sessionIndex?: string | null;
};

type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type PushPayload = Record<string, unknown>;

type CredentialDescriptor = {
  id: string;
  transports?: AuthenticatorTransportFuture[];
};

type RegistrationOptionsInput = {
  rpName: string;
  rpId: string;
  userName: string;
  userDisplayName: string;
  userId: string;
  excludeCredentials?: CredentialDescriptor[];
};

type AuthenticationOptionsInput = {
  rpId: string;
  allowCredentials?: CredentialDescriptor[];
};

type RegistrationVerificationInput = {
  response: Parameters<typeof verifyRegistrationResponse>[0]["response"];
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
};

type AuthenticationVerificationInput = {
  response: Parameters<typeof verifyAuthenticationResponse>[0]["response"];
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  credential: {
    id: string;
    publicKeyBase64: string;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
  };
};

const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const SAML_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const SUCCESS_STATUS = "urn:oasis:names:tc:SAML:2.0:status:Success";
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function localName(node: XmlNode | null | undefined): string {
  return (node as XmlElement | null)?.localName || String(node?.nodeName || "").split(":").pop() || "";
}

function textContent(node: XmlNode | null | undefined): string {
  return String(node?.textContent || "").trim();
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function elements(root: XmlNode, name: string, namespace?: string): XmlElement[] {
  const result: XmlElement[] = [];
  const visit = (node: XmlNode) => {
    if (node.nodeType === 1) {
      const element = node as XmlElement;
      if (localName(element) === name && (!namespace || element.namespaceURI === namespace)) result.push(element);
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  };
  visit(root);
  return result;
}

function first(root: XmlNode, name: string, namespace?: string): XmlElement | null {
  return elements(root, name, namespace)[0] || null;
}

function normalizeCertificatePem(value: string | null): string {
  const body = (value || "")
    .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, "")
    .trim();
  if (!body) throw new Error("SAML signing certificate is missing");
  return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)?.join("\n")}\n-----END CERTIFICATE-----`;
}

function isoDate(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid SAML timestamp");
  return timestamp;
}

function assertTimeWindow(notBefore: string | null, notOnOrAfter: string | null): void {
  const now = Date.now();
  const startsAt = isoDate(notBefore);
  const expiresAt = isoDate(notOnOrAfter);
  if (startsAt && now + CLOCK_SKEW_MS < startsAt) throw new Error("SAML assertion is not valid yet");
  if (expiresAt && now - CLOCK_SKEW_MS >= expiresAt) throw new Error("SAML assertion expired");
}

function attributeValue(assertion: XmlElement, names: string[]): string | null {
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

function extractIdentity(assertion: XmlElement): SamlValidationResult {
  const nameId = textContent(first(assertion, "NameID", SAML_NS));
  const email = attributeValue(assertion, [
    "email",
    "mail",
    "emailaddress",
    "email_address",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "urn:oid:0.9.2342.19200300.100.1.3",
  ]) || (nameId.includes("@") ? nameId : "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SAML assertion did not include a usable email");
  }
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

function verifySignature(xml: string, signature: XmlNode, certificatePem: string): string[] {
  const verifier = new SignedXml({
    publicCert: certificatePem,
    getCertFromKeyInfo: () => null,
    implicitTransforms: [
      "http://www.w3.org/2001/10/xml-exc-c14n#",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });
  verifier.loadSignature(signature as Parameters<typeof verifier.loadSignature>[0]);
  if (!verifier.checkSignature(xml)) return [];
  return verifier.getSignedReferences();
}

function signedAssertionFromReference(signedXml: string): { assertion: XmlElement; response: XmlElement | null } | null {
  const root = parseXml(signedXml).documentElement;
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
  assertion: XmlElement;
  response: XmlElement | null;
  rawResponse: XmlElement;
  connection: SamlConnection;
  serviceProviderUrls: SamlServiceProviderUrls;
  expectedRequestId?: string;
}): SamlValidationResult {
  const { assertion, response, rawResponse, connection, expectedRequestId, serviceProviderUrls: urls } = input;
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

function validateSamlResponse(input: {
  encodedResponse: string;
  connection: SamlConnection;
  serviceProviderUrls: SamlServiceProviderUrls;
  expectedRequestId?: string;
}): SamlValidationResult {
  if (input.encodedResponse.length > 1_000_000) throw new Error("SAML response is too large");
  const xml = Buffer.from(input.encodedResponse, "base64").toString("utf8");
  if (!xml.includes("<") || xml.length > 1_000_000) throw new Error("Malformed SAML response");
  const rawResponse = parseXml(xml).documentElement;
  if (!rawResponse || localName(rawResponse) !== "Response") throw new Error("SAML response root is invalid");
  const statusCode = first(rawResponse, "StatusCode", SAML_PROTOCOL_NS);
  if (statusCode?.getAttribute("Value") !== SUCCESS_STATUS) throw new Error("SAML response was not successful");
  const certificatePem = normalizeCertificatePem(input.connection.x509Certificate);
  for (const signature of elements(rawResponse, "Signature", DS_NS)) {
    for (const signedReference of verifySignature(xml, signature, certificatePem)) {
      const signed = signedAssertionFromReference(signedReference);
      if (signed) {
        return validateSignedData({
          ...signed,
          rawResponse,
          connection: input.connection,
          serviceProviderUrls: input.serviceProviderUrls,
          expectedRequestId: input.expectedRequestId,
        });
      }
    }
  }
  throw new Error("SAML signature could not be validated");
}

async function sendPush(input: {
  config: PushConfig;
  subscription: PushSubscription;
  payload: PushPayload;
}): Promise<boolean> {
  webpush.setVapidDetails(input.config.subject, input.config.publicKey, input.config.privateKey);
  try {
    await webpush.sendNotification(input.subscription, JSON.stringify(input.payload), { TTL: 60 * 60, urgency: "high" });
    return true;
  } catch (error: unknown) {
    const statusCode = error && typeof error === "object" && "statusCode" in error
      ? Number(error.statusCode)
      : null;
    if (statusCode === 404 || statusCode === 410) return false;
    console.error(JSON.stringify({ message: "push notification failed", statusCode }));
    return false;
  }
}

function createRegistrationOptions(input: RegistrationOptionsInput) {
  return generateRegistrationOptions({
    rpName: input.rpName,
    rpID: input.rpId,
    userName: input.userName,
    userDisplayName: input.userDisplayName,
    userID: new TextEncoder().encode(input.userId),
    attestationType: "none",
    excludeCredentials: input.excludeCredentials,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
}

function createAuthenticationOptions(input: AuthenticationOptionsInput) {
  return generateAuthenticationOptions({
    rpID: input.rpId,
    allowCredentials: input.allowCredentials || [],
    userVerification: "required",
  });
}

async function verifyRegistration(input: RegistrationVerificationInput) {
  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: input.expectedOrigin,
    expectedRPID: input.expectedRpId,
  });
  if (!verification.verified || !verification.registrationInfo) return { verified: false as const };
  const info = verification.registrationInfo;
  return {
    verified: true as const,
    registrationInfo: {
      credential: {
        id: info.credential.id,
        publicKeyBase64: Buffer.from(info.credential.publicKey).toString("base64"),
        counter: info.credential.counter,
      },
      credentialDeviceType: info.credentialDeviceType,
      credentialBackedUp: info.credentialBackedUp,
      aaguid: info.aaguid,
    },
  };
}

async function verifyAuthentication(input: AuthenticationVerificationInput) {
  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: input.expectedChallenge,
    expectedOrigin: input.expectedOrigin,
    expectedRPID: input.expectedRpId,
    credential: {
      id: input.credential.id,
      publicKey: Buffer.from(input.credential.publicKeyBase64, "base64"),
      counter: input.credential.counter,
      transports: input.credential.transports,
    },
  });
  return {
    verified: verification.verified,
    newCounter: verification.authenticationInfo.newCounter,
    userVerified: verification.authenticationInfo.userVerified,
  };
}

async function readJson<T>(request: Request): Promise<T> {
  if (request.headers.get("content-type") !== "application/json") {
    throw new Error("Expected application/json");
  }
  return request.json<T>();
}

export default {
  async fetch(request): Promise<Response> {
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    try {
      const path = new URL(request.url).pathname;
      if (path === "/saml/validate") {
        return Response.json(validateSamlResponse(await readJson<Parameters<typeof validateSamlResponse>[0]>(request)));
      }
      if (path === "/push/send") {
        return Response.json({ sent: await sendPush(await readJson<Parameters<typeof sendPush>[0]>(request)) });
      }
      if (path === "/webauthn/registration-options") {
        return Response.json(await createRegistrationOptions(await readJson<RegistrationOptionsInput>(request)));
      }
      if (path === "/webauthn/authentication-options") {
        return Response.json(await createAuthenticationOptions(await readJson<AuthenticationOptionsInput>(request)));
      }
      if (path === "/webauthn/verify-registration") {
        return Response.json(await verifyRegistration(await readJson<RegistrationVerificationInput>(request)));
      }
      if (path === "/webauthn/verify-authentication") {
        return Response.json(await verifyAuthentication(await readJson<AuthenticationVerificationInput>(request)));
      }
      return new Response("Not found", { status: 404 });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Heavy service operation failed";
      return Response.json({ error: message }, { status: 400 });
    }
  },
} satisfies ExportedHandler;
