import react from '@vitejs/plugin-react';
import fs from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  publicDir: 'public',
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle: () => {
        // 复制扩展所需的文件到 dist 目录
        const filesToCopy = [
          'content.js',
          'content.js',
          'background.js',
          'offscreen.html',
          'offscreen.js',
          'manifest.json'
        ];
        filesToCopy.forEach((file) => {
          const src = resolve(__dirname, file);
          const dest = resolve(__dirname, 'dist', file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`Copied ${file} to dist/`);
          } else {
            console.warn(`Warning: ${file} not found`);
          }
        });
      },
    },
  ],
});
