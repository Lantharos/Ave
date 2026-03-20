<script lang="ts">
  import Card from "../components/Card.svelte";
  import type { AppIdentityRecord } from "../lib/api";
  import { formatDate, formatRelativeTime, getAuthMethodLabel, getInitials, shortId } from "../lib/portal";

  interface Props {
    identities: AppIdentityRecord[];
    total: number;
    loadingmore: boolean;
    hasmore: boolean;
    onloadmore: () => void;
  }

  let { identities, total, loadingmore, hasmore, onloadmore }: Props = $props();
  let search = $state("");

  const filtered = $derived(
    search.trim()
      ? identities.filter((identity) =>
          [identity.displayName, identity.handle, identity.email || "", identity.id].some((value) =>
            value.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        )
      : identities,
  );
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex flex-col gap-3">
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Identities</h1>
    <p class="m-0 max-w-[560px] text-[15px] text-[#7e7e7e]">People who have used this app, with recent activity and sign-in history.</p>
    <p class="m-0 text-[13px] text-[#666]">{total} identities</p>
  </div>

  <div class="relative">
    <svg class="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      class="w-full rounded-full border-0 bg-white/[0.04] px-5 py-3 pl-12 text-[15px] text-white outline-none placeholder:text-[#555] focus:bg-white/[0.06]"
      bind:value={search}
      placeholder="Search identities"
    />
  </div>

  <Card>
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-4 px-2 text-[12px] text-[#676767] max-lg:hidden">
        <span>Identity</span>
        <span>First seen</span>
        <span>Last active</span>
        <span>Count</span>
        <span>Method</span>
      </div>

      <div class="flex flex-col gap-3">
        {#each filtered as identity}
          <div class="grid gap-4 rounded-[24px] bg-white/[0.03] px-4 py-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.7fr] lg:items-center">
            <div class="min-w-0">
              <div class="flex items-center gap-3">
                {#if identity.avatarUrl}
                  <img src={identity.avatarUrl} alt="" class="h-11 w-11 rounded-full object-cover shrink-0" />
                {:else}
                  <div class="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-[12px] font-black text-white shrink-0">
                    {getInitials(identity.displayName)}
                  </div>
                {/if}
                <div class="min-w-0">
                  <p class="m-0 truncate text-[15px] font-medium text-white">{identity.displayName}</p>
                  <p class="m-0 mt-1 truncate text-[13px] text-[#7d7d7d]">@{identity.handle} · {shortId(identity.id, 10)}</p>
                </div>
              </div>
            </div>
            <div class="text-[14px] text-[#8a8a8a]">{formatDate(identity.firstSeen)}</div>
            <div class="text-[14px] text-[#8a8a8a]">{formatRelativeTime(identity.lastActive)}</div>
            <div class="text-[14px] text-white">{identity.signInCount}</div>
            <div>
              <span class="rounded-full px-3 py-1.5 text-[12px] {identity.lastMethod ? 'bg-white/[0.05] text-[#bdbdbd]' : 'bg-white/[0.03] text-[#6c6c6c]'}">
                {getAuthMethodLabel(identity.lastMethod)}
              </span>
            </div>
          </div>
        {/each}
      </div>

      {#if hasmore}
        <button
          class="mt-2 rounded-full border-0 bg-white/[0.04] px-5 py-3 text-[14px] text-[#c2c2c2] cursor-pointer transition-colors duration-300 hover:bg-white/[0.07] disabled:opacity-50 disabled:pointer-events-none"
          onclick={onloadmore}
          disabled={loadingmore}
        >
          {loadingmore ? "Loading more..." : "Load more"}
        </button>
      {/if}
    </div>
  </Card>
</div>
