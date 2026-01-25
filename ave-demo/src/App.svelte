<script>
  import Header from "./components/Header.svelte";
  import Hero from "./components/Hero.svelte";
  import Footer from "./components/Footer.svelte";
  import DemoCard from "./components/DemoCard.svelte";
  import CodeExample from "./components/CodeExample.svelte";
  import E2EEModal from "./components/modals/E2EEModal.svelte";
  import SigningModal from "./components/modals/SigningModal.svelte";
  
  import { store } from "./lib/store.svelte.js";
  import { tryPopupAuth, trySheetAuth } from "./lib/auth.js";
  
  const demos = [
    {
      id: "oauth-popup",
      title: "Popup Auth",
      description: "Classic popup window flow, great for desktop apps.",
      icon: "window",
      action: tryPopupAuth,
    },
    {
      id: "oauth-sheet", 
      title: "Sheet Auth",
      description: "Bottom sheet modal, perfect for mobile-first apps.",
      icon: "sheet",
      action: trySheetAuth,
    },
    {
      id: "e2ee-notes",
      title: "E2EE Notes",
      description: "End-to-end encrypted notes using Ave's encryption keys.",
      icon: "lock",
      action: () => store.activeDemo = "e2ee-notes",
    },
    {
      id: "signing",
      title: "Ave Signing",
      description: "Cryptographically sign messages with your Ave identity.",
      icon: "pen",
      action: () => store.activeDemo = "signing",
    },
  ];
</script>

<div class="min-h-screen bg-[#090909] relative overflow-hidden">
  <!-- Ambient gradient background -->
  <div class="absolute inset-0 pointer-events-none">
    <div class="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]"></div>
    <div class="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px]"></div>
  </div>
  
  <Header />
  
  <!-- Main content -->
  <main class="relative z-10 max-w-6xl mx-auto px-6 py-16">
    <Hero />
    
    <!-- Demo grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
      {#each demos as demo}
        <DemoCard 
          title={demo.title}
          description={demo.description}
          icon={demo.icon}
          onclick={demo.action}
        />
      {/each}
    </div>
    
    <CodeExample />
    
    <Footer />
  </main>
</div>

<!-- Modals -->
{#if store.activeDemo === "e2ee-notes"}
  <E2EEModal onclose={() => store.activeDemo = null} />
{/if}

{#if store.activeDemo === "signing"}
  <SigningModal onclose={() => store.activeDemo = null} />
{/if}
