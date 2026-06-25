import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path must match the GitHub Pages repo name so assets resolve correctly.
export default defineConfig({
  plugins: [react()],
  base: '/FROM-GAME/',
});
