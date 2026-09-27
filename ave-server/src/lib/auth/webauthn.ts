import { loadWebAuthn } from "../../optional-modules";
import type {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  AuthenticatorTransport,
} from "@simplewebauthn/server";
export type { AuthenticatorTransport } from "@simplewebauthn/server";

type CredentialDescriptor = {
  id: string;
  transports?: AuthenticatorTransport[];
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
    transports?: AuthenticatorTransport[];
  };
};

export async function generatePasskeyRegistrationOptions(input: RegistrationOptionsInput) {
  const { generateRegistrationOptions } = await loadWebAuthn();
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

export async function generatePasskeyAuthenticationOptions(input: AuthenticationOptionsInput) {
  const { generateAuthenticationOptions } = await loadWebAuthn();
  return generateAuthenticationOptions({
    rpID: input.rpId,
    allowCredentials: input.allowCredentials || [],
    userVerification: "required",
  });
}

export async function verifyPasskeyRegistration(input: RegistrationVerificationInput) {
  const { verifyRegistrationResponse } = await loadWebAuthn();
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

export async function verifyPasskeyAuthentication(input: AuthenticationVerificationInput) {
  const { verifyAuthenticationResponse } = await loadWebAuthn();
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


export type RegistrationVerification = Awaited<ReturnType<typeof verifyPasskeyRegistration>>;
