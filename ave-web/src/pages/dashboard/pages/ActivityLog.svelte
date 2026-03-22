<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Activity from "./components/Activity.svelte";
    import type { ActivityLogEntry } from "../../../lib/api";
    import { createActivityInfiniteQuery } from "../../../lib/queries";

    let loadingMore = $state(false);
    let error = $state<string | null>(null);
    let searchQuery = $state("");
    let selectedSeverity = $state<"all" | "info" | "warning" | "danger">("all");
    const activityQuery = createActivityInfiniteQuery(() => selectedSeverity, 20);
    let loading = $derived(activityQuery.isPending);
    let hasMore = $derived(Boolean(activityQuery.hasNextPage));
    let activities = $derived((activityQuery.data?.pages.flat() ?? []) as ActivityLogEntry[]);

    function handleSeverityFilter(severity: "all" | "info" | "warning" | "danger") {
        selectedSeverity = severity;
    }

    async function loadMore() {
        if (!activityQuery.hasNextPage || activityQuery.isFetchingNextPage) return;
        loadingMore = true;
        try {
            await activityQuery.fetchNextPage();
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load more activity";
        } finally {
            loadingMore = false;
        }
    }

    $effect(() => {
        if (!error && activityQuery.error) {
            error = activityQuery.error instanceof Error ? activityQuery.error.message : "Failed to load activity";
        }
    });

    // Filter activities by search query
    let filteredActivities = $derived(
        searchQuery.trim() 
            ? activities.filter(a => 
                a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.ipAddress && a.ipAddress.includes(searchQuery))
            )
            : activities
    );

</script>

<div class="flex flex-col gap-4 md:gap-[40px] w-full z-10 px-3 md:px-[60px] py-4 md:py-[40px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-1 md:gap-[10px]">
        <Text type="h" size={48} mobileSize={28} weight="bold">Activity Log</Text>
        <Text type="p" size={14} mobileSize={12} color="#666666">Activity is kept for 5 days and then removed automatically.</Text>
    </div>

    {#if error}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
            <Text type="p" size={16} color="#E14747">{error}</Text>
        </div>
    {/if}

    <div class="flex flex-col md:flex-row w-full gap-2 md:gap-[10px]">
        <div class="flex flex-row gap-1 md:gap-[5px] overflow-x-auto pb-2 md:pb-0">
            <button 
                class="px-4 md:px-[20px] py-3 md:py-[15px] rounded-full flex items-center justify-center text-xs md:text-[14px] transition-colors duration-300 cursor-pointer whitespace-nowrap {selectedSeverity === 'all' ? 'bg-[#FFFFFF] text-[#000000]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("all")}
            >
                All
            </button>
            <button 
                class="px-4 md:px-[20px] py-3 md:py-[15px] rounded-full flex items-center justify-center text-xs md:text-[14px] transition-colors duration-300 cursor-pointer whitespace-nowrap {selectedSeverity === 'info' ? 'bg-[#32A94C] text-[#FFFFFF]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("info")}
            >
                Info
            </button>
            <button 
                class="px-4 md:px-[20px] py-3 md:py-[15px] rounded-full flex items-center justify-center text-xs md:text-[14px] transition-colors duration-300 cursor-pointer whitespace-nowrap {selectedSeverity === 'warning' ? 'bg-[#FFB400] text-[#000000]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("warning")}
            >
                Warning
            </button>
            <button 
                class="px-4 md:px-[20px] py-3 md:py-[15px] rounded-full flex items-center justify-center text-xs md:text-[14px] transition-colors duration-300 cursor-pointer whitespace-nowrap {selectedSeverity === 'danger' ? 'bg-[#BF2626] text-[#FFFFFF]' : 'bg-[#171717] text-[#D3D3D3] hover:bg-[#1E1E1E]'}"
                onclick={() => handleSeverityFilter("danger")}
            >
                Danger
            </button>
        </div>

        <input 
            type="text" 
            placeholder="Search activity..." 
            class="flex-grow px-5 md:px-[30px] py-3 md:py-[15px] bg-[#171717] rounded-full text-[#D3D3D3] text-sm md:text-[16px] focus:outline-none focus:bg-[#1E1E1E] transition-colors duration-300" 
            bind:value={searchQuery}
        />
    </div>

    <div class="flex flex-col gap-3 md:gap-[15px] w-full">
        {#if loading}
            <div class="flex justify-center py-8 md:py-[40px]">
                <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        {:else if filteredActivities.length === 0}
            <div class="text-center py-8 md:py-[40px]">
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
                    class="w-full py-3 md:py-[15px] bg-[#171717] hover:bg-[#1E1E1E] rounded-full text-[#D3D3D3] text-sm md:text-[16px] transition-colors duration-300 cursor-pointer disabled:opacity-50"
                    onclick={loadMore}
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
