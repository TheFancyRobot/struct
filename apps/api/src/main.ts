/**
 * apps/api — Typed HTTP API boundary for the struct research workspace.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 */

import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import {
  ProjectRepo,
  SourceRegistrationRepo,
  SqlClientLive,
} from '@struct/persistence'
import { EventJournalId, JobQueueId, SourceId, WorkspaceId, ProjectId } from '@struct/domain'
import { LocalArtifactStore } from '@struct/source-storage'
import {
  apiPortConfig,
  artifactStorageRootConfig,
  databaseUrlConfig,
  maxTextSourceBytesConfig,
} from './config'
import { registerTextSource } from './routes/sources'

interface RegisterRequestBody {
  readonly workspaceId?: unknown
  readonly projectId?: unknown
  readonly name?: unknown
  readonly mediaType?: unknown
  readonly contentBase64?: unknown
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function parseBody(body: RegisterRequestBody): Effect.Effect<{
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly name: string
  readonly mediaType: string
  readonly bytes: Uint8Array
}, Error, never> {
  return Effect.try({
    try: () => {
      if (typeof body.workspaceId !== 'string' || typeof body.projectId !== 'string') throw new Error('workspaceId and projectId are required')
      if (typeof body.name !== 'string' || typeof body.mediaType !== 'string') throw new Error('name and mediaType are required')
      if (typeof body.contentBase64 !== 'string') throw new Error('contentBase64 is required')
      return {
        workspaceId: WorkspaceId.make(body.workspaceId),
        projectId: ProjectId.make(body.projectId),
        name: body.name,
        mediaType: body.mediaType,
        bytes: Uint8Array.from(Buffer.from(body.contentBase64, 'base64')),
      }
    },
    catch: () => new Error('Invalid source registration payload'),
  })
}

const server = Effect.gen(function* () {
  const port = yield* apiPortConfig
  const databaseUrl = yield* databaseUrlConfig
  const artifactRoot = yield* artifactStorageRootConfig
  const maxBytes = yield* maxTextSourceBytesConfig
  const storage = yield* LocalArtifactStore.make({ root: artifactRoot })
  const sql = postgres(databaseUrl, { max: 5, idle_timeout: 5 })
  const sqlLayer = SqlClientLive(sql)
  const projectLayer = Layer.provide(ProjectRepo.Default, sqlLayer)
  const registrationLayer = Layer.provide(SourceRegistrationRepo.Default, sqlLayer)

  Bun.serve({
    port,
    async fetch(req: Request) {
      const url = new URL(req.url)

      if (url.pathname === '/healthz' && req.method === 'GET') {
        return jsonResponse({ status: 'ok', version: '0.0.1-skeleton' })
      }

      if (url.pathname === '/sources/text' && req.method === 'POST') {
        const program = Effect.gen(function* () {
          const body = yield* Effect.tryPromise({
            try: () => req.json() as Promise<RegisterRequestBody>,
            catch: () => new Error('Invalid JSON body'),
          })
          const parsed = yield* parseBody(body)
          return yield* registerTextSource(parsed, {
            now: () => BigInt(Date.now()),
            randomUuid: () => SourceId.make(crypto.randomUUID()),
            randomJobQueueId: () => JobQueueId.make(crypto.randomUUID()),
            randomEventJournalId: () => EventJournalId.make(crypto.randomUUID()),
            maxBytes,
            projects: {
              findById: (projectId) => ProjectRepo.findById(projectId).pipe(Effect.provide(projectLayer)),
            },
            registration: {
              create: (input) => SourceRegistrationRepo.create(input).pipe(Effect.provide(registrationLayer)),
            },
            storage,
          })
        })

        const exit = await Effect.runPromiseExit(program)
        if (exit._tag === 'Failure') {
          return jsonResponse({ error: 'SourceRegistrationFailed' }, 400)
        }
        return jsonResponse({
          sourceId: exit.value.source.id,
          jobId: exit.value.job.id,
          eventType: exit.value.event.eventType,
        }, 202)
      }

      if (url.pathname === '/events' && req.method === 'GET') {
        return new Response('SSE endpoint: walking skeleton placeholder', {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  yield* Effect.log(`API server starting on port ${port}`)
  yield* Effect.log(`Health check: http://localhost:${port}/healthz`)
  yield* Effect.never
})

Effect.runPromise(server).catch((error) => {
  console.error('API server failed to start:', error)
  process.exit(1)
})
