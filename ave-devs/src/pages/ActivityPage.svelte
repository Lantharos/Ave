<script lang="ts">
  import Card from "../components/Card.svelte";
</script>

<div class="flex flex-col gap-10 md:gap-14">
  <div class="flex flex-col gap-3">
    <h2 class="text-[28px] md:text-[40px] font-black m-0 tracking-tight text-white">Activity</h2>
    <p class="text-[16px] md:text-[20px] text-[#878787] m-0 font-medium">Recent app changes and credential updates.</p>
  </div>

  <Card>
    <div class="flex flex-col items-center justify-center py-16 md:py-24 gap-6">
      <div class="flex flex-col items-center gap-4 text-center">
        <p class="text-[18px] md:text-[24px] text-[#878787] m-0 font-black">No activity yet</p>
        <p class="text-[14px] md:text-[16px] text-[#878787] m-0 font-medium">Events will appear here as you create and manage apps.</p>
      </div>
    </div>
  </Card>
</div>
