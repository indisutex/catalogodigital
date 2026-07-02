import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api-siigo-auth': {
        target: 'https://api.siigo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-siigo-auth/, '/auth/v1'),
        headers: {
          'Origin': 'https://api.siigo.com'
        }
      },
      '/api-siigo': {
        target: 'https://api.siigo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-siigo/, '/v1'),
        headers: {
          'Origin': 'https://api.siigo.com'
        }
      }
    }
  }
})
