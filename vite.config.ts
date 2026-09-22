import { defineConfig } from 'vite';

// Use a relative base so the built site works from any static host
// (GitHub Pages project pages, Netlify, plain file server, etc.).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
});
