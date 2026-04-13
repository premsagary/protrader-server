import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
      '/prices': 'http://localhost:3001',
      '/paper-trades': 'http://localhost:3001',
      '/scan-log': 'http://localhost:3001',
      '/holdings': 'http://localhost:3001',
      '/margin': 'http://localhost:3001',
      '/history': 'http://localhost:3001',
      '/crypto': 'http://localhost:3001',
      '/cleanup-trades': 'http://localhost:3001',
      '/reset-trades': 'http://localhost:3001',
      '/orders': 'http://localhost:3001',
      '/positions': 'http://localhost:3001',
      '/regime': 'http://localhost:3001',
      '/scan-now': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
    },
  },
});
