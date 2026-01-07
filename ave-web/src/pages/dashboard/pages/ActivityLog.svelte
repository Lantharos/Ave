<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Activity from "./components/Activity.svelte";
    import { api, type ActivityLogEntry } from "../../../lib/api";

    let activities = $state<ActivityLogEntry[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let searchQuery = $state("");
    let selectedSeverity = $state<"all" | "info" | "warning" | "danger">("all");
    let loadingMore = $state(false);
    let hasMore = $state(true);

    const LIMIT = 20;

    async function loadActivities(reset = true) {
        try {
            if (reset) {
                loading = true;
                activities = [];
            } else {
                loadingMore = true;
            }
            error = null;
            
            const params: { limit: number; offset: number; severity?: "info" | "warning" | "danger" } = {
                limit: LIMIT,
                offset: reset ? 0 : activities.length,
            };
            
            if (selectedSeverity !== "all") {
                params.severity = selectedSeverity;
            }
            
            const data = await api.activity.list(params);
            
            if (reset) {
                activities = data.logs;
            } else {
                activities = [...activities, ...data.logs];
            }
            
            hasMore = data.logs.length === LIMIT;
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load activity";
        } finally {
            loading = false;
            loadingMore = false;
        }
    }

    function handleSeverityFilter(severity: "all" | "info" | "warning" | "danger") {
        selectedSeverity = severity;
        loadActivities(true);
    }

    // Filter activities by search query
    let filteredActivities = $derived(
        searchQuery.trim() 
            ? activities.filter(a => 
                a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.ipAddress && a.ipAddress.includes(searchQuery))
            )
            : activities
    );

    // Load data on mount
    $effect(() => {
        loadActivities();
    });
</script>

<div class="flex flex-col gap-[40px] w-full z-10 px-[60px] py-[40px] bg-[#111111]/60 rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-[10px]">
        <Text type="h" size={48} weight="bold">Activity Log</Text>
    </div>

    {#if error}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-[20px] py-[15px]">
            <Text type="p" size={16} color="#E14747">{error}</Text>
        </div>
    {/if}

    <div class="flex flex-row w-full gap-[10px]">
        <div class="flex flex-row gap-[5px]">
            <button 
                class="px-[20px] py-[15px] rounded-full flex items-center justify-center text-[14px] transition-colors duration-300 cursor-pointer {selectedSeverity === 'all' ? 'bg-[#FFFFFF] text-[#000000]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("all")}
            >
                All
            </button>
            <button 
                class="px-[20px] py-[15px] rounded-full flex items-center justify-center text-[14px] transition-colors duration-300 cursor-pointer {selectedSeverity === 'info' ? 'bg-[#32A94C] text-[#FFFFFF]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("info")}
            >
                Info
            </button>
            <button 
                class="px-[20px] py-[15px] rounded-full flex items-center justify-center text-[14px] transition-colors duration-300 cursor-pointer {selectedSeverity === 'warning' ? 'bg-[#FFB400] text-[#000000]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("warning")}
            >
                Warning
            </button>
            <button 
                class="px-[20px] py-[15px] rounded-full flex items-center justify-center text-[14px] transition-colors duration-300 cursor-pointer {selectedSeverity === 'danger' ? 'bg-[#BF2626] text-[#FFFFFF]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("danger")}
            >
                Danger
            </button>
        </div>

        <input 
            type="text" 
            placeholder="Search activity..." 
            class="flex-grow px-[30px] py-[15px] bg-[#171717] rounded-full text-[#D3D3D3] text-[16px] focus:outline-none focus:bg-[#1E1E1E] transition-colors duration-300" 
            bind:value={searchQuery}
        />
    </div>

    <div class="flex flex-col gap-[15px] w-full">
        {#if loading}
            <div class="flex justify-center py-[40px]">
                <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        {:else if filteredActivities.length === 0}
            <div class="text-center py-[40px]">
                <Text type="p" size={18} color="#666666">
                    {searchQuery ? "No activities match your search." : "No activity yet."}
                </Text>
            </div>
        {:else}
            {#each filteredActivities as entry (entry.id)}
                <Activity {entry} />
            {/each}
            
            {#if hasMore && !searchQuery}
                <button 
                    class="w-full py-[15px] bg-[#171717] hover:bg-[#1E1E1E] rounded-full text-[#D3D3D3] text-[16px] transition-colors duration-300 cursor-pointer disabled:opacity-50"
                    onclick={() => loadActivities(false)}
                    disabled={loadingMore}
                >
                    {#if loadingMore}
                        <div class="w-[20px] h-[20px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    {:else}
                        Load More
                    {/if}
                </button>
            {/if}
        {/if}
    </div>
</div>
