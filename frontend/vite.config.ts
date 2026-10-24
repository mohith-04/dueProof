import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],

  // Production: Django serves the built files under /static/ (via WhiteNoise),
  // so asset URLs in index.html must start with /static/.
  base: command === 'build' ? '/static/' : '/',

  // Development: React runs on :5173 and forwards every /api request to Django
  // on :8000, so the browser sees one origin, exactly like production.
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
}))
