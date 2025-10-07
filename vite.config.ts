import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',                 // critical to avoid asset 404s on SWA
  build: { outDir: 'dist' }  // Vite default, explicit here
})
