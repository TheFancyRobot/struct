import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import path from 'node:path'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT) || 3000,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    // Use esbuild CSS minifier to avoid lightningcss warnings on
    // Tailwind 4 custom @theme/@plugin/@tailwind at-rules.
    // PostCSS (via Tailwind compiler) handles these correctly at build time;
    // lightningcss only warns during final minification pass.
    cssMinify: 'esbuild',
  },
})
