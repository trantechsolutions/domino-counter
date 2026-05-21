import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bone & Pip — Domino Scorekeeper',
        short_name: 'Bone & Pip',
        description: 'Score Tracking & Pip Counting for Mexican Train Dominoes',
        theme_color: '#C8102E',
        background_color: '#F7F2E7',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [],
      },
    }),
  ],
  base: '/',
  preview: {
    historyApiFallback: true,
  },
})
