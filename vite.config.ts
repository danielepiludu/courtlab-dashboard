/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// VITE_BASE: '/' in locale, '/<repo>/' su GitHub Pages, './' per Capacitor.
const base = process.env.VITE_BASE ?? '/';
// indirizzo pubblico completo (per le anteprime dei link nelle chat), es. https://utente.github.io/repo/
const site = process.env.VITE_SITE_URL ?? '';

export default defineConfig({
  base,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      // due pagine: l'app dello staff e la pagina leggera del link RPE per gli atleti
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        rpe: fileURLToPath(new URL('./rpe/index.html', import.meta.url)),
      },
    },
  },
  plugins: [
    react(),
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', site) },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons/favicon-64.png', 'icons/apple-touch-icon.png', 'icons/app-logo.png'],
      manifest: {
        id: 'donbosco-basket-monitor', // invariato: mantiene l'identità dell'app già installata
        name: 'Courtlab',
        short_name: 'Courtlab',
        description: 'Minuti giocati e carico di fatica (INT) dei giocatori, per più squadre',
        lang: 'it',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        background_color: '#06162b',
        theme_color: '#06162b',
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
        // la pagina del link atleti non deve mai essere sostituita dall'app dello staff
        navigateFallbackDenylist: [/\/rpe\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: { environment: 'node' },
  server: { host: true },
  preview: { host: true },
});
