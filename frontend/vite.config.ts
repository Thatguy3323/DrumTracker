import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    // Only allow specific hosts to prevent CSRF attacks
    allowedHosts: isDev
      ? ['localhost', '127.0.0.1', '0.0.0.0']
      : ['drumtracker.example.com'], // Change to your production domain
    proxy: isDev
      ? {
          '/api': {
            target: process.env.VITE_API_URL || 'http://localhost:8080',
            changeOrigin: true,
          },
        }
      : undefined, // No proxy needed in production
  },
})
