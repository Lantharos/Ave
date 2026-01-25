<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import Device from "./components/Device.svelte";
    import { api, type Device as DeviceType } from "../../../lib/api";

    let devices = $state<DeviceType[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let revokingDeviceId = $state<string | null>(null);
    let revokingAll = $state(false);
    let showAddDeviceModal = $state(false);
    let addDeviceLoading = $state(false);

    async function loadDevices() {
        try {
            loading = true;
            error = null;
            const data = await api.devices.list();
            // Only show active devices
            devices = data.devices.filter(d => d.isActive);
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load devices";
        } finally {
            loading = false;
        }
    }

    async function handleAddDevice() {
        // For now, show a modal with instructions
        // In the future, this could generate a QR code linking to the login flow
        showAddDeviceModal = true;
    }

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
            await api.devices.revoke(deviceId);
            devices = devices.filter(d => d.id !== deviceId);
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
                await api.devices.revoke(device.id);
            }
            
            // Keep only current device
            devices = devices.filter(d => d.isCurrent);
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to revoke devices";
            // Reload to get accurate state
            await loadDevices();
        } finally {
            revokingAll = false;
        }
    }

    // Load data on mount
    $effect(() => {
        loadDevices();
    });
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

    <ActionCard 
        action="ADD A NEW DEVICE" 
        description="You can easily enroll a new device by generating a QR code that you can scan with your phone or tablet. This action will require you to present your passkey." 
        buttons={[
            { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: handleAddDevice },
        ]}
    />

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

<!-- Add Device Modal -->
{#if showAddDeviceModal}
    <div 
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onclick={() => showAddDeviceModal = false}
        onkeydown={(e) => e.key === "Escape" && (showAddDeviceModal = false)}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div 
            class="bg-[#171717] rounded-[24px] md:rounded-[36px] p-6 md:p-[40px] max-w-[500px] w-full"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
            role="presentation"
        >
            <Text type="h" size={24} weight="bold">Add a New Device</Text>
            <p class="text-[#878787] text-sm md:text-[16px] mt-2 md:mt-[10px]">
                To add a new device to your account:
            </p>
            <ol class="text-[#FFFFFF] text-sm md:text-[16px] mt-4 md:mt-[20px] list-decimal list-inside space-y-3">
                <li>Open <strong>ave.id</strong> on your new device</li>
                <li>Enter your handle to sign in</li>
                <li>Choose "Confirm on another device"</li>
                <li>A notification will appear here for you to approve</li>
            </ol>
            <p class="text-[#666666] text-xs md:text-[14px] mt-4 md:mt-[20px]">
                You can also use a trust code if you don't have access to any trusted devices.
            </p>
            <div class="flex gap-2 md:gap-[10px] mt-6 md:mt-[30px]">
                <button 
                    class="flex-1 py-3 md:py-[15px] bg-[#FFFFFF] text-[#090909] font-semibold rounded-[16px] hover:bg-[#E0E0E0] transition-colors"
                    onclick={() => showAddDeviceModal = false}
                >
                    Got it
                </button>
            </div>
        </div>
    </div>
{/if}
