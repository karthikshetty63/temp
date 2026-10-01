import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // The API only accepts requests from http://localhost:5173 (FRONTEND_ORIGIN). If that port is
  // busy, stop with a clear error instead of silently moving to 5174, where every request fails.
  server: {
    port: 5173,
    strictPort: true,
  },
})