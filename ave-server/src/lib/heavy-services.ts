import type { OrganizationSsoConnection } from "../db";
import { buildSamlServiceProviderUrls } from "./sso-metadata";

export type HeavyServicesBinding = Env["HEAVY_SERVICES"];

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  tag?: string;
  requireInteraction?: boolean;
};

export type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

type CredentialDescriptor = {
  id: string;
  transports?: AuthenticatorTransport[];
};

export type RegistrationVerification = {
  verified: boolean;
  registrationInfo?: {
    credential: { id: string; publicKeyBase64: string; counter: number };
    credentialDeviceType: "singleDevice" | "multiDevice";
    credentialBackedUp: boolean;
    aaguid: string;
  };
};

async function callHeavyService<T>(service: HeavyServicesBinding, path: string, body: unknown): Promise<T> {
  const response = await service.fetch(`https://ave-heavy-services${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Heavy service operation failed";
    throw new Error(message);
  }
  return result as T;
}

export async function validateSamlResponse(
  service: HeavyServicesBinding,
  input: {
    encodedResponse: string;
    connection: OrganizationSsoConnection;
    expectedRequestId?: string;
  },
): Promise<{
  email: string;
  displayName?: string | null;
  nameId?: string | null;
  sessionIndex?: string | null;
}> {
  return callHeavyService(service, "/saml/validate", {
    ...input,
    serviceProviderUrls: buildSamlServiceProviderUrls(input.connection.id),
  });
}

export async function sendPushNotification(
  service: HeavyServicesBinding,
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<boolean> {
  const config = {
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
    privateKey: process.env.VAPID_PRIVATE_KEY || "",
    subject: process.env.VAPID_SUBJECT || "mailto:support@aveid.net",
  };
  if (!config.publicKey || !config.privateKey) return false;
  const result = await callHeavyService<{ sent: boolean }>(service, "/push/send", { config, subscription, payload });
  return result.sent;
}

export function generatePasskeyRegistrationOptions(
  service: HeavyServicesBinding,
  input: {
    rpName: string;
    rpId: string;
    userName: string;
    userDisplayName: string;
    userId: string;
    excludeCredentials?: CredentialDescriptor[];
  },
): Promise<{ challenge: string; [key: string]: unknown }> {
  return callHeavyService(service, "/webauthn/registration-options", input);
}

export function generatePasskeyAuthenticationOptions(
  service: HeavyServicesBinding,
  input: { rpId: string; allowCredentials?: CredentialDescriptor[] },
): Promise<{ challenge: string; [key: string]: unknown }> {
  return callHeavyService(service, "/webauthn/authentication-options", input);
}

export function verifyPasskeyRegistration(
  service: HeavyServicesBinding,
  input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRpId: string;
  },
): Promise<RegistrationVerification> {
  return callHeavyService(service, "/webauthn/verify-registration", input);
}

export function verifyPasskeyAuthentication(
  service: HeavyServicesBinding,
  input: {
    response: unknown;
    expectedChallenge: string;
    expectedOrigin: string;
    expectedRpId: string;
    credential: {
      id: string;
      publicKeyBase64: string;
      counter: number;
      transports?: AuthenticatorTransport[];
    };
  },
): Promise<{ verified: boolean; newCounter: number; userVerified: boolean }> {
  return callHeavyService(service, "/webauthn/verify-authentication", input);
}
