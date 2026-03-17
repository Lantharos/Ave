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

  function formatModeLabel(mode: Delegation["communicationMode"]) {
    return mode === "background" ? "Background" : "User Present";
  }

  function formatIssuedDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatWebsite(url?: string) {
    if (!url) return null;

    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

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
    <div class="rounded-[20px] md:rounded-[36px] border border-[#1F1F1F] bg-[#141414]/80 p-3 md:p-[24px]">
      <div class="flex flex-col gap-1 md:gap-[6px] pb-4 md:pb-[20px]">
        <Text type="hd" size={16} mobileSize={13} color="#878787">ACTIVE GRANTS</Text>
        <Text type="p" size={16} mobileSize={13} color="#666666">
          Review which apps can request delegated access through Ave Connector.
        </Text>
      </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-[20px]">
      {#each delegations as delegation}
        <div class="flex flex-col gap-[3px] h-full">
          <div class="flex flex-col h-full rounded-[20px] md:rounded-[28px] bg-[#171717] border border-[#222222] p-4 md:p-[24px] gap-4 md:gap-[20px]">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex flex-col gap-1 md:gap-[6px]">
                <div class="flex items-center gap-3 min-w-0">
                  {#if delegation.sourceAppIconUrl}
                    <img
                      src={delegation.sourceAppIconUrl}
                      alt={`${delegation.sourceAppName} icon`}
                      class="w-10 h-10 rounded-[14px] object-cover border border-[#2A2A2A] bg-[#111111]"
                    />
                  {:else}
                    <div class="w-10 h-10 rounded-[14px] border border-[#2A2A2A] bg-[#101010] flex items-center justify-center">
                      <Text type="hd" size={14} mobileSize={12} color="#D3D3D3">
                        {delegation.sourceAppName.slice(0, 1)}
                      </Text>
                    </div>
                  {/if}

                  <div class="min-w-0">
                    <Text type="h" size={22} mobileSize={18} weight="bold" color="#FFFFFF" cclass="truncate">
                      {delegation.sourceAppName}
                    </Text>
                    <Text type="p" size={14} mobileSize={12} color="#878787" cclass="truncate">
                      {delegation.targetResourceName}
                    </Text>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2 pt-1">
                  <span class="px-3 py-1 rounded-full bg-[#111111] border border-[#272727] text-[11px] md:text-[12px] font-semibold text-[#D3D3D3] uppercase tracking-[0.08em]">
                    {formatModeLabel(delegation.communicationMode)}
                  </span>
                  <span class="px-3 py-1 rounded-full bg-[#111111] border border-[#272727] text-[11px] md:text-[12px] font-semibold text-[#878787] uppercase tracking-[0.08em]">
                    Issued {formatIssuedDate(delegation.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 md:gap-[12px]">
              <div class="rounded-[18px] border border-[#242424] bg-[#101010] px-4 py-3 md:px-[18px] md:py-[16px]">
                <Text type="hd" size={13} mobileSize={11} color="#878787">RESOURCE</Text>
                <Text type="p" size={18} mobileSize={14} weight="semibold" color="#FFFFFF" cclass="mt-1 break-all">
                  {delegation.targetResourceKey}
                </Text>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-[12px]">
                <div class="rounded-[18px] border border-[#242424] bg-[#101010] px-4 py-3 md:px-[18px] md:py-[16px]">
                  <Text type="hd" size={13} mobileSize={11} color="#878787">SCOPE</Text>
                  <Text type="p" size={16} mobileSize={13} weight="medium" color="#D3D3D3" cclass="mt-1 break-all">
                    {delegation.scope}
                  </Text>
                </div>

                <div class="rounded-[18px] border border-[#242424] bg-[#101010] px-4 py-3 md:px-[18px] md:py-[16px]">
                  <Text type="hd" size={13} mobileSize={11} color="#878787">SOURCE</Text>
                  <Text type="p" size={16} mobileSize={13} weight="medium" color="#D3D3D3" cclass="mt-1 break-all">
                    {formatWebsite(delegation.sourceAppWebsiteUrl) ?? delegation.sourceAppClientId}
                  </Text>
                </div>
              </div>
            </div>
          </div>

          <button
            class="w-full rounded-full bg-[#171717] hover:bg-[#202020] transition-colors duration-300 cursor-pointer flex items-center justify-center px-4 md:px-[20px] py-3 md:py-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={revokingId === delegation.id}
            onclick={() => revoke(delegation.id)}
          >
            {#if revokingId === delegation.id}
              <div class="w-[20px] h-[20px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
            {:else}
              <Text type="hd" size={16} mobileSize={12} color="#E14747">REVOKE GRANT</Text>
            {/if}
          </button>
        </div>
      {/each}
    </div>
    </div>
  {/if}
</div>
