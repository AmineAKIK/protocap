import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        id: base,
        name: 'ProtoCap',
        short_name: 'ProtoCap',
        description:
          'Démonstrateur interactif d’ingénierie des opérations industrielles pour les équipes de production.',
        lang: 'fr',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
});
