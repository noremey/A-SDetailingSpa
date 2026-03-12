import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Base path: change in .env file
  // Local XAMPP: /ansspa/
  // Production (ansspa.eduhubtech.net): /
  const basePath = env.VITE_BASE_PATH || '/ansspa/';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/*.png'],
        manifest: {
          name: 'ANSSPA - Loyalty & Rewards',
          short_name: 'ANSSPA',
          description: 'ANSSPA - Loyalty Card & Rewards',
          theme_color: '#6366f1',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          scope: basePath,
          start_url: `${basePath}login`,
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['assets/**/*.{js,css}', 'index.html', 'icons/**/*.png', 'favicon.ico'],
          navigateFallback: null,
          importScripts: ['push-sw.js'],
          runtimeCaching: [
            {
              urlPattern: /^https?:\/\/.*\/api\//,
              handler: 'NetworkOnly',
              method: 'GET',
            },
            {
              urlPattern: /^https?:\/\/.*\/api\//,
              handler: 'NetworkOnly',
              method: 'POST',
            },
            {
              urlPattern: /^https?:\/\/.*\/api\//,
              handler: 'NetworkOnly',
              method: 'PUT',
            },
            {
              urlPattern: /^https?:\/\/.*\/api\//,
              handler: 'NetworkOnly',
              method: 'DELETE',
            }
          ]
        }
      })
    ],
    base: basePath,
    server: {
      port: 5173,
      proxy: {
        [`${basePath}api`]: {
          target: 'http://localhost',
          changeOrigin: true,
        }
      }
    },
    build: {
      outDir: '../',
      emptyOutDir: false,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    }
  };
});
