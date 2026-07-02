import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api-siigo-auth': {
        target: 'https://api.siigo.com/auth/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-siigo-auth/, ''),
        headers: {
          'Origin': 'https://api.siigo.com'
        }
      },
      '/api-siigo': {
        target: 'https://api.siigo.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-siigo/, ''),
        headers: {
          'Origin': 'https://api.siigo.com'
        }
      }
    }
  }
})
