import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
const icons = {
  name: 'copy-icons',
  generateBundle(this: any) {
    for (const f of ['icon-192.png', 'icon-512.png']) this.emitFile({ type: 'asset', fileName: f, source: fs.readFileSync(f) });
  },
};
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), icons, VitePWA({
    registerType: 'autoUpdate',
    manifest: { name: 'Minuti Basket', short_name: 'Minuti', description: 'Minuti e carico dei giocatori', lang: 'it',
      display: 'standalone', orientation: 'any', background_color: '#f3e9d6', theme_color: '#f3e9d6',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'] }
  })]
});
