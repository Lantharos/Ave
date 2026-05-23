import { api, type Passkey } from "./api";
import { authenticateWithPasskey, isPlatformAuthenticatorAvailable, registerPasskey } from "./webauthn";
import { encryptMasterKeyWithPrf, loadMasterKey } from "./crypto";

export class PasskeySetupUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasskeySetupUnavailableError";
  }
}

function bytesToBase64url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createLocalAuthenticationOptions(credentialId: string): PublicKeyCredentialRequestOptions {
  return {
    challenge: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
    rpId: window.location.hostname,
    allowCredentials: [
      {
        id: credentialId,
        type: "public-key",
      },
    ],
    userVerification: "required",
    timeout: 60000,
  } as unknown as PublicKeyCredentialRequestOptions;
}

export async function setUpPasskeyForCurrentDevice(name = "New Passkey"): Promise<{
  passkey: Passkey;
  prfStored: boolean;
}> {
  const platformAuthenticatorAvailable = await isPlatformAuthenticatorAvailable();
  if (!platformAuthenticatorAvailable) {
    throw new PasskeySetupUnavailableError("This device can't create a passkey right now.");
  }

  const { options } = await api.security.registerPasskey();
  const { credential, prfSupported, prfOutput } = await registerPasskey(options);
  const masterKey = await loadMasterKey();
  const prfEncryptedMasterKey = masterKey && prfOutput
    ? await encryptMasterKeyWithPrf(masterKey, prfOutput)
    : undefined;

  const result = await api.security.completePasskeyRegistration(
    credential,
    name,
    prfEncryptedMasterKey
  );

  let prfStored = Boolean(prfEncryptedMasterKey);

  if (!prfStored && prfSupported && masterKey) {
    try {
      const authOptions = createLocalAuthenticationOptions(result.passkey.id);
      const { prfOutput: authenticationPrfOutput } = await authenticateWithPasskey(authOptions, true);

      if (authenticationPrfOutput) {
        const encryptedMasterKey = await encryptMasterKeyWithPrf(masterKey, authenticationPrfOutput);
        await api.security.updatePasskeyPrf(result.passkey.id, encryptedMasterKey);
        prfStored = true;
      }
    } catch (error) {
      console.warn("[Passkey] Failed to store PRF key for the new passkey:", error);
    }
  }

  return {
    passkey: result.passkey,
    prfStored,
  };
}
