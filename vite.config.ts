import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' keeps every URL relative, so the build works at
// https://<user>.github.io/<any-repo-name>/ without knowing the repo name.
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'CVJFC Match Day',
        short_name: 'Match Day',
        description: 'Fair playing time for CVJFC.',
        theme_color: '#FFC629',
        background_color: '#FFC629',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Precache everything so the app works offline at the ground.
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ]
});
