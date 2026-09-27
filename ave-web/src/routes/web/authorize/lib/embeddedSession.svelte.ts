import { get } from "svelte/store";
import { auth } from "$lib/surfaces/web/stores/auth";
import { supportsStorageAccessApi, hasStorageAccess, requestStorageAccess } from "$lib/surfaces/web/lib/storage-access";
import { withTimeout, openAuthPopupHere, fallbackToTopLevelAuthorize } from "./browser";

export function createEmbeddedSession(onPopup: () => void) {
    let needsStorageAccess = $state(false);

    let redirectingToLogin = $state(false);

    let requestingStorageAccess = $state(false);

    let storageAccessError = $state<string | null>(null);

    let storageAccessAttempted = $state(false);

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
            if (initOk) {
                const authState = get(auth);
                if (authState.isAuthenticated) {
                    needsStorageAccess = false;
                    return;
                }
            }

            needsStorageAccess = true;
        } finally {
            requestingStorageAccess = false;
        }
    }

    function continueInBrowser() {
        if (!openAuthPopupHere()) {
            fallbackToTopLevelAuthorize();
            return;
        }
        redirectingToLogin = true;
        needsStorageAccess = false;
        onPopup();
    }

    async function requestStorageAccessFromUserAction() {
        if (requestingStorageAccess) return;
        storageAccessAttempted = true;
        requestingStorageAccess = true;
        needsStorageAccess = false;
        storageAccessError = null;
        try {
            if (!supportsStorageAccessApi()) {
                continueInBrowser();
                return;
            }

            const alreadyHasAccess = (await withTimeout(hasStorageAccess(), 250)) === true;
            const granted = alreadyHasAccess || (await withTimeout(requestStorageAccess(), 1500)) === true;
            if (!granted) {
                continueInBrowser();
                return;
            }

            const initOk = (await withTimeout(auth.init({ timeoutMs: 1200 }), 1500)) !== null;
            if (!initOk) {
                continueInBrowser();
                return;
            }
            const authState = get(auth);
            if (!authState.isAuthenticated) {
                continueInBrowser();
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
    return {
        get needsStorageAccess() { return needsStorageAccess; },
        set needsStorageAccess(value: typeof needsStorageAccess) { needsStorageAccess = value; },
        get redirectingToLogin() { return redirectingToLogin; },
        set redirectingToLogin(value: typeof redirectingToLogin) { redirectingToLogin = value; },
        get requestingStorageAccess() { return requestingStorageAccess; },
        set requestingStorageAccess(value: typeof requestingStorageAccess) { requestingStorageAccess = value; },
        get storageAccessError() { return storageAccessError; },
        set storageAccessError(value: typeof storageAccessError) { storageAccessError = value; },
        get storageAccessAttempted() { return storageAccessAttempted; },
        set storageAccessAttempted(value: typeof storageAccessAttempted) { storageAccessAttempted = value; },
        tryAutoStorageAccess,
        requestStorageAccessFromUserAction,
        handleStorageAccessContinue,
    };
}
