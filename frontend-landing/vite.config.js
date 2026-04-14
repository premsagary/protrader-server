import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: 'landing-assets/[name]-[hash].js',
        chunkFileNames: 'landing-assets/[name]-[hash].js',
        assetFileNames: 'landing-assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5174,
  },
});
