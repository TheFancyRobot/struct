/**
 * apps/api — Typed HTTP API boundary for the struct research workspace.
 *
 * Uses Bun's native server for the walking skeleton. Later phases
 * may integrate @effect/platform HTTP router.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 * Config is read via Effect Config.*, not process.env.
 * Invalid config causes the process to exit nonzero.
 */

import { Effect } from 'effect'
import { apiPortConfig } from './config'

const server = Effect.gen(function* () {
  const port = yield* apiPortConfig

  Bun.serve({
    port,
    fetch(req: Request) {
      const url = new URL(req.url)

      // Health check endpoint
      if (url.pathname === '/healthz' && req.method === 'GET') {
        return new Response(
          JSON.stringify({ status: 'ok', version: '0.0.1-skeleton' }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      }

      // SSE events endpoint — placeholder for walking skeleton
      if (url.pathname === '/events' && req.method === 'GET') {
        return new Response('SSE endpoint: walking skeleton placeholder', {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      }

      // 404 for everything else
      return new Response('Not Found', { status: 404 })
    },
  })

  yield* Effect.log(`API server starting on port ${port}`)
  yield* Effect.log(`Health check: http://localhost:${port}/healthz`)

  // Keep alive — Bun server runs until stopped
  yield* Effect.never
})

Effect.runPromise(server).catch((error) => {
  // Config or boot errors propagate here; log and exit nonzero
  console.error('API server failed to start:', error)
  process.exit(1)
})
