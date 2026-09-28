<script lang="ts">
    import Text from "$lib/surfaces/web/components/Text.svelte";
    import ConnectedApp from "./components/ConnectedApp.svelte";
    import { createConnectedAppsQuery, createRevokeConnectedAppMutation } from "$lib/surfaces/web/lib/queries";
    import { identities } from "$lib/surfaces/web/stores/auth";

    const connectedAppsQuery = createConnectedAppsQuery();
    const revokeMutation = createRevokeConnectedAppMutation();

    let loading = $derived(connectedAppsQuery.isPending);
    let apps = $derived(connectedAppsQuery.data ?? []);
    let error = $state<string | null>(null);
    let revokingId = $state<string | null>(null);

    const identityLabels = $derived(new Map($identities.map((identity) => [identity.id, `@${identity.handle}`])));
    const showIdentity = $derived($identities.length > 1);

    $effect(() => {
        if (!error && connectedAppsQuery.error) {
            error = connectedAppsQuery.error instanceof Error ? connectedAppsQuery.error.message : "Failed to load connected apps";
        }
    });

    async function handleRevoke(authorizationId: string) {
        try {
            revokingId = authorizationId;
            error = null;
            await revokeMutation.mutateAsync(authorizationId);
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to disconnect app";
        } finally {
            revokingId = null;
        }
    }
</script>

<div class="flex flex-col gap-4 md:gap-[40px] w-full z-10 px-3 md:px-[60px] py-4 md:py-[40px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-1 md:gap-[10px]">
        <Text type="h" size={48} mobileSize={28} weight="bold">Connected Apps</Text>
        <Text type="p" size={20} mobileSize={14}>Apps you've signed in to with Ave. Disconnect one to stop it from getting new access.</Text>
    </div>

    {#if error}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
            <Text type="p" size={16} color="#E14747">{error}</Text>
        </div>
    {/if}

    {#if loading}
        <div class="flex justify-center py-[40px]">
            <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
        </div>
    {:else if apps.length === 0}
        <div class="text-center py-8 md:py-[40px]">
            <Text type="p" size={18} color="#666666">You haven't signed in to any apps yet.</Text>
        </div>
    {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-[20px]">
            {#each apps as app (app.id)}
                <ConnectedApp
                    {app}
                    identityLabel={showIdentity ? identityLabels.get(app.identityId) ?? null : null}
                    onRevoke={handleRevoke}
                    revoking={revokingId === app.id}
                />
            {/each}
        </div>
    {/if}
</div>
