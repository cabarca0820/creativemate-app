
// https://vitejs.dev/config


import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      formats: ['cjs'],
      fileName: () => 'main.js'
    },
    outDir: '.vite/build',
    // Forge builds the main and preload entries into the same directory.
    // Preserve the sibling preload bundle when the main entry is rebuilt.
    emptyOutDir: false,
    rollupOptions: {
      // Forge rebuilds this native dependency for Electron's ABI.
      external: ['node-pty']
    }
  }
})
