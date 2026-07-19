import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT) || 3000,
    proxy: {
      '/api': {
        target: `http://localhost:${Number(process.env.API_PORT) || 3001}`,
      },
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    cssMinify: 'esbuild',
  },
})
