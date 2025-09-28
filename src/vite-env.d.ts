/// <reference types="vite/client" />

// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',     // was 'build'
    emptyOutDir: true
  }
})
