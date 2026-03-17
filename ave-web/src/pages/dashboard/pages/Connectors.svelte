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
    return mode === "background" ? "Background" : "User present";
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
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-[20px]">
      {#each delegations as delegation}
        <div class="flex flex-col gap-[3px] h-full">
          <div class="flex flex-col bg-[#171717] rounded-[20px] md:rounded-[24px] p-4 md:p-[20px] gap-3 md:gap-[10px] h-full">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-[40px] md:w-[50px] aspect-square shrink-0">
                  {#if delegation.sourceAppIconUrl}
                    <img
                      src={delegation.sourceAppIconUrl}
                      alt={`${delegation.sourceAppName} icon`}
                      class="w-full h-full rounded-[12px] object-cover"
                    />
                  {:else}
                    <div class="w-full h-full rounded-[12px] bg-[#111111] flex items-center justify-center">
                      <Text type="hd" size={18} mobileSize={14} color="#D3D3D3">
                        {delegation.sourceAppName.slice(0, 1)}
                      </Text>
                    </div>
                  {/if}
              </div>

              <div class="min-w-0 flex-1">
                <Text type="h" size={20} mobileSize={16} weight="bold" color="#FFFFFF" cclass="truncate">
                  {delegation.sourceAppName}
                </Text>
                <Text type="p" size={16} mobileSize={13} color="#B9BBBE" cclass="truncate">
                  {delegation.targetResourceName}
                </Text>
              </div>
            </div>

            <div class="flex flex-col gap-2 md:gap-[10px]">
              <div class="bg-[#111111] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
                <Text type="p" size={14} mobileSize={11} color="#666666">Resource</Text>
                <Text type="h" size={18} mobileSize={14} weight="bold" color="#FFFFFF">
                  {delegation.targetResourceKey}
                </Text>
              </div>

              <div class="bg-[#111111] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
                <Text type="p" size={14} mobileSize={11} color="#666666">Scope</Text>
                <Text type="p" size={16} mobileSize={13} color="#B9BBBE" cclass="break-all">
                  {delegation.scope}
                </Text>
              </div>

              <div class="bg-[#111111] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
                <Text type="p" size={14} mobileSize={11} color="#666666">Source</Text>
                <Text type="p" size={16} mobileSize={13} color="#B9BBBE" cclass="break-all">
                  {formatWebsite(delegation.sourceAppWebsiteUrl) ?? delegation.sourceAppClientId}
                </Text>
              </div>

              <div class="bg-[#111111] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px]">
                <Text type="p" size={14} mobileSize={11} color="#666666">Mode</Text>
                <Text type="p" size={16} mobileSize={13} color="#B9BBBE">
                  {formatModeLabel(delegation.communicationMode)}
                </Text>
              </div>

              <Text type="p" size={14} mobileSize={11} color="#666666" cclass="px-1">
                Issued {formatIssuedDate(delegation.createdAt)}
              </Text>
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
  {/if}
</div>
