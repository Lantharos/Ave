import { authenticateWithPasskey } from "$lib/infrastructure/webauthn/passkeys";
import { auth } from "../stores/auth";
import { api } from "./api";
import { decryptMasterKeyWithPrf } from "./crypto";

export async function unlockMasterKeyWithPasskey(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { unlockSessionId, options } = await api.security.unlockMasterKeyStart();
    const { credential, prfOutput } = await authenticateWithPasskey(options);

    if (!prfOutput) {
      return { ok: false, error: "Passkey PRF isn't available on this device/browser." };
    }

    const { prfEncryptedMasterKey, identityIds } = await api.security.unlockMasterKeyFinish({
      unlockSessionId,
      credential,
    });

    const masterKey = await decryptMasterKeyWithPrf(prfEncryptedMasterKey, prfOutput);
    try {
      await auth.setMasterKey(masterKey, identityIds);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Couldn't store the encryption key in this context." };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to unlock encryption key";
    return { ok: false, error: message };
  }
}
