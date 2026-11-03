import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost',
          rewrite: (path) => path.replace(/^\/api/, ''),
          headers: { 'X-API-Key': env.API_KEY ?? '' },
        },
      },
    },
  }
})