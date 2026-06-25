import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path must match the GitHub Pages repo name so assets resolve correctly.
export default defineConfig({
  plugins: [react()],
  base: '/FROM-GAME/',
  build: {
    // Split the heavy 3D/vendor code out of the main bundle so the menu loads
    // fast and Three.js is fetched only when the player enters town.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber'],
          react: ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
