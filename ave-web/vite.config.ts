import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  server: {
    // Enable SPA fallback - serve index.html for all routes
    historyApiFallback: true,
  },
  appType: 'spa',
})
