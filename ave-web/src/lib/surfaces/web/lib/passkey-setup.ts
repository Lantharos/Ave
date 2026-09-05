import { authenticateWithPasskey, createLocalAuthenticationOptions, isWebAuthnSupported, registerPasskey } from "$lib/infrastructure/webauthn/passkeys";
import { api, type Passkey } from "./api";
import { encryptMasterKeyWithPrf, loadMasterKey } from "./crypto";

export class PasskeySetupUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasskeySetupUnavailableError";
  }
}

export async function setUpPasskeyForCurrentDevice(name = "New Passkey"): Promise<{
  passkey: Passkey;
  prfStored: boolean;
}> {
  const passkeysAvailable = isWebAuthnSupported();
  if (!passkeysAvailable) {
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
      const { prfOutput: authenticationPrfOutput } = await authenticateWithPasskey(authOptions);

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
