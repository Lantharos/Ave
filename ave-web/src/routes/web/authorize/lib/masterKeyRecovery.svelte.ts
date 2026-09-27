import { untrack } from "svelte";
import { api, type Identity } from "$lib/surfaces/web/lib/api";
import { generateEphemeralKeyPair, recoverMasterKeyFromBackup } from "$lib/surfaces/web/lib/crypto";
import { auth } from "$lib/surfaces/web/stores/auth";
import { unlockMasterKeyWithPasskey } from "$lib/surfaces/web/lib/passkeys/master-key-unlock";
import { getDeviceInfo } from "$lib/infrastructure/browser/device";

export function createMasterKeyRecovery(getIdentity: () => Identity | null, onRecovered: () => Promise<void>) {
    let needsMasterKey = $state(false);

    let unlockingMasterKey = $state(false);

    let masterKeyUnlockView = $state<"options" | "device" | "recovery">("options");

    let hasTrustedDevices = $state(false);

    let loadingTrustedDevices = $state(false);

    let masterKeyLoginRequestId = $state<string | null>(null);

    let masterKeyLoginRequestToken = $state<string | null>(null);

    let masterKeyEphemeralKeyPair = $state<{ publicKey: string; privateKey: CryptoKey } | null>(null);

    let requestingDeviceApproval = $state(false);

    let recoveringMasterKey = $state(false);

    let recoveryCode = $state("");

    let masterKeyError = $state<string | null>(null);

    let masterKeyMismatch = $state(false);

    async function loadTrustedDevices() {
        if (!needsMasterKey || loadingTrustedDevices) return;
        loadingTrustedDevices = true;
        try {
            const { devices } = await api.devices.list();
            hasTrustedDevices = devices.length > 0;
        } catch {
            hasTrustedDevices = false;
        } finally {
            loadingTrustedDevices = false;
        }
    }

    $effect(() => {
        if (!needsMasterKey) return;
        masterKeyUnlockView = "options";
        masterKeyLoginRequestId = null;
        masterKeyEphemeralKeyPair = null;
        recoveryCode = "";
        if (!masterKeyMismatch) {
            masterKeyError = null;
        }
        untrack(() => { void loadTrustedDevices(); });
    });

    async function handleUnlockMasterKey() {
        if (unlockingMasterKey) return;
        unlockingMasterKey = true;
        masterKeyError = null;
        try {
            const result = await unlockMasterKeyWithPasskey();
            if (!result.ok) {
                masterKeyError = result.error;
                return;
            }
            needsMasterKey = false;
            masterKeyMismatch = false;
            await onRecovered();
        } finally {
            unlockingMasterKey = false;
        }
    }

    async function handleMasterKeyDeviceApproval() {
        const selectedIdentity = getIdentity();
        if (!selectedIdentity?.handle || requestingDeviceApproval) return;
        requestingDeviceApproval = true;
        masterKeyError = null;
        try {
            const keyPair = await generateEphemeralKeyPair();
            masterKeyEphemeralKeyPair = keyPair;
            const result = await api.login.requestApproval({
                handle: selectedIdentity.handle,
                requesterPublicKey: keyPair.publicKey,
                device: getDeviceInfo(),
            });
            masterKeyLoginRequestId = result.requestId;
            masterKeyLoginRequestToken = result.requestToken;
            masterKeyUnlockView = "device";
        } catch (err) {
            masterKeyError = err instanceof Error ? err.message : "Failed to request device approval";
        } finally {
            requestingDeviceApproval = false;
        }
    }

    async function handleMasterKeyRecovered() {
        needsMasterKey = false;
        masterKeyMismatch = false;
        masterKeyUnlockView = "options";
        await onRecovered();
    }

    async function handleRecoveryCodeSubmit() {
        const selectedIdentity = getIdentity();
        if (!selectedIdentity?.handle || !recoveryCode.trim() || recoveringMasterKey) return;
        recoveringMasterKey = true;
        masterKeyError = null;
        try {
            const result = await api.login.recoverKey({
                handle: selectedIdentity.handle,
                code: recoveryCode.trim(),
            });
            const masterKey = await recoverMasterKeyFromBackup(
                result.encryptedMasterKeyBackup,
                recoveryCode.trim(),
            );
            if (!masterKey) {
                masterKeyError = "That recovery code didn't work. Check it and try again.";
                return;
            }
            await auth.setMasterKey(masterKey, [result.identityId]);
            await handleMasterKeyRecovered();
        } catch (err) {
            masterKeyError = err instanceof Error ? err.message : "Invalid recovery code";
        } finally {
            recoveringMasterKey = false;
        }
    }
    return {
        get needsMasterKey() { return needsMasterKey; },
        set needsMasterKey(value: typeof needsMasterKey) { needsMasterKey = value; },
        get unlockingMasterKey() { return unlockingMasterKey; },
        set unlockingMasterKey(value: typeof unlockingMasterKey) { unlockingMasterKey = value; },
        get masterKeyUnlockView() { return masterKeyUnlockView; },
        set masterKeyUnlockView(value: typeof masterKeyUnlockView) { masterKeyUnlockView = value; },
        get hasTrustedDevices() { return hasTrustedDevices; },
        set hasTrustedDevices(value: typeof hasTrustedDevices) { hasTrustedDevices = value; },
        get loadingTrustedDevices() { return loadingTrustedDevices; },
        set loadingTrustedDevices(value: typeof loadingTrustedDevices) { loadingTrustedDevices = value; },
        get masterKeyLoginRequestId() { return masterKeyLoginRequestId; },
        set masterKeyLoginRequestId(value: typeof masterKeyLoginRequestId) { masterKeyLoginRequestId = value; },
        get masterKeyLoginRequestToken() { return masterKeyLoginRequestToken; },
        set masterKeyLoginRequestToken(value: typeof masterKeyLoginRequestToken) { masterKeyLoginRequestToken = value; },
        get masterKeyEphemeralKeyPair() { return masterKeyEphemeralKeyPair; },
        set masterKeyEphemeralKeyPair(value: typeof masterKeyEphemeralKeyPair) { masterKeyEphemeralKeyPair = value; },
        get requestingDeviceApproval() { return requestingDeviceApproval; },
        set requestingDeviceApproval(value: typeof requestingDeviceApproval) { requestingDeviceApproval = value; },
        get recoveringMasterKey() { return recoveringMasterKey; },
        set recoveringMasterKey(value: typeof recoveringMasterKey) { recoveringMasterKey = value; },
        get recoveryCode() { return recoveryCode; },
        set recoveryCode(value: typeof recoveryCode) { recoveryCode = value; },
        get masterKeyError() { return masterKeyError; },
        set masterKeyError(value: typeof masterKeyError) { masterKeyError = value; },
        get masterKeyMismatch() { return masterKeyMismatch; },
        set masterKeyMismatch(value: typeof masterKeyMismatch) { masterKeyMismatch = value; },
        loadTrustedDevices,
        handleUnlockMasterKey,
        handleMasterKeyDeviceApproval,
        handleMasterKeyRecovered,
        handleRecoveryCodeSubmit,
    };
}
