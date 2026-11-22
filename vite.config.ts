import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]

export default defineConfig({
  base: process.env.VITE_BASE ?? (repository ? `/${repository}/` : '/'),
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@electric-sql/pglite', '@electric-sql/pglite-tools'],
  },
  worker: {
    format: 'es',
  },
  build: {
    manifest: true,
  },
})
