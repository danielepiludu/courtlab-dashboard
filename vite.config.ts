import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// VITE_BASE: '/' in locale, '/<repo>/' su GitHub Pages, './' per Capacitor.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons/favicon-64.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: 'donbosco-basket-monitor',
        name: 'Don Bosco Basket Monitor',
        short_name: 'Don Bosco',
        description: 'Minuti giocati e carico di fatica (INT) dei giocatori — Pallacanestro Don Bosco Livorno',
        lang: 'it',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        background_color: '#060D1F',
        theme_color: '#002855',
        categories: ['sports', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { host: true },
  preview: { host: true },
});
