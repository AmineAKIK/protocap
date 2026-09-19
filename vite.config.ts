import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim();

export default defineConfig({
  base,
  server: apiProxyTarget ? {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: false,
      },
    },
  } : undefined,
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
          'Portfolio d’ingénierie et démonstrateur interactif pour les opérations industrielles.',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/\/[^/?]+\.[^/]+$/],
      }
    })
  ]
});
