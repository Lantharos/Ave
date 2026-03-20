import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("ogl")) {
            return "vendor-effects";
          }

          if (id.includes("lucide-svelte")) {
            return "vendor-icons";
          }
        },
      },
    },
  },
});
