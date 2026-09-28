import type { DevApp, UpdateAppPayload } from "$lib/surfaces/devs/lib/api";
import { queryClient } from "$lib/surfaces/devs/lib/query-client";
import { createCreateAppMutation, createUpdateAppMutation, createDeleteAppMutation, createRotateSecretMutation, queryKeys } from "$lib/surfaces/devs/lib/queries";
import type { PortalState } from "./portal-state.svelte";

export function createAppActions(state: PortalState, loadPortal: (organizationId?: string) => Promise<void>, openApp: (appId: string) => void) {
    const createAppMutation = createCreateAppMutation(() => state.currentOrganizationId);
    const updateAppMutation = createUpdateAppMutation();
    const deleteAppMutation = createDeleteAppMutation();
    const rotateSecretMutation = createRotateSecretMutation();
    async function handleCreate(form: {
        name: string;
        description: string;
        websiteUrl: string;
        iconUrl: string;
        redirectUris: string;
        developmentMode: boolean;
        accessTokenTtlSeconds: number;
        refreshTokenTtlSeconds: number;
        allowedScopes: string[];
    }) {
        if (!state.currentOrganizationId) return;

        state.creating = true;
        state.error = "";
        state.newSecret = null;

        try {
            const redirectUris = form.redirectUris
                .split("\n")
                .map((uri) => uri.trim())
                .filter(Boolean);

            const result = await createAppMutation.mutateAsync({
                name: form.name,
                description: form.description || undefined,
                websiteUrl: form.websiteUrl || undefined,
                iconUrl: form.iconUrl || undefined,
                redirectUris,
                developmentMode: form.developmentMode,
                accessTokenTtlSeconds: form.accessTokenTtlSeconds,
                refreshTokenTtlSeconds: form.refreshTokenTtlSeconds,
                allowedScopes: form.allowedScopes,
            });

            state.apps = [result.app, ...state.apps];
            state.newSecret = result.clientSecret;
            await queryClient.invalidateQueries({ queryKey: ["portal"] });
            state.createModalOpen = false;
            if (state.workspace) {
                state.workspace = {
                    ...state.workspace,
                    appCount: state.workspace.appCount + 1,
                };
            }
            openApp(result.app.id);
        } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to create app";
        } finally {
            state.creating = false;
        }
    }

    async function handleRotateSecret(appId: string) {
        state.error = "";
        state.rotatingAppId = appId;
        state.rotatedAppId = null;

        try {
            const result = await rotateSecretMutation.mutateAsync(appId);
            state.newSecret = result.clientSecret;
            state.rotatedAppId = appId;
            if (state.rotateStateTimer) clearTimeout(state.rotateStateTimer);
            state.rotateStateTimer = setTimeout(() => {
                state.rotatedAppId = null;
            }, 1800);
        } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to rotate secret";
        } finally {
            state.rotatingAppId = null;
        }
    }

    async function handleSaveApp(app: DevApp & { redirectUrisText?: string }) {
        state.error = "";
        state.saveState = "saving";
        const previousOrganizationId = state.apps.find((entry) => entry.id === app.id)?.organizationId ?? null;
        const normalizeOptionalText = (value?: string) => {
            const nextValue = value?.trim();
            return nextValue ? nextValue : null;
        };

        try {
            const payload: UpdateAppPayload = {
                name: app.name,
                description: normalizeOptionalText(app.description),
                websiteUrl: normalizeOptionalText(app.websiteUrl),
                iconUrl: normalizeOptionalText(app.iconUrl),
                redirectUris: (app.redirectUrisText || "")
                    .split("\n")
                    .map((uri) => uri.trim())
                    .filter(Boolean),
                developmentMode: app.developmentMode,
                allowedScopes: app.allowedScopes,
                accessTokenTtlSeconds: app.accessTokenTtlSeconds,
                refreshTokenTtlSeconds: app.refreshTokenTtlSeconds,
                organizationId: app.organizationId || undefined,
            };

            const result = await updateAppMutation.mutateAsync({
                appId: app.id,
                data: payload,
            });
            if (result.app.organizationId !== previousOrganizationId) {
                await loadPortal(result.app.organizationId || undefined);
                openApp(result.app.id);
            } else {
                state.apps = state.apps.map((entry) => (entry.id === result.app.id ? result.app : entry));
            }
            state.saveState = "saved";

            if (state.saveStateTimer) clearTimeout(state.saveStateTimer);
            state.saveStateTimer = setTimeout(() => {
                state.saveState = "idle";
            }, 1800);
        } catch (err) {
            state.saveState = "idle";
            state.error = err instanceof Error ? err.message : "Failed to update app";
        }
    }

    async function handleConfirmDelete() {
        if (!state.deleteTarget) return;
        state.error = "";
        state.deleting = true;
        const target = state.deleteTarget;

        try {
            await deleteAppMutation.mutateAsync(target.id);
            await queryClient.invalidateQueries({ queryKey: ["portal"] });
            queryClient.removeQueries({ queryKey: queryKeys.appIdentities(target.id) });
            state.apps = state.apps.filter((app) => app.id !== target.id);
            if (state.workspace) {
                state.workspace = {
                    ...state.workspace,
                    appCount: Math.max(0, state.workspace.appCount - 1),
                };
            }
            if (state.selectedAppId === target.id) {
                state.selectedAppId = null;
                state.appIdentities = [];
                state.workspaceSection = "applications";
            }
            state.deleteTarget = null;
        } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to delete app";
        } finally {
            state.deleting = false;
        }
    }

    async function handleCopy(text: string) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            state.error = "Failed to copy to clipboard";
        }
    }

    return { handleCreate, handleRotateSecret, handleSaveApp, handleConfirmDelete, handleCopy };
}
