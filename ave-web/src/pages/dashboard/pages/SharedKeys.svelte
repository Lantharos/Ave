<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Spinner from "../../../components/Spinner.svelte";
    import { createSharedSecretsQuery } from "../../../lib/queries";

    const sharedSecretsQuery = createSharedSecretsQuery();

    let loading = $derived(sharedSecretsQuery.isPending);
    let loadError = $state("");

    $effect(() => {
        if (sharedSecretsQuery.error) {
            loadError =
                sharedSecretsQuery.error instanceof Error
                    ? sharedSecretsQuery.error.message
                    : "Could not load app keys.";
        } else {
            loadError = "";
        }
    });

    function scopeLabel(k: "app_scoped" | "global"): string {
        return k === "app_scoped" ? "One app" : "Any app";
    }

    function transferStatusLabel(s: string): string {
        if (s === "pending") return "Waiting";
        if (s === "claimed") return "Added";
        if (s === "expired") return "Expired";
        return s;
    }
</script>

<div class="flex flex-col gap-4 md:gap-[40px] w-full z-10 px-3 md:px-[60px] py-4 md:py-[40px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-1 md:gap-[10px]">
        <Text type="h" size={48} mobileSize={28} weight="bold">App keys</Text>
        <Text type="p" size={20} mobileSize={14}>
            What you’ve set up for apps and what others have shared with you. To grant or accept keys, use the app—it starts the flow from there.
        </Text>
    </div>

    {#if loadError}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-3 md:px-[20px] py-2 md:py-[15px]">
            <Text type="p" size={16} mobileSize={13} color="#E14747">{loadError}</Text>
        </div>
    {/if}

    <div class="flex flex-col gap-4 md:gap-[20px]">
        <div class="flex flex-col flex-grow bg-[#171717] p-3 md:p-[40px] rounded-[20px] md:rounded-[36px] gap-3 md:gap-[16px]">
            <Text type="h" size={24} mobileSize={18} weight="bold">Your keys</Text>
            {#if loading}
                <div class="flex justify-center py-6">
                    <Spinner size={34} />
                </div>
            {:else if sharedSecretsQuery.data?.created?.length}
                <div class="flex flex-col divide-y divide-[#2A2A2A]">
                    {#each sharedSecretsQuery.data.created as secret}
                        <div class="py-4 first:pt-0 flex flex-col gap-1">
                            <p class="text-white font-medium">{secret.label || secret.resourceKey || secret.id}</p>
                            <p class="text-[#878787] text-sm">
                                {scopeLabel(secret.kind)}
                                {#if secret.resourceKey}
                                    · {secret.resourceKey}
                                {/if}
                            </p>
                            {#if secret.transfers.length}
                                {#each secret.transfers as transfer}
                                    <p class="text-[#B9BBBE] text-sm">
                                        @{transfer.targetHandle} — {transferStatusLabel(transfer.status)}
                                    </p>
                                {/each}
                            {:else}
                                <p class="text-[#878787] text-sm">No pending access.</p>
                            {/if}
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-[#878787] text-sm md:text-[16px]">
                    Nothing listed yet. When you grant access from an app, it will appear here.
                </p>
            {/if}
        </div>

        <div class="flex flex-col flex-grow bg-[#171717] p-3 md:p-[40px] rounded-[20px] md:rounded-[36px] gap-3 md:gap-[16px]">
            <Text type="h" size={24} mobileSize={18} weight="bold">Access others gave you</Text>
            {#if loading}
                <div class="flex justify-center py-6">
                    <Spinner size={34} />
                </div>
            {:else if sharedSecretsQuery.data?.received?.length}
                <div class="flex flex-col divide-y divide-[#2A2A2A]">
                    {#each sharedSecretsQuery.data.received as received}
                        <div class="py-4 first:pt-0 flex flex-col gap-1">
                            <p class="text-white font-medium">
                                {received.descriptor.label || received.descriptor.resourceKey || received.sharedSecretId}
                            </p>
                            <p class="text-[#878787] text-sm">From @{received.owner.handle}</p>
                            <p class="text-[#B9BBBE] text-sm">
                                {scopeLabel(received.descriptor.kind)}
                                {#if received.descriptor.resourceKey}
                                    · {received.descriptor.resourceKey}
                                {/if}
                            </p>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-[#878787] text-sm md:text-[16px]">
                    Nothing listed yet. When someone shares a key with you from an app, it will appear here.
                </p>
            {/if}
        </div>
    </div>
</div>
