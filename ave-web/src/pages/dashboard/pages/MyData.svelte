<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import { api } from "../../../lib/api";
    import { goto } from "@mateothegreat/svelte5-router";
    import { auth } from "../../../stores/auth";

    let exporting = $state(false);
    let deleting = $state(false);
    let error = $state<string | null>(null);
    let showDeleteConfirm = $state(false);
    let deleteConfirmText = $state("");

    async function handleExport() {
        try {
            exporting = true;
            error = null;
            
            const blob = await api.mydata.export();
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ave-data-export-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to export data";
        } finally {
            exporting = false;
        }
    }

    async function handleDelete() {
        if (deleteConfirmText !== "DELETE MY ACCOUNT") {
            error = "Please type 'DELETE MY ACCOUNT' to confirm";
            return;
        }

        try {
            deleting = true;
            error = null;
            
            await api.mydata.delete();
            
            // Clear local auth state
            auth.logout();
            
            // Redirect to home
            goto("/");
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to delete account";
            deleting = false;
        }
    }
</script>

<div class="flex flex-col gap-[40px] w-full z-10 px-[60px] py-[40px] bg-[#111111]/60 rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-[10px]">
        <Text type="h" size={48} weight="bold">My Data</Text>
    </div>

    {#if error}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-[20px] py-[15px]">
            <Text type="p" size={16} color="#E14747">{error}</Text>
        </div>
    {/if}

    <ActionCard 
        action="DOWNLOAD MY DATA" 
        description="This package includes only metadata tied to your Ave ID. App-level data must be exported from those apps directly." 
        buttons={[
            { 
                icon: exporting ? "" : "/icons/chevron-right-68.svg", 
                color: "#FFFFFF", 
                onClick: handleExport,
                loading: exporting 
            },
        ]}
    />

    <ActionCard 
        color="#E14747" 
        action="DELETE MY DATA" 
        description="Deleting your ID permanently erases all encrypted data and breaks access for apps using this identity. This action cannot be undone." 
        buttons={[
            { 
                icon: "/icons/chevron-right-68.svg", 
                color: "#E14747", 
                onClick: () => { showDeleteConfirm = true; } 
            },
        ]}
    />

    <Text type="p" size={16} color="#878787" cclass="self-center">Ave is designed to minimize stored data. What little exists is encrypted end-to-end and visible only to you.</Text>
</div>

{#if showDeleteConfirm}
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div class="bg-[#171717] rounded-[36px] p-[40px] max-w-[500px] w-full mx-[20px]">
            <Text type="h" size={24} weight="bold" color="#E14747">Delete Account</Text>
            <p class="text-[#878787] text-[16px] mt-[10px]">
                This will permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <p class="text-[#FFFFFF] text-[16px] mt-[20px]">
                Type <span class="font-bold text-[#E14747]">DELETE MY ACCOUNT</span> to confirm:
            </p>
            
            <input 
                type="text" 
                class="w-full mt-[10px] px-[20px] py-[15px] bg-[#111111] rounded-[16px] text-[#FFFFFF] text-[16px] focus:outline-none focus:ring-2 focus:ring-[#E14747]"
                placeholder="DELETE MY ACCOUNT"
                bind:value={deleteConfirmText}
            />

            <div class="flex flex-row gap-[10px] mt-[30px]">
                <button 
                    class="flex-1 py-[15px] bg-[#222222] text-[#FFFFFF] font-semibold rounded-[16px] hover:bg-[#333333] transition-colors"
                    onclick={() => { showDeleteConfirm = false; deleteConfirmText = ""; error = null; }}
                    disabled={deleting}
                >
                    Cancel
                </button>
                <button 
                    class="flex-1 py-[15px] bg-[#E14747] text-[#FFFFFF] font-semibold rounded-[16px] hover:bg-[#C33C3C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={handleDelete}
                    disabled={deleting || deleteConfirmText !== "DELETE MY ACCOUNT"}
                >
                    {#if deleting}
                        <div class="w-[20px] h-[20px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    {:else}
                        Delete Permanently
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
