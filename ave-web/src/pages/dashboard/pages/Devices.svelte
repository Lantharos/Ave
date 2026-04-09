<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import Device from "./components/Device.svelte";
    import { createDevicesQuery, createRevokeDeviceMutation, queryKeys } from "../../../lib/queries";
    import { queryClient } from "../../../lib/query-client";

    const devicesQuery = createDevicesQuery();

    let loading = $derived(devicesQuery.isPending);
    let devices = $derived(devicesQuery.data ?? []);
    let error = $state<string | null>(null);
    let revokingDeviceId = $state<string | null>(null);
    let revokingAll = $state(false);

    const revokeDeviceMutation = createRevokeDeviceMutation();

    $effect(() => {
        if (!error && devicesQuery.error) {
            error = devicesQuery.error instanceof Error ? devicesQuery.error.message : "Failed to load devices";
        }
    });

    async function handleRevokeDevice(deviceId: string) {
        const device = devices.find(d => d.id === deviceId);
        if (device?.isCurrent) {
            error = "Cannot revoke current device";
            return;
        }

        if (!confirm(`Are you sure you want to remove "${device?.name}"?`)) {
            return;
        }

        try {
            revokingDeviceId = deviceId;
            error = null;
            await revokeDeviceMutation.mutateAsync(deviceId);
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to revoke device";
        } finally {
            revokingDeviceId = null;
        }
    }

    async function handleRevokeAllDevices() {
        if (!confirm("Are you sure? This will remove all devices except this one. You'll need to re-add them.")) {
            return;
        }

        try {
            revokingAll = true;
            error = null;
            
            // Revoke all devices except current
            const otherDevices = devices.filter(d => !d.isCurrent);
            for (const device of otherDevices) {
                await revokeDeviceMutation.mutateAsync(device.id);
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to revoke devices";
            await queryClient.invalidateQueries({ queryKey: queryKeys.devices });
        } finally {
            revokingAll = false;
        }
    }
</script>

<div class="flex flex-col gap-4 md:gap-[40px] w-full z-10 px-3 md:px-[60px] py-4 md:py-[40px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-1 md:gap-[10px]">
        <Text type="h" size={48} mobileSize={28} weight="bold">Devices</Text>
        <Text type="p" size={20} mobileSize={14}>Here are all the devices currently logged in to your ID.</Text>
    </div>

    {#if error}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
            <Text type="p" size={16} color="#E14747">{error}</Text>
        </div>
    {/if}

    {#if devices.length > 1}
        <ActionCard 
            color="#FFB400" 
            action="REVOKE ALL DEVICES" 
            description="This will invalidate keys on all enrolled devices, except this one, you will need to re-add every device again." 
            buttons={[
                { 
                    icon: "/icons/chevron-right-68.svg", 
                    color: "#FFB400", 
                    onClick: handleRevokeAllDevices,
                    loading: revokingAll 
                },
            ]}
        />
    {/if}

    {#if loading}
        <div class="flex justify-center py-[40px]">
            <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
        </div>
    {:else if devices.length === 0}
        <div class="text-center py-8 md:py-[40px]">
            <Text type="p" size={18} color="#666666">No devices found.</Text>
        </div>
    {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-[20px]">
            {#each devices as device (device.id)}
                <Device 
                    {device} 
                    onRevoke={handleRevokeDevice}
                    revoking={revokingDeviceId === device.id}
                />
            {/each}
        </div>
    {/if}
</div>
