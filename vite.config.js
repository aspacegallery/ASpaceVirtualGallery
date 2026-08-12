import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    copyPublicDir: true,
  },
  server: {
    // Suppress source map warnings for dependencies
    hmr: {
      overlay: true,
    },
  },
  // Suppress source map warnings from node_modules
  logLevel: 'info',
});
