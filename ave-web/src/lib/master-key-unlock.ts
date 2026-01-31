import { api } from "./api";
import { decryptMasterKeyWithPrf, storeMasterKey } from "./crypto";
import { authenticateWithPasskey } from "./webauthn";

export async function unlockMasterKeyWithPasskey(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { unlockSessionId, options } = await api.security.unlockMasterKeyStart();
    const { credential, prfOutput } = await authenticateWithPasskey(options, true);

    if (!prfOutput) {
      return { ok: false, error: "Passkey PRF isn't available on this device/browser." };
    }

    const { prfEncryptedMasterKey } = await api.security.unlockMasterKeyFinish({
      unlockSessionId,
      credential,
    });

    const masterKey = await decryptMasterKeyWithPrf(prfEncryptedMasterKey, prfOutput);
    try {
      await storeMasterKey(masterKey);
    } catch {
      return { ok: false, error: "Couldn't store the encryption key in this context." };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to unlock encryption key";
    return { ok: false, error: message };
  }
}
