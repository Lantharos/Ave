import { createEmbeddedSession } from "./lib/embeddedSession.svelte";
import { createMasterKeyRecovery } from "./lib/masterKeyRecovery.svelte";
import { prepareAuthorizationEncryption } from "./lib/prepare-authorization-encryption";
import { isCustomSchemeRedirect, postToEmbedHost } from "./lib/browser";
import { parseAuthorizationParams } from "./lib/params";
import { api, type Identity, type OAuthAuthorization } from "$lib/surfaces/web/lib/api";
import {
    resolveActiveMasterKey,
} from "$lib/surfaces/web/lib/crypto";
import {
    authorizeFlowShowsE2ee,
    hasE2eeResetScope,
    hasUserIdScope,
} from "$lib/surfaces/web/lib/oauth/e2ee-scopes";
import { parseOAuthScopes } from "$lib/surfaces/web/lib/oauth/scopes";
import {
    parseOAuthPrompt,
    requiresAuthorizeInteractionPrompt,
    wantsAccountPickerPrompt,
} from "$lib/surfaces/web/lib/oauth/prompt";
import { auth, isAuthenticated, isLoading } from "$lib/surfaces/web/stores/auth";
import { setReturnUrl } from "$lib/surfaces/web/util/return-url";
import { goto } from "$app/navigation";
import { safeGoto } from "$lib/surfaces/web/util/safe-goto";
import { get } from "svelte/store";
import { fromStore } from "svelte/store";

export function createAuthorizationFlow() {
    const embeddedSession = createEmbeddedSession(() => { completed = true; });
    const masterKeyRecovery = createMasterKeyRecovery(() => selectedIdentity, () => handleAuthorize("instant"));
    const authLoading = fromStore(isLoading);
    const authenticated = fromStore(isAuthenticated);

    let querystring = $state(window.location.search.slice(1));

    $effect(() => {
        const updateQuery = () => {
            querystring = window.location.search.slice(1);
        };
        window.addEventListener('popstate', updateQuery);
        return () => window.removeEventListener('popstate', updateQuery);
    });

    let params = $derived(parseAuthorizationParams(querystring || ""));

    const oauthPrompts = $derived.by(() => parseOAuthPrompt(params.prompt));
    const forceAuthorizePrompt = $derived(requiresAuthorizeInteractionPrompt(oauthPrompts));
    const wantsSelectAccount = $derived(wantsAccountPickerPrompt(oauthPrompts));

    const requiresEmailScope = $derived.by(() => parseOAuthScopes(params.scope).includes("email"));
    const selectedIdentityNeedsEmail = $derived.by(() => Boolean(selectedIdentity && requiresEmailScope && !selectedIdentity.email));
    const authorizeRequestedScopes = $derived.by(() => parseOAuthScopes(params.scope));
    const wantsUserIdScope = $derived(hasUserIdScope(authorizeRequestedScopes));

    let appInfo = $state<{
        name: string;
        description?: string;
        iconUrl?: string;
        websiteUrl?: string;
        supportsE2ee: boolean;
        allowedScopes?: string[];
    } | null>(null);

    const authorizeShowsE2ee = $derived.by(() =>
        appInfo ? authorizeFlowShowsE2ee(appInfo, authorizeRequestedScopes) : false,
    );

    let appAuthorizations = $state.raw<OAuthAuthorization[]>([]);
    let existingAuth = $state.raw<OAuthAuthorization | null>(null);

    let selectedIdentity = $state<Identity | null>(null);
    let identityDropdownOpen = $state(false);
    let loading = $state(true);
    let authorizing = $state(false);
    let autoAuthorizing = $state(false);
    let completed = $state(false);
    let error = $state<string | null>(null);
    let emailDraft = $state("");
    let emailCode = $state("");
    let emailSubmitting = $state(false);
    let launchedExternalApp = $state(false);
    let loadingAppInfo = $state(false);
    let resolvedAppInfo = $state(false);
    let authorizeBootstrapClientId = $state<string | null>(null);
    let resolvedAuthorizeBootstrapClientId = $state<string | null>(null);
    let retryingCookieSession = $state(false);
    let attemptedCookieSessionRetry = $state(false);

    const embedPopup = $derived.by(() => params.embed && !!window.opener);
    const embedSheet = $derived.by(() => params.embed && !embedPopup);

    function promptMasterKeyRecovery(syncIssue: boolean) {
        masterKeyRecovery.masterKeyMismatch = syncIssue;
        masterKeyRecovery.needsMasterKey = true;
        authorizing = false;
    }

    function appDisplayName() {
        return appInfo?.name || "this app";
    }

    function syncSelectedIdentity(identity: Identity) {
        auth.updateIdentity(identity);
        selectedIdentity = identity;
        emailDraft = identity.pendingEmail || identity.email || "";
    }

    function selectIdentity(identity: Identity) {
        auth.setCurrentIdentity(identity);
        selectedIdentity = identity;
        existingAuth = appAuthorizations.find((authorization) =>
            authorization.identityId === identity.id
        ) || null;
        emailDraft = identity.pendingEmail || identity.email || "";
        emailCode = "";
        identityDropdownOpen = false;
    }

    async function ensureAppInfo() {
        if (!params.clientId || appInfo || loadingAppInfo || resolvedAppInfo) {
            return;
        }

        loadingAppInfo = true;
        try {
            const appData = await api.oauth.getApp(params.clientId);
            appInfo = appData.app;
        } catch (err) {
            console.warn("[Authorize] Failed to load app info early.", err);
        } finally {
            loadingAppInfo = false;
            resolvedAppInfo = true;
        }
    }

    async function loadAppInfo() {
        if (completed) return;
        const clientId = params.clientId;

        if (!clientId) {
            error = "Missing client_id parameter";
            loading = false;
            return;
        }

        if (authorizeBootstrapClientId === clientId || resolvedAuthorizeBootstrapClientId === clientId) {
            return;
        }

        authorizeBootstrapClientId = clientId;
        loading = true;
        error = null;

        try {
            const bootstrap = await api.oauth.getAuthorizeBootstrap(
                clientId,
            );

            appInfo = bootstrap.app;
            appAuthorizations = bootstrap.authorizations;
            launchedExternalApp = false;

            let hasLocalMasterKey = true;
            if (authorizeFlowShowsE2ee(bootstrap.app, authorizeRequestedScopes)) {
                hasLocalMasterKey = !!(await resolveActiveMasterKey(get(auth).masterKey));
                masterKeyRecovery.needsMasterKey = !hasLocalMasterKey;
                masterKeyRecovery.masterKeyMismatch = false;
            }

            const authState = get(auth);
            const preferredIdentity = params.identityId
                ? authState.identities.find((i) => i.id === params.identityId) || null
                : null;
            const latestAuthorization = appAuthorizations[0] || null;
            const existingIdentity = latestAuthorization
                ? authState.identities.find((i) => i.id === latestAuthorization.identityId)
                : null;

            selectedIdentity = preferredIdentity
                || (!wantsSelectAccount ? existingIdentity : null)
                || authState.currentIdentity
                || authState.identities[0]
                || null;
            existingAuth = selectedIdentity
                ? appAuthorizations.find((authorization) =>
                    authorization.identityId === selectedIdentity!.id
                ) || null
                : null;
            emailDraft = selectedIdentity?.pendingEmail || selectedIdentity?.email || "";

            const grantedScopes = new Set(parseOAuthScopes(existingAuth?.scope ?? ""));
            const shouldAutoAuthorize = !forceAuthorizePrompt
                && !hasE2eeResetScope(authorizeRequestedScopes)
                && !!existingAuth
                && authorizeRequestedScopes.every((scope) => grantedScopes.has(scope))
                && !!existingIdentity
                && (!authorizeFlowShowsE2ee(bootstrap.app, authorizeRequestedScopes) || hasLocalMasterKey);

            if (shouldAutoAuthorize && !(requiresEmailScope && !selectedIdentity?.email)) {

                autoAuthorizing = true;
                await handleAuthorize("instant");

                if (!completed) {
                    autoAuthorizing = false;
                }
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load app info";
        } finally {
            if (authorizeBootstrapClientId === clientId) {
                resolvedAuthorizeBootstrapClientId = clientId;
                authorizeBootstrapClientId = null;
            }
            if (!completed) {
                loading = false;
            }
        }
    }

    async function handleAuthorize(interactionMode: "instant" | "prompt" = "prompt") {
        if (!selectedIdentity || !appInfo) return;

        try {
            authorizing = true;
            error = null;

            const authData: Parameters<typeof api.oauth.authorize>[0] = {
                clientId: params.clientId,
                redirectUri: params.redirectUri,
                scope: params.scope,
                state: params.state,
                identityId: selectedIdentity.id,
                nonce: params.nonce || undefined,
                interactionMode,
            };

            if (params.codeChallenge) {
                authData.codeChallenge = params.codeChallenge;
            }
            if (params.codeChallengeMethod) {
                authData.codeChallengeMethod = params.codeChallengeMethod;
            }

            const encryption = await prepareAuthorizationEncryption({
                requestedScopes: authorizeRequestedScopes,
                app: appInfo,
                existingAuthorization: existingAuth,
                identityId: selectedIdentity.id,
                sessionMasterKey: get(auth).masterKey,
            });
            if (encryption.status === "master-key-required") {
                masterKeyRecovery.needsMasterKey = true;
                masterKeyRecovery.masterKeyError = null;
                authorizing = false;
                return;
            }
            if (encryption.status === "master-key-recovery-required") {
                promptMasterKeyRecovery(true);
                return;
            }
            if (encryption.status === "error") {
                error = encryption.message;
                authorizing = false;
                return;
            }

            Object.assign(authData, encryption.authorization);
            const {
                appKey: rawAppKey,
                appKeyOld: rawAppKeyOld,
                appPublicKey: rawAppPublicKey,
                appPublicKeyOld: rawAppPublicKeyOld,
                appPrivateKey: rawAppPrivateKey,
                appPrivateKeyOld: rawAppPrivateKeyOld,
                reset: wantsE2eeReset,
            } = encryption.redirect;

            const result = await api.oauth.authorize(authData);

            let redirectUrl = result.redirectUrl;
            const hashParams = new URLSearchParams();
            if (rawAppKey) hashParams.set("app_key", rawAppKey);
            if (rawAppKeyOld) hashParams.set("app_key_old", rawAppKeyOld);
            if (rawAppPublicKey) hashParams.set("app_public_key", rawAppPublicKey);
            if (rawAppPublicKeyOld) hashParams.set("app_public_key_old", rawAppPublicKeyOld);
            if (rawAppPrivateKey) hashParams.set("app_private_key", rawAppPrivateKey);
            if (rawAppPrivateKeyOld) hashParams.set("app_private_key_old", rawAppPrivateKeyOld);
            if (wantsE2eeReset) hashParams.set("app_key_reset", "true");
            if (hashParams.toString()) {
                const url = new URL(redirectUrl);
                url.hash = hashParams.toString();
                redirectUrl = url.toString();
            }
            if (params.embed) {
                postToEmbedHost(params.redirectUri, {
                    type: "ave:success",
                    payload: { redirectUrl },
                });
                completed = true;
                authorizing = false;
                if (window.opener) {
                    setTimeout(() => window.close(), 50);
                }
                return;
            }
            launchedExternalApp = isCustomSchemeRedirect(redirectUrl);
            completed = true;
            window.location.href = redirectUrl;

        } catch (err: unknown) {
            if (err instanceof Error && err.message === "Request timed out") {
                error = "Signing in is taking too long. Please try again.";
            } else if (
                err instanceof Error &&
                /operation-specific reason|OperationError/i.test(err.message)
            ) {
                error = "Could not process app encryption for this sign-in. Please try again.";
            } else {
                error = err instanceof Error ? err.message : "Authorization failed";
            }
            authorizing = false;
        }
    }

    async function handleStartEmailVerification() {
        if (!selectedIdentity || !emailDraft.trim()) return;

        emailSubmitting = true;
        error = null;
        try {
            const { identity } = await api.identities.startEmailVerification(selectedIdentity.id, emailDraft.trim());
            syncSelectedIdentity(identity);
            emailCode = "";
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to send verification code";
        } finally {
            emailSubmitting = false;
        }
    }

    async function handleVerifyEmail() {
        if (!selectedIdentity || emailCode.trim().length !== 6) return;

        emailSubmitting = true;
        error = null;
        try {
            const { identity } = await api.identities.verifyEmail(selectedIdentity.id, emailCode.trim());
            syncSelectedIdentity(identity);
            emailCode = "";
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to verify email";
        } finally {
            emailSubmitting = false;
        }
    }

    async function handleResendEmailVerification() {
        if (!selectedIdentity) return;

        emailSubmitting = true;
        error = null;
        try {
            const { identity } = await api.identities.resendEmailVerification(selectedIdentity.id);
            syncSelectedIdentity(identity);
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to resend verification code";
        } finally {
            emailSubmitting = false;
        }
    }

    function handleDeny() {
        const redirectUrl = new URL(params.redirectUri);
        redirectUrl.searchParams.set("error", "access_denied");
        if (params.state) {
            redirectUrl.searchParams.set("state", params.state);
        }

        if (params.embed) {
            postToEmbedHost(params.redirectUri, { type: "ave:error", payload: { error: "access_denied" } });
            completed = true;
            if (window.opener) {
                setTimeout(() => window.close(), 50);
            }
            return;
        }
        window.location.href = redirectUrl.toString();

    }

    async function retryCookieSessionBeforeLogin() {
        if (retryingCookieSession || attemptedCookieSessionRetry) return;
        attemptedCookieSessionRetry = true;
        retryingCookieSession = true;
        try {
            await auth.init({ timeoutMs: 7000 });
        } finally {
            retryingCookieSession = false;
        }
    }

    $effect(() => {
        if (resolvedAuthorizeBootstrapClientId && resolvedAuthorizeBootstrapClientId !== params.clientId) {
            resolvedAuthorizeBootstrapClientId = null;
            authorizeBootstrapClientId = null;
            appAuthorizations = [];
            existingAuth = null;
            appInfo = null;
        }
        if (completed) return;
        if (!authenticated.current) {
            if (authLoading.current || retryingCookieSession) return;
            void ensureAppInfo();
            if (!attemptedCookieSessionRetry && !embedSheet) {
                void retryCookieSessionBeforeLogin();
                return;
            }
            if (embeddedSession.redirectingToLogin) return;
            if (embedSheet) {
                if (embeddedSession.requestingStorageAccess) return;
                if (!embeddedSession.storageAccessAttempted) {
                    embeddedSession.tryAutoStorageAccess();
                    return;
                }
                if (!resolvedAppInfo && !appInfo) {
                    return;
                }
                embeddedSession.needsStorageAccess = true;
                return;
            }

            setReturnUrl(window.location.pathname + window.location.search);
            embeddedSession.redirectingToLogin = true;
            if (params.embed) {
                postToEmbedHost(params.redirectUri, { type: "ave:auth_required" });
            }
            safeGoto(goto, "/login");
            return;
        }

        loadAppInfo();
    });

    return {
        embeddedSession,
        masterKeyRecovery,
        get embedSheet() { return embedSheet; },
        get resolvedAppInfo() { return resolvedAppInfo; },
        get appInfo() { return appInfo; },
        appDisplayName,
        get autoAuthorizing() { return autoAuthorizing; },
        get launchedExternalApp() { return launchedExternalApp; },
        get loading() { return loading; },
        get completed() { return completed; },
        handleDeny,
        get authorizing() { return authorizing; },
        get authorizeShowsE2ee() { return authorizeShowsE2ee; },
        get authorizeRequestedScopes() { return authorizeRequestedScopes; },
        get existingAuth() { return existingAuth; },
        get wantsUserIdScope() { return wantsUserIdScope; },
        get error() { return error; },
        get selectedIdentity() { return selectedIdentity; },
        get identityDropdownOpen() { return identityDropdownOpen; },
        set identityDropdownOpen(value: typeof identityDropdownOpen) { identityDropdownOpen = value; },
        selectIdentity,
        get selectedIdentityNeedsEmail() { return selectedIdentityNeedsEmail; },
        get emailCode() { return emailCode; },
        set emailCode(value: typeof emailCode) { emailCode = value; },
        handleVerifyEmail,
        get emailSubmitting() { return emailSubmitting; },
        handleResendEmailVerification,
        get emailDraft() { return emailDraft; },
        set emailDraft(value: typeof emailDraft) { emailDraft = value; },
        handleStartEmailVerification,
        handleAuthorize,
    };
}
