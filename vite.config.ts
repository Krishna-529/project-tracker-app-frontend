import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      isDev && componentTagger(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['/icons/favicon.ico', '/icons/robots.txt'],
        manifest: {
          name: 'Project Tracker',           
          short_name: 'Project Tracker',       
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#0a66c2',      // <-- change to your brand color
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            // optional maskable icon for Android adaptive icons
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          // runtimeCaching rules (Workbox-style) — customize TTLs for your needs
          runtimeCaching: [
            {
              // network-first for API calls (your Node backend)
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 } // 1 day
              }
            },
            {
              // images: cache-first to speed up UI
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 } // 30 days
              }
            },
            {
              // static assets: stale-while-revalidate
              urlPattern: ({ request }) =>
                request.destination === 'script' || request.destination === 'style' || request.destination === 'font',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources',
                expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 } // 7 days
              }
            }
          ]
        }
      })
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
