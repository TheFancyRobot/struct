import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '')
  const proxyHeaders = env['API_AUTH_TOKEN'] === undefined
    ? {}
    : { Authorization: `Bearer ${env['API_AUTH_TOKEN']}` }
  return {
    plugins: [solid(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: Number(env['WEB_PORT']) || 3000,
      proxy: {
        '/api': {
          target: `http://localhost:${Number(env['API_PORT']) || 3001}`,
          headers: proxyHeaders,
        },
      },
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
      cssMinify: 'esbuild',
    },
  }
})
