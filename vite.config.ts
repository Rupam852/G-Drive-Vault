import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // In production builds, VITE_API_BASE_URL must be set to the Render backend URL.
  // In development, we proxy /api/* to the local Express server (tsx server.ts).
  const apiBaseUrl = env.VITE_API_BASE_URL || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Proxy /api/* and /auth/* to local Express server during development
      proxy:
        mode === 'development' && !apiBaseUrl
          ? {
              '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
              },
              '/auth': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
              },
            }
          : undefined,
    },
    chunkSizeWarningLimit: 1000,
  };
});
