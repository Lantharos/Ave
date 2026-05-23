<script lang="ts">
    import { resolve } from "$app/paths";
    import AuroraBackdrop from "$lib/surfaces/web/components/AuroraBackdrop.svelte";
</script>

<div class="bg-[#090909] w-full h-screen-fixed flex flex-col items-center justify-center px-[200px] py-[100px] gap-[50px] relative">
    <h1 class="font-extrabold text-[#FFFFFF]/80 text-[96px]">
        404
    </h1>
    <h2 class="font-medium text-[#B9BBBE] text-[36px]">
        Oops! The page you're looking for doesn't exist.
    </h2>
    <p class="text-[#878787] text-[24px] max-w-[80%] text-center">
        It seems you've ventured into uncharted territory. Don't worry, you can head back to the <a href={resolve("/" as any)} class="underline hover:text-[#FFFFFF]">home page</a> or explore our <a href={resolve("/faq" as any)} class="underline hover:text-[#FFFFFF]">FAQ</a> for more information.
    </p>
    <AuroraBackdrop preset="not-found" cclass="absolute bottom-0 left-0 w-full pointer-events-none select-none" />
</div>
