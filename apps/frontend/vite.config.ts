import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/app/router/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SAMI v2',
        short_name: 'SAMI',
        description: 'Plataforma empresarial SAMI',
        theme_color: '#21A795',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '48x48',
            type: 'image/x-icon',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    /** Preferido 5173; si está ocupado Vite usa 5174+ (mensaje en consola). Cerrá el otro Vite para no mezclar URLs. */
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
