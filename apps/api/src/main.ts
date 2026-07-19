/**
 * apps/api — Typed HTTP API boundary for the struct research workspace.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 */

import { Cause, Effect, Layer, Option, Schema } from 'effect'
import postgres from 'postgres'
import {
  ProjectRepo,
  ResearchExecutionRepo,
  ResearchProjectionRepo,
  SourceRegistrationRepo,
  SqlClientLive,
} from '@struct/persistence'
import {
  EventJournalId,
  JobQueueId,
  AuthorizationError,
  CitationId,
  NotFoundError,
  SourceId,
  WorkspaceId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  ValidationError,
} from '@struct/domain'
import { LocalArtifactStore } from '@struct/source-storage'
import {
  apiPortConfig,
  artifactStorageRootConfig,
  databaseUrlConfig,
  maxTextSourceBytesConfig,
} from './config'
import { registerTextSource } from './routes/sources'
import { startResearch } from './routes/research'
import { getCitationDetail } from './routes/citations'
import {
  parseEventCursor,
  researchEventsResponse,
} from './routes/research-events'

interface RegisterRequestBody {
  readonly workspaceId?: unknown
  readonly projectId?: unknown
  readonly name?: unknown
  readonly mediaType?: unknown
  readonly contentBase64?: unknown
}

interface ResearchRequestBody {
  readonly workspaceId?: unknown
  readonly projectId?: unknown
  readonly sourceVersionIds?: unknown
  readonly question?: unknown
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
        workspaceId: Schema.decodeUnknownSync(WorkspaceId)(body.workspaceId),
        projectId: Schema.decodeUnknownSync(ProjectId)(body.projectId),
        name: body.name,
        mediaType: body.mediaType,
        bytes: Uint8Array.from(Buffer.from(body.contentBase64, 'base64')),
      }
    },
    catch: () => new Error('Invalid source registration payload'),
  })
}

function parseResearchBody(body: ResearchRequestBody): Effect.Effect<{
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly sourceVersionIds: ReadonlyArray<typeof SourceVersionId.Type>
  readonly question: string
}, ValidationError, never> {
  return Effect.try({
    try: () => {
      if (
        typeof body.workspaceId !== 'string' ||
        typeof body.projectId !== 'string' ||
        typeof body.question !== 'string' ||
        !Array.isArray(body.sourceVersionIds) ||
        !body.sourceVersionIds.every((value) => typeof value === 'string')
      ) {
        throw new Error('Invalid research request')
      }
      return {
        workspaceId: Schema.decodeUnknownSync(WorkspaceId)(body.workspaceId),
        projectId: Schema.decodeUnknownSync(ProjectId)(body.projectId),
        sourceVersionIds: body.sourceVersionIds.map((value) =>
          Schema.decodeUnknownSync(SourceVersionId)(value),
        ),
        question: body.question,
      }
    },
    catch: () =>
      new ValidationError({
        field: 'research',
        reason: 'invalid-payload',
        message: 'Invalid research payload',
      }),
  })
}

function researchFailureResponse(cause: Cause.Cause<unknown>): Response {
  const failure = Option.getOrUndefined(Cause.failureOption(cause))
  if (failure instanceof ValidationError) {
    return jsonResponse({ error: 'InvalidResearchRequest' }, 400)
  }
  if (failure instanceof AuthorizationError) {
    return jsonResponse({ error: 'ResearchScopeForbidden' }, 403)
  }
  return jsonResponse({ error: 'ResearchServiceUnavailable' }, 503)
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
  const researchLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
  const projectionLayer = Layer.provide(ResearchProjectionRepo.Default, sqlLayer)

  Bun.serve({
    port,
    async fetch(req: Request) {
      const url = new URL(req.url)

      if (url.pathname === '/healthz' && req.method === 'GET') {
        return jsonResponse({ status: 'ok', version: '0.0.1-skeleton' })
      }

      const sourceRoute = /^\/api\/projects\/([^/]+)\/sources$/.exec(url.pathname)
      if (sourceRoute !== null && req.method === 'POST') {
        const program = Effect.gen(function* () {
          const body = yield* Effect.tryPromise({
            try: () => req.json() as Promise<RegisterRequestBody>,
            catch: () => new Error('Invalid JSON body'),
          })
          const parsed = yield* parseBody(body)
          if (parsed.projectId !== sourceRoute[1]) {
            return yield* Effect.fail(new Error('Project scope mismatch'))
          }
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

      const researchRoute = /^\/api\/projects\/([^/]+)\/research$/.exec(url.pathname)
      if (researchRoute !== null && req.method === 'POST') {
        const program = Effect.gen(function* () {
          const body = yield* Effect.tryPromise({
            try: () => req.json() as Promise<ResearchRequestBody>,
            catch: () =>
              new ValidationError({
                field: 'research',
                reason: 'invalid-json',
                message: 'Invalid JSON body',
              }),
          })
          const parsed = yield* parseResearchBody(body)
          if (parsed.projectId !== researchRoute[1]) {
            return yield* new ValidationError({
              field: 'projectId',
              reason: 'path-body-mismatch',
              message: 'Project scope does not match the request path',
            })
          }
          return yield* startResearch(parsed, {
            now: () => BigInt(Date.now()),
            randomThreadId: () => ResearchThreadId.make(crypto.randomUUID()),
            randomRunId: () => ResearchRunId.make(crypto.randomUUID()),
            randomJobId: () => JobQueueId.make(crypto.randomUUID()),
            randomEventId: () => EventJournalId.make(crypto.randomUUID()),
            register: (input) =>
              ResearchExecutionRepo.register(input).pipe(Effect.provide(researchLayer)),
          })
        })

        const exit = await Effect.runPromiseExit(program)
        if (exit._tag === 'Failure') {
          return researchFailureResponse(exit.cause)
        }
        return jsonResponse(
          {
            threadId: exit.value.thread.id,
            runId: exit.value.run.id,
            jobId: exit.value.job.id,
            status: exit.value.run.status,
          },
          202,
        )
      }

      const eventsRoute =
        /^\/api\/projects\/([^/]+)\/runs\/([^/]+)\/events$/.exec(url.pathname)
      if (eventsRoute !== null && req.method === 'GET') {
        const cursor = parseEventCursor(url.searchParams.get('cursor'))
        if (cursor === undefined) {
          return jsonResponse({ error: 'InvalidEventCursor' }, 400)
        }
        const identifiers = Effect.try({
          try: () => ({
            projectId: Schema.decodeUnknownSync(ProjectId)(eventsRoute[1]),
            runId: Schema.decodeUnknownSync(ResearchRunId)(eventsRoute[2]),
          }),
          catch: () => new Error('Invalid event stream identifiers'),
        })
        const exit = await Effect.runPromiseExit(identifiers)
        if (exit._tag === 'Failure') {
          return jsonResponse({ error: 'ResearchRunNotFound' }, 404)
        }
        return researchEventsResponse(
          exit.value.projectId,
          exit.value.runId,
          cursor,
          {
            listEventsAfter: (projectId, runId, after, limit) =>
              ResearchProjectionRepo.listEventsAfter(
                projectId,
                runId,
                after,
                limit,
              ).pipe(Effect.provide(projectionLayer)),
            findCompleted: (runId) =>
              ResearchProjectionRepo.findCompleted(runId).pipe(
                Effect.provide(projectionLayer),
              ),
          },
          req.signal,
        )
      }

      const citationRoute =
        /^\/api\/projects\/([^/]+)\/research\/([^/]+)\/citation\/([^/]+)$/
          .exec(url.pathname)
      if (citationRoute !== null && req.method === 'GET') {
        const identifiers = Effect.try({
          try: () => ({
            projectId: Schema.decodeUnknownSync(ProjectId)(citationRoute[1]),
            threadId: Schema.decodeUnknownSync(ResearchThreadId)(citationRoute[2]),
            citationId: Schema.decodeUnknownSync(CitationId)(citationRoute[3]),
          }),
          catch: () => new NotFoundError({
            entityType: 'Citation',
            entityId: citationRoute[3] ?? '',
            message: 'Citation not found',
          }),
        })
        const exit = await Effect.runPromiseExit(
          identifiers.pipe(
            Effect.flatMap(({ projectId, threadId, citationId }) =>
              getCitationDetail(
                projectId,
                threadId,
                citationId,
                (scopedProjectId, scopedThreadId, scopedCitationId) =>
                  ResearchProjectionRepo.findCitation(
                    scopedProjectId,
                    scopedThreadId,
                    scopedCitationId,
                  ).pipe(Effect.provide(projectionLayer)),
              ),
            ),
          ),
        )
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          return failure instanceof NotFoundError
            ? jsonResponse({ error: 'CitationNotFound' }, 404)
            : jsonResponse({ error: 'CitationUnavailable' }, 503)
        }
        return jsonResponse(exit.value)
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
