import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  appType: 'spa',
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

          if (id.includes("@simplewebauthn") || id.includes("@noble")) {
            return "vendor-auth";
          }

          if (id.includes("qrcode")) {
            return "vendor-qr";
          }

          if (id.includes("@mateothegreat")) {
            return "vendor-router";
          }
        },
      },
    },
  },
})
