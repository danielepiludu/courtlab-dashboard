/// <reference types="vitest" />
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
        id: 'donbosco-basket-monitor', // invariato: mantiene l'identità dell'app già installata
        name: 'Basket Monitor',
        short_name: 'Basket Monitor',
        description: 'Minuti giocati e carico di fatica (INT) dei giocatori, per più squadre',
        lang: 'it',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        background_color: '#050f1a',
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
        // moduli opzionali di jsPDF mai usati dall'app (html(), SVG): non servono offline
        globIgnores: ['**/html2canvas*', '**/purify.es*', '**/index.es-*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { environment: 'node' },
  server: { host: true },
  preview: { host: true },
});
