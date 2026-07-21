import { defineConfig, loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { basePathFromEnv, withBasePath } from './src/base-path'
import { apiProxyHeaders, appBase } from './vite-helpers'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '')
  const proxyHeaders = apiProxyHeaders(env['API_AUTH_TOKEN'])
  const basePath = basePathFromEnv(env)
  const base = appBase(basePath)
  const apiProxyTarget = `http://localhost:${Number(env['API_PORT']) || 3001}`
  return {
    base,
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
          target: apiProxyTarget,
          headers: proxyHeaders,
        },
        [withBasePath('/api', basePath)]: {
          target: apiProxyTarget,
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
