import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
        appleMusic: resolve(__dirname, 'src/content/appleMusic.ts'),
        youtubeMusic: resolve(__dirname, 'src/content/youtubeMusic.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});