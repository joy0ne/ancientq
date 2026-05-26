import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',  // Important for Capacitor (relative paths)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
          // SCI knowledge base is large (~130KB); split to its own chunk
          // so it loads in parallel with the main app, not blocking startup
          sciverse: ['./src/sciverse-data.js'],
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
