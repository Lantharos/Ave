import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/browser";

type PasskeyResponse = AuthenticationResponseJSON | RegistrationResponseJSON;

export function credentialForVerification<T extends PasskeyResponse>(credential: T): T {
  const extensions = credential.clientExtensionResults as PasskeyResponse["clientExtensionResults"] & {
    prf?: { enabled?: boolean };
  };
  if (!extensions.prf) return credential;

  return {
    ...credential,
    clientExtensionResults: {
      ...extensions,
      prf: { enabled: extensions.prf.enabled },
    },
  };
}
