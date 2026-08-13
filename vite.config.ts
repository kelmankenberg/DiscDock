import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Renderer build config. Electron main/preload are compiled separately via tsc (see electron/tsconfig.json).
export default defineConfig({
  root: 'src',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
