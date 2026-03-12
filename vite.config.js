import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

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
  server: {
    port: 3000,
  },
  plugins: [
    react(),
    {
      name: 'copy-extension-files',
      closeBundle: () => {
        // 复制 content.js, background.js 等必要文件
        const filesToCopy = ['content.js', 'background.js'];
        filesToCopy.forEach((file) => {
          const src = resolve(__dirname, file);
          const dest = resolve(__dirname, 'dist', file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`Copied ${file} to dist/`);
          }
        });
      },
    },
  ],
});
