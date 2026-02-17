<script lang="ts">
  import { onMount } from "svelte";
  import Text from "../../../components/Text.svelte";
  import ActionCard from "../../../components/ActionCard.svelte";
  import { api } from "../../../lib/api";

  type Delegation = {
    id: string;
    createdAt: string;
    communicationMode: "user_present" | "background";
    scope: string;
    sourceAppName: string;
    sourceAppClientId: string;
    sourceAppIconUrl?: string;
    sourceAppWebsiteUrl?: string;
    targetResourceName: string;
    targetResourceKey: string;
  };

  let loading = $state(true);
  let delegations = $state<Delegation[]>([]);
  let error = $state<string | null>(null);
  let revokingId = $state<string | null>(null);

  async function load() {
    loading = true;
    error = null;
    try {
      const result = await api.oauth.getDelegations();
      delegations = result.delegations as Delegation[];
    } catch (e: any) {
      error = e?.message || "Failed to load connectors";
    } finally {
      loading = false;
    }
  }

  async function revoke(id: string) {
    revokingId = id;
    error = null;
    try {
      await api.oauth.revokeDelegation(id);
      delegations = delegations.filter((item) => item.id !== id);
    } catch (e: any) {
      error = e?.message || "Failed to revoke connector";
    } finally {
      revokingId = null;
    }
  }

  onMount(load);
</script>

<div class="flex flex-col gap-4 md:gap-[40px] w-full z-10 px-3 md:px-[60px] py-4 md:py-[40px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
  <div class="flex flex-col gap-1 md:gap-[10px]">
    <Text type="h" size={48} mobileSize={28} weight="bold">Connectors</Text>
    <Text type="p" size={20} mobileSize={14}>Manage app-to-app connector grants issued through Ave Connector.</Text>
  </div>

  {#if error}
    <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
      <Text type="p" size={16} color="#E14747">{error}</Text>
    </div>
  {/if}

  <ActionCard
    action="CONNECTOR GRANTS"
    description="Connector grants are separate from sign-in and can be revoked at any time."
    buttons={[]}
  />

  {#if loading}
    <div class="flex justify-center py-[30px]">
      <div class="w-[42px] h-[42px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if delegations.length === 0}
    <div class="text-center py-8 md:py-[40px]">
      <Text type="p" size={18} color="#666666">No active connector grants.</Text>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-[20px]">
      {#each delegations as delegation}
        <div class="rounded-[24px] bg-[#111111] border border-[#232323] p-4 md:p-6 flex flex-col gap-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-white text-[18px] font-semibold leading-tight">{delegation.sourceAppName}</p>
              <p class="text-[#909090] text-[13px] mt-1">{delegation.targetResourceName}</p>
            </div>
            <span class="text-[11px] uppercase tracking-[0.08em] px-3 py-1 rounded-full border border-[#2F2F2F] text-[#A0A0A0]">
              {delegation.communicationMode === "background" ? "background" : "user present"}
            </span>
          </div>

          <div class="rounded-[14px] bg-[#0E0E0E] border border-[#1D1D1D] p-3">
            <p class="text-[#B0B0B0] text-[12px]">Resource</p>
            <p class="text-white text-[14px] mt-1">{delegation.targetResourceKey}</p>
            <p class="text-[#7A7A7A] text-[12px] mt-2">Scope: {delegation.scope}</p>
          </div>

          <button
            class="self-start px-5 py-2 rounded-full border border-[#E14747] text-[#E14747] hover:bg-[#E14747]/10 disabled:opacity-50 transition-colors"
            disabled={revokingId === delegation.id}
            onclick={() => revoke(delegation.id)}
          >
            {revokingId === delegation.id ? "Revoking..." : "Revoke Grant"}
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>