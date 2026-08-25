<script lang="ts">
    import { resolve } from "$app/paths";
    import AuroraBackdrop from "$lib/components/AuroraBackdrop.svelte";
</script>

<div class="relative flex h-screen-fixed w-full flex-col items-center justify-center gap-8 bg-[#090909] px-6 py-12 md:gap-[50px] md:px-[120px] md:py-[100px]">
    <h1 class="text-[72px] font-extrabold text-[#FFFFFF]/80 md:text-[96px]">
        404
    </h1>
    <h2 class="text-center text-[28px] font-medium text-[#B9BBBE] md:text-[36px]">
        This page doesn't exist.
    </h2>
    <p class="max-w-[560px] text-center text-[18px] text-[#878787] md:text-[22px]">
        The address may be wrong or the page may have moved. Return to the <a href={resolve("/" as any)} class="underline transition-colors hover:text-[#FFFFFF]">home page</a>.
    </p>
    <AuroraBackdrop preset="not-found" />
</div>
