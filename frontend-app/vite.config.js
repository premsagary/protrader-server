import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'dashboard.html'),
      output: {
        entryFileNames: 'dashboard-assets/[name]-[hash].js',
        chunkFileNames: 'dashboard-assets/[name]-[hash].js',
        assetFileNames: 'dashboard-assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:3001',
    },
    open: '/dashboard.html',
  },
});
