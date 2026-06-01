import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0',
    watch: {
      usePolling: true // Asegura que funcione el hot-reload dentro de Docker en Windows
    },
    proxy: {
      // Proxy de API al backend Express
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      // Proxy de streams HLS al servidor FFmpeg/MediaMTX
      '/streams': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/streams/, '')
      }
    }
  }
})
