<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
</script>

<div class="flex flex-col gap-6">
  <div>
    <h2 class="text-xl font-semibold m-0 mb-1">Activity</h2>
    <p class="text-[14px] text-[#888] m-0">Recent app changes and credential updates.</p>
  </div>

  <Card>
    <div class="flex flex-col items-center justify-center py-16 gap-4">
      <div class="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
        <svg class="w-7 h-7 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div class="text-center">
        <p class="text-[15px] text-[#999] m-0 mb-1">No activity yet</p>
        <p class="text-[13px] text-[#666] m-0">Events will appear here as you create and manage apps.</p>
      </div>
      <Button variant="outline" size="sm" onclick={() => {}}>Export logs</Button>
    </div>
  </Card>
</div>
