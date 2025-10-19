<script lang="ts">
    import RegisterWelcome from "./pages/RegisterWelcome.svelte";
    import RegisterIdentity from "./pages/RegisterIdentity.svelte";
    import RegisterPasskey from "./pages/RegisterPasskey.svelte";
    import RegisterQuestions from "./pages/RegisterQuestions.svelte";
    import RegisterCodes from "./pages/RegisterCodes.svelte";
    import RegisterLegal from "./pages/RegisterLegal.svelte";
    import RegisterFinishing from "./pages/RegisterFinishing.svelte";
    import RegisterEnrollment from "./pages/RegisterEnrollment.svelte";
    import { onMount } from "svelte";
    import { preloadImages } from "../../util/helper";

    let currentPage: keyof typeof pageBg = "welcome";
    let loaded = false;

    const pageBg = {
        welcome: "/grads/reg/reg_grad_welcome.png",
        identity: "/grads/reg/reg_grad_identity.png",
        passkey: "/grads/reg/reg_grad_passkey.png",
        questions: "/grads/reg/reg_grad_questions.png",
        codes: "/grads/reg/reg_grad_codes.png",
        legal: "/grads/reg/reg_grad_legal.png",
        setup: "/grads/reg/reg_grad_finishing.png",
        enrollment: "/grads/reg/reg_grad_enrollment.png",
    } as const;

    let bgA: "/grads/reg/reg_grad_welcome.png" | "/grads/reg/reg_grad_identity.png" | "/grads/reg/reg_grad_passkey.png" | "/grads/reg/reg_grad_questions.png" | "/grads/reg/reg_grad_codes.png" | "/grads/reg/reg_grad_legal.png" | "/grads/reg/reg_grad_finishing.png" | "/grads/reg/reg_grad_enrollment.png" = pageBg[currentPage];
    let bgB = "";
    let showA = true;

    function setPage(page: keyof typeof pageBg) {
        const next = pageBg[page];
        if (!next) { currentPage = page; return; }
        if (showA) { bgB = next; showA = false; }
        else { bgA = next; showA = true; }
        currentPage = page;
    }

    onMount(async () => {
        await preloadImages(Object.values(pageBg));
        loaded = true;
    });

    const setup = async () => {
        // simulate finishing delay
        setTimeout(() => {
            setPage("enrollment");
        }, 3000);
    };
</script>

{#if loaded}
    <div class="relative w-full h-full overflow-y-scroll scroll-smooth bg-[#090909]">
        <div
                class="absolute bottom-0 inset-x-0 h-[700px] bg-center bg-cover transition-opacity duration-300 will-change-[opacity] select-none pointer-events-none transform-gpu"
                style={`background-image:url(${bgA})`}
                class:opacity-0={!showA}
        ></div>
        <div
                class="absolute bottom-0 inset-x-0 h-[700px] bg-center bg-cover transition-opacity duration-300 will-change-[opacity] select-none pointer-events-none transform-gpu"
                style={`background-image:url(${bgB})`}
                class:opacity-0={showA}
        ></div>

        <div class="relative z-10">
            {#if currentPage === "welcome"}
                <RegisterWelcome onNext={() => setPage("identity")} />
            {:else if currentPage === "identity"}
                <RegisterIdentity onNext={() => setPage("passkey")} />
            {:else if currentPage === "passkey"}
                <RegisterPasskey onNext={() => setPage("questions")} />
            {:else if currentPage === "questions"}
                <RegisterQuestions onNext={() => setPage("codes")} />
            {:else if currentPage === "codes"}
                <RegisterCodes onNext={() => setPage("legal")} />
            {:else if currentPage === "legal"}
                <RegisterLegal onNext={() => setPage("setup")} />
            {:else if currentPage === "setup"}
                <RegisterFinishing />{setup()}
            {:else if currentPage === "enrollment"}
                <RegisterEnrollment />
            {/if}
        </div>
    </div>
{:else}
    <div class="bg-[#090909] w-full h-screen grid place-items-center">
        <div class="w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
    </div>
{/if}
