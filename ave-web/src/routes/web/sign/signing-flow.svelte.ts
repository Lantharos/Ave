import { api } from "$lib/surfaces/web/lib/api";
import { createSigningKeyForIdentity, signWithIdentityKey } from "$lib/surfaces/web/lib/signing";
import { auth, isAuthenticated } from "$lib/surfaces/web/stores/auth";
import { setReturnUrl } from "$lib/surfaces/web/util/return-url";
import { goto } from "$app/navigation";
import { safeGoto } from "$lib/surfaces/web/util/safe-goto";
import { supportsStorageAccessApi, hasStorageAccess, requestStorageAccess } from "$lib/surfaces/web/lib/storage-access";
import { unlockMasterKeyWithPasskey } from "$lib/surfaces/web/lib/passkeys/master-key-unlock";
import { openEmbedPopup, postToEmbedParent } from "$lib/surfaces/web/util/embed-popup";
import { postMessageTargetOriginForSigning } from "$lib/surfaces/web/util/embed-post-message-origin";
import { fromStore } from "svelte/store";

export function createSigningFlow() {
    const authenticated = fromStore(isAuthenticated);


    function postToEmbedHost(payload: unknown, redirectUri: string | undefined, parentOriginParam: string | null) {
        postToEmbedParent(payload, postMessageTargetOriginForSigning(redirectUri, parentOriginParam));
    }

    function openSigningPopupHere(): boolean {
        return openEmbedPopup(postMessageTargetOriginForSigning(embedRedirectUri, embedParentOrigin), 500, 600);
    }

    async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
        let timer: number | undefined;
        try {
            return await Promise.race([
                promise,
                new Promise<null>((resolve) => {
                    timer = window.setTimeout(() => resolve(null), ms);
                }),
            ]);
        } finally {
            if (timer !== undefined) window.clearTimeout(timer);
        }
    }

    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("requestId");
    const embedRedirectUri = params.get("redirect_uri") || undefined;
    const embedParentOrigin = params.get("parent_origin");
    const embed = params.get("embed") === "1";
    const embedPopup = embed && !!window.opener;
    const embedSheet = embed && !embedPopup;

    let loading = $state(true);
    let signing = $state(false);
    let error = $state<string | null>(null);
    let authRequested = $state(false);
    let needsStorageAccess = $state(false);
    let redirectingToLogin = $state(false);
    let requestingStorageAccess = $state(false);
    let storageAccessError = $state<string | null>(null);
    let storageAccessAttempted = $state(false);

    let needsMasterKey = $state(false);
    let unlockingMasterKey = $state(false);
    let masterKeyError = $state<string | null>(null);

    let request = $state<{
        id: string;
        payload: string;
        metadata?: Record<string, unknown>;
        status: string;
        createdAt: string;
        expiresAt: string;
    } | null>(null);

    let app = $state<{
        id: string;
        name: string;
        iconUrl?: string;
        websiteUrl?: string;
    } | null>(null);

    let identity = $state<{
        id: string;
        handle: string;
        displayName: string;
        avatarUrl?: string | null;
    } | null>(null);

    let signingKey = $state<{
        publicKey: string;
        encryptedPrivateKey: string;
    } | null>(null);

    let needsSigningKey = $state(false);
    let settingUpKey = $state(false);
    let setupError = $state<string | null>(null);

    async function loadRequest() {
        if (!requestId) {
            error = "Missing request ID";
            loading = false;
            return;
        }

        try {
            loading = true;
            const data = await api.signing.getRequest(requestId);

            request = data.request;
            app = data.app;
            identity = data.identity;
            signingKey = data.signingKey;

            needsSigningKey = !data.signingKey;
            setupError = null;

            if (request.status !== "pending") {
                error = `This request has already been ${request.status}`;
            }

            if (request.status === "pending" && !data.signingKey) {
                error = null;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load signature request";
        } finally {
            loading = false;
        }
    }

    async function handleSetupSigningKey() {
        if (!identity) return;
        try {
            settingUpKey = true;
            setupError = null;

            const created = await createSigningKeyForIdentity();
            if (!created) {
                needsMasterKey = true;
                masterKeyError = null;
                setupError = "";
                return;
            }

            await api.signing.createKey(identity.id, created.publicKey, created.encryptedPrivateKey);
            await loadRequest();
        } catch (err) {
            setupError = err instanceof Error ? err.message : "Failed to set up signing key";
        } finally {
            settingUpKey = false;
        }
    }

    async function handleSign() {
        if (!request || !signingKey || !identity) return;

        try {
            signing = true;
            error = null;

            const signature = await signWithIdentityKey(request.payload, signingKey.encryptedPrivateKey);

            if (!signature) {
                needsMasterKey = true;
                masterKeyError = null;
                error = "";
                signing = false;
                return;
            }

            await api.signing.sign(request.id, signature);

            if (embed) {
                postToEmbedHost(
                    {
                        type: "ave:signed",
                        payload: {
                            requestId: request.id,
                            signature,
                            publicKey: signingKey.publicKey,
                        },
                    },
                    embedRedirectUri,
                    embedParentOrigin
                );
                return;
            }

            request = { ...request, status: "signed" };

            setTimeout(() => {
                window.close();
            }, 1500);

        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to sign";
        } finally {
            signing = false;
        }
    }

    async function handleDeny() {
        if (!request) return;

        try {
            signing = true;
            error = null;

            await api.signing.deny(request.id);

            if (embed) {
                postToEmbedHost(
                    { type: "ave:denied", payload: { requestId: request.id } },
                    embedRedirectUri,
                    embedParentOrigin
                );
                return;
            }

            request = { ...request, status: "denied" };

            setTimeout(() => {
                window.close();
            }, 1500);

        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to deny";
        } finally {
            signing = false;
        }
    }

    $effect(() => {
        if (!authenticated.current) {
            if (redirectingToLogin) return;
            if (embedSheet) {
                if (requestingStorageAccess) return;
                if (!storageAccessAttempted) {
                    tryAutoStorageAccess();
                    return;
                }
                needsStorageAccess = true;
                return;
            }
            setReturnUrl(window.location.pathname + window.location.search);
            redirectingToLogin = true;
            safeGoto(goto, "/login");
            return;
        }
        needsStorageAccess = false;
        loadRequest();
    });

    async function tryAutoStorageAccess() {
        if (requestingStorageAccess) return;
        storageAccessAttempted = true;
        requestingStorageAccess = true;
        needsStorageAccess = false;
        storageAccessError = null;
        try {
            const storageSupported = supportsStorageAccessApi();
            const alreadyHasAccess = storageSupported
                ? (await withTimeout(hasStorageAccess(), 250)) === true
                : true;

            if (!alreadyHasAccess) {
                needsStorageAccess = true;
                return;
            }

            const initOk = (await withTimeout(auth.init({ timeoutMs: 1200 }), 1500)) !== null;
            if (initOk && authenticated.current) {
                needsStorageAccess = false;
                return;
            }

            needsStorageAccess = true;
        } finally {
            requestingStorageAccess = false;
        }
    }

    async function requestStorageAccessFromUserAction() {
        if (requestingStorageAccess) return;
        storageAccessAttempted = true;
        requestingStorageAccess = true;
        needsStorageAccess = false;
        storageAccessError = null;
        try {
            if (!supportsStorageAccessApi()) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    fallbackToTopLevelSigning();
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }

            const alreadyHasAccess = (await withTimeout(hasStorageAccess(), 250)) === true;
            const granted = alreadyHasAccess || (await withTimeout(requestStorageAccess(), 1500)) === true;
            if (!granted) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    fallbackToTopLevelSigning();
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }

            const initOk = (await withTimeout(auth.init({ timeoutMs: 1200 }), 1500)) !== null;
            if (!initOk) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    fallbackToTopLevelSigning();
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }
            const authState = authenticated.current;
            if (!authState) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    fallbackToTopLevelSigning();
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }

            needsStorageAccess = false;
        } finally {
            requestingStorageAccess = false;
        }
    }

    function handleStorageAccessContinue() {
        requestStorageAccessFromUserAction();
    }

    function fallbackToTopLevelSigning() {
        if (window.parent !== window) {
            postToEmbedHost({ type: "ave:auth_required" }, embedRedirectUri, embedParentOrigin);
            return;
        }
        const fallbackUrl = new URL(window.location.href);
        fallbackUrl.searchParams.delete("embed");
        window.location.assign(fallbackUrl.toString());
    }

    function formatPayload(payload: string): string {

        try {
            const parsed = JSON.parse(payload);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return payload;
        }
    }

    function isExpired(): boolean {
        if (!request) return false;
        return new Date() > new Date(request.expiresAt);
    }

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
            await loadRequest();
        } finally {
            unlockingMasterKey = false;
        }
    }

    return {
        get needsStorageAccess() { return needsStorageAccess; },
        get app() { return app; },
        get storageAccessError() { return storageAccessError; },
        get requestingStorageAccess() { return requestingStorageAccess; },
        handleStorageAccessContinue,
        get needsMasterKey() { return needsMasterKey; },
        get embedSheet() { return embedSheet; },
        get embedPopup() { return embedPopup; },
        get masterKeyError() { return masterKeyError; },
        get unlockingMasterKey() { return unlockingMasterKey; },
        handleUnlockMasterKey,
        get loading() { return loading; },
        get request() { return request; },
        get error() { return error; },
        get identity() { return identity; },
        formatPayload,
        isExpired,
        get needsSigningKey() { return needsSigningKey; },
        get setupError() { return setupError; },
        handleSetupSigningKey,
        get settingUpKey() { return settingUpKey; },
        handleDeny,
        get signing() { return signing; },
        handleSign,
    };
}
