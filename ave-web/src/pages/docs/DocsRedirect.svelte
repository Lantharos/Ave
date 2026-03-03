<script lang="ts">
    import { onMount } from "svelte";

    const DOCS_URL = "https://docs.aveid.net";

    onMount(() => {
        window.location.replace(DOCS_URL);
    });
</script>

<div class="bg-[#090909] w-full min-h-screen-fixed grid place-items-center px-6">
    <div class="text-center">
        <h1 class="text-white text-3xl font-bold mb-4">Ave Docs moved</h1>
        <p class="text-[#B9BBBE] text-lg mb-6">The documentation now lives on Mintlify.</p>
        <a
            href="https://docs.aveid.net"
            class="inline-flex px-6 py-3 rounded-full bg-[#171717] hover:bg-[#1f1f1f] text-[#D3D3D3] transition-colors"
        >
            Open docs
        </a>
    </div>
</div>
