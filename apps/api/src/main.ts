/**
 * apps/api — Typed HTTP API boundary for the struct research workspace.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 */

import { timingSafeEqual } from 'node:crypto'
import { Cause, Effect, Layer, Option, Redacted, Runtime, Schema } from 'effect'
import postgres from 'postgres'
import {
  DatasetQueryAuthenticationError,
  DatasetQueryAuthorizationError,
} from '@struct/data-engine'
import {
  ProjectRepo,
  DirectoryControlRepo,
  DatasetQueryEvidenceRepo,
  EntityNotFoundError,
  ResearchExecutionRepo,
  ResearchProjectionRepo,
  SourceRegistrationRepo,
  SqlClientLive,
} from '@struct/persistence'
import {
  EventJournalId,
  DirectoryControlCommand,
  DirectoryRootId,
  DirectorySnapshotId,
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
  incrementWalkingSliceMetric,
  logWalkingSlice,
  makeTracingLayer,
  renderWalkingSliceMetrics,
  tracingOtlpEndpointConfig,
  withWalkingSliceSpan,
} from '@struct/observability'
import {
  apiPortConfig,
  apiAuthTokenConfig,
  artifactStorageRootConfig,
  databaseUrlConfig,
  maxTextSourceBytesConfig,
} from './config'
import { registerTextSource } from './routes/sources'
import {
  decodeDirectoryRegistrationScope,
  registerDirectory,
} from './routes/directories'
import {
  controlDirectoryJob,
  getDirectoryJobStatus,
} from './routes/ingestion-jobs'
import {
  directoryEventsResponse,
} from './routes/directory-events'
import { startResearch } from './routes/research'
import { getCitationDetail } from './routes/citations'
import {
  parseEventCursor,
  researchEventScopeFailureResponse,
  researchEventsResponse,
  resolveResearchEventScope,
} from './routes/research-events'
import { cancelResearch } from './routes/research-cancel'
import { loadRecursiveAnalysis } from './routes/recursive-analysis'
import {
  datasetQueryReadRoute,
  listDatasetQueryHistory,
  reopenDatasetCitation,
} from './routes/dataset-queries'

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

function credentialMatches(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(actual)
  return expectedBytes.length === actualBytes.length
    && timingSafeEqual(expectedBytes, actualBytes)
}

function bearerCredential(request: Request): string | undefined {
  const authorization = request.headers.get('Authorization')
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined
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
  const apiAuthToken = Redacted.value(yield* apiAuthTokenConfig)
  const artifactRoot = yield* artifactStorageRootConfig
  const maxBytes = yield* maxTextSourceBytesConfig
  const storage = yield* LocalArtifactStore.make({ root: artifactRoot })
  const sql = yield* Effect.acquireRelease(
    Effect.sync(() => postgres(databaseUrl, { max: 5, idle_timeout: 5 })),
    (client) =>
      Effect.promise(() => client.end({ timeout: 5 })).pipe(Effect.orDie),
  )
  const sqlLayer = SqlClientLive(sql)
  const projectLayer = Layer.provide(ProjectRepo.Default, sqlLayer)
  const registrationLayer = Layer.provide(SourceRegistrationRepo.Default, sqlLayer)
  const researchLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
  const projectionLayer = Layer.provide(ResearchProjectionRepo.Default, sqlLayer)
  const directoryControlLayer = Layer.provide(
    DirectoryControlRepo.Default,
    sqlLayer,
  )
  const datasetQueryEvidenceLayer = Layer.provide(
    DatasetQueryEvidenceRepo.Default,
    sqlLayer,
  )
  const effectRuntime = yield* Effect.runtime<never>()

  yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({
        port,
        async fetch(req: Request) {
      const url = new URL(req.url)

      if (url.pathname === '/healthz' && req.method === 'GET') {
        return jsonResponse({ status: 'ok', version: '0.0.1-skeleton' })
      }
      if (url.pathname === '/metrics' && req.method === 'GET') {
        return new Response(
          await Runtime.runPromise(effectRuntime)(renderWalkingSliceMetrics),
          {
          headers: { 'Content-Type': 'text/plain; version=0.0.4' },
          },
        )
      }

      const directoryRoute =
        /^\/api\/projects\/([^/]+)\/directories$/.exec(url.pathname)
      if (directoryRoute !== null && req.method === 'POST') {
        const program = Effect.gen(function* () {
          const body = yield* Effect.tryPromise({
            try: () => req.json() as Promise<{
              readonly workspaceId?: unknown
              readonly projectId?: unknown
              readonly name?: unknown
            }>,
            catch: () => new ValidationError({
              field: 'directory',
              reason: 'invalid-json',
              message: 'Invalid JSON body',
            }),
          })
          const parsed = yield* decodeDirectoryRegistrationScope(body)
          if (
            parsed.projectId !== directoryRoute[1]
          ) {
            return yield* new ValidationError({
              field: 'projectId',
              reason: 'path-body-mismatch',
              message: 'Project scope does not match the request path',
            })
          }
          return yield* registerDirectory(parsed, {
            randomSourceId: () => SourceId.make(crypto.randomUUID()),
            randomDirectoryRootId: () =>
              DirectoryRootId.make(crypto.randomUUID()),
            randomSnapshotId: () =>
              DirectorySnapshotId.make(crypto.randomUUID()),
            randomJobId: () => JobQueueId.make(crypto.randomUUID()),
            randomEventId: () => EventJournalId.make(crypto.randomUUID()),
            register: (input) => DirectoryControlRepo.register(input).pipe(
              Effect.provide(directoryControlLayer),
            ),
          })
        })
        const exit = await Runtime.runPromiseExit(effectRuntime)(program)
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          const tag = typeof failure === 'object'
            && failure !== null
            && '_tag' in failure
            ? String(failure._tag)
            : ''
          const reason = typeof failure === 'object'
            && failure !== null
            && 'reason' in failure
            ? String(failure.reason)
            : ''
          const status = failure instanceof ValidationError
            ? 400
            : tag === 'DirectoryControlConflictError'
              && reason === 'scope-not-found'
              ? 404
              : tag === 'DirectoryControlConflictError'
                ? 409
              : 503
          return jsonResponse({ error: 'DirectoryRegistrationFailed' }, status)
        }
        return jsonResponse(exit.value, 202)
      }

      const directoryJobRoute =
        /^\/api\/projects\/([^/]+)\/directory-jobs\/([^/]+)$/
          .exec(url.pathname)
      if (directoryJobRoute !== null && req.method === 'GET') {
        const scope = Effect.try({
          try: () => ({
            workspaceId: Schema.decodeUnknownSync(WorkspaceId)(
              url.searchParams.get('workspaceId'),
            ),
            projectId: Schema.decodeUnknownSync(ProjectId)(directoryJobRoute[1]),
            jobId: Schema.decodeUnknownSync(JobQueueId)(directoryJobRoute[2]),
          }),
          catch: () => new ValidationError({
            field: 'directoryJob',
            reason: 'invalid-scope',
            message: 'Directory job scope is invalid',
          }),
        })
        const exit = await Runtime.runPromiseExit(effectRuntime)(
          scope.pipe(
            Effect.flatMap((decoded) => getDirectoryJobStatus(decoded, {
              findStatus: (workspaceId, projectId, jobId) =>
                DirectoryControlRepo.findStatus(
                  workspaceId,
                  projectId,
                  jobId,
                ).pipe(Effect.provide(directoryControlLayer)),
            })),
          ),
        )
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          return failure instanceof ValidationError
            ? jsonResponse({ error: 'InvalidDirectoryJobScope' }, 400)
            : jsonResponse({ error: 'DirectoryStatusUnavailable' }, 503)
        }
        if (Option.isNone(exit.value)) {
          return jsonResponse({ error: 'DirectoryJobNotFound' }, 404)
        }
        return jsonResponse(exit.value.value)
      }

      const directoryCommandRoute =
        /^\/api\/projects\/([^/]+)\/directory-jobs\/([^/]+)\/(pause|resume|retry|cancel)$/
          .exec(url.pathname)
      if (directoryCommandRoute !== null && req.method === 'POST') {
        const program = Effect.gen(function* () {
          const body = yield* Effect.tryPromise({
            try: () => req.json() as Promise<{ readonly workspaceId?: unknown }>,
            catch: () => new ValidationError({
              field: 'directoryCommand',
              reason: 'invalid-json',
              message: 'Invalid JSON body',
            }),
          })
          const scope = yield* Effect.try({
            try: () => ({
              workspaceId: Schema.decodeUnknownSync(WorkspaceId)(
                body.workspaceId,
              ),
              projectId: Schema.decodeUnknownSync(ProjectId)(
                directoryCommandRoute[1],
              ),
              jobId: Schema.decodeUnknownSync(JobQueueId)(
                directoryCommandRoute[2],
              ),
            }),
            catch: () => new ValidationError({
              field: 'directoryCommand',
              reason: 'invalid-scope',
              message: 'Directory command scope is invalid',
            }),
          })
          const command = Schema.decodeUnknownSync(DirectoryControlCommand)(
            directoryCommandRoute[3],
          )
          return yield* controlDirectoryJob(
            scope,
            command,
            req.headers.get('Idempotency-Key') ?? '',
            {
              randomEventId: () => EventJournalId.make(crypto.randomUUID()),
              command: (input) => DirectoryControlRepo.command(input).pipe(
                Effect.provide(directoryControlLayer),
              ),
            },
          )
        })
        const exit = await Runtime.runPromiseExit(effectRuntime)(program)
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          const tag = typeof failure === 'object'
            && failure !== null
            && '_tag' in failure
            ? String(failure._tag)
            : ''
          const status = failure instanceof ValidationError
            ? 400
            : tag === 'DirectoryControlConflictError'
              && typeof failure === 'object'
              && failure !== null
              && 'reason' in failure
              && failure.reason === 'scope-not-found'
              ? 404
              : tag === 'InvalidDirectoryIngestionTransitionError'
                || tag === 'DirectoryControlConflictError'
                ? 409
                : 503
          return jsonResponse({ error: tag || 'DirectoryCommandFailed' }, status)
        }
        return jsonResponse(exit.value)
      }

      const directoryEventsRoute =
        /^\/api\/projects\/([^/]+)\/directory-jobs\/([^/]+)\/events$/
          .exec(url.pathname)
      if (directoryEventsRoute !== null && req.method === 'GET') {
        const cursor = parseEventCursor(url.searchParams.get('cursor'))
        const identifiers = Effect.try({
          try: () => ({
            workspaceId: Schema.decodeUnknownSync(WorkspaceId)(
              url.searchParams.get('workspaceId'),
            ),
            projectId: Schema.decodeUnknownSync(ProjectId)(
              directoryEventsRoute[1],
            ),
            jobId: Schema.decodeUnknownSync(JobQueueId)(
              directoryEventsRoute[2],
            ),
          }),
          catch: () => new Error('Invalid directory event scope'),
        })
        const exit = await Runtime.runPromiseExit(effectRuntime)(identifiers)
        if (cursor === undefined || exit._tag === 'Failure') {
          return jsonResponse({ error: 'InvalidDirectoryEventScope' }, 400)
        }
        const scoped = await Runtime.runPromiseExit(effectRuntime)(
          DirectoryControlRepo.findStatus(
            exit.value.workspaceId,
            exit.value.projectId,
            exit.value.jobId,
          ).pipe(Effect.provide(directoryControlLayer)),
        )
        if (scoped._tag === 'Failure') {
          return jsonResponse({ error: 'DirectoryEventsUnavailable' }, 503)
        }
        if (Option.isNone(scoped.value)) {
          return jsonResponse({ error: 'DirectoryJobNotFound' }, 404)
        }
        return directoryEventsResponse(
          exit.value.workspaceId,
          exit.value.projectId,
          exit.value.jobId,
          cursor,
          {
            listEventsAfter: (workspaceId, projectId, jobId, after, limit) =>
              DirectoryControlRepo.listEventsAfter(
                workspaceId,
                projectId,
                jobId,
                after,
                limit,
              ).pipe(Effect.provide(directoryControlLayer)),
            findStatus: (workspaceId, projectId, jobId) =>
              DirectoryControlRepo.findStatus(
                workspaceId,
                projectId,
                jobId,
              ).pipe(
                Effect.provide(directoryControlLayer),
                Effect.flatMap(Option.match({
                  onNone: () => Effect.die('directory-event-scope-lost'),
                  onSome: Effect.succeed,
                })),
              ),
          },
          req.signal,
        )
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
          const registered = yield* withWalkingSliceSpan(
            'api-request',
            {
              workspaceId: parsed.workspaceId,
              projectId: parsed.projectId,
            },
            Effect.gen(function* () {
              const registered = yield* withWalkingSliceSpan(
                'command',
                {
                  workspaceId: parsed.workspaceId,
                  projectId: parsed.projectId,
                },
                Effect.gen(function* () {
                  const registered = yield* registerTextSource(parsed, {
                    now: () => BigInt(Date.now()),
                    randomUuid: () => SourceId.make(crypto.randomUUID()),
                    randomJobQueueId: () =>
                      JobQueueId.make(crypto.randomUUID()),
                    randomEventJournalId: () =>
                      EventJournalId.make(crypto.randomUUID()),
                    maxBytes,
                    projects: {
                      findById: (projectId) =>
                        ProjectRepo.findById(projectId).pipe(
                          Effect.provide(projectLayer),
                        ),
                    },
                    registration: {
                      create: (input) =>
                        SourceRegistrationRepo.create(input).pipe(
                          Effect.provide(registrationLayer),
                        ),
                    },
                    storage,
                  })
                  yield* Effect.annotateCurrentSpan({
                    'struct.source.id': registered.source.id,
                    'struct.job.id': registered.job.id,
                  })
                  return registered
                }),
              )
              yield* Effect.annotateCurrentSpan({
                'struct.source.id': registered.source.id,
                'struct.job.id': registered.job.id,
              })
              yield* logWalkingSlice({
                event: 'source.registration.accepted',
                identity: {
                  workspaceId: parsed.workspaceId,
                  projectId: parsed.projectId,
                  sourceId: registered.source.id,
                  jobId: registered.job.id,
                },
              })
              return registered
            }),
          )
          return registered
        })

        const exit = await Runtime.runPromiseExit(effectRuntime)(program)
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
          const started = yield* withWalkingSliceSpan(
            'api-request',
            {
              workspaceId: parsed.workspaceId,
              projectId: parsed.projectId,
            },
            Effect.gen(function* () {
              const started = yield* withWalkingSliceSpan(
                'command',
                {
                  workspaceId: parsed.workspaceId,
                  projectId: parsed.projectId,
                },
                Effect.gen(function* () {
                  const started = yield* startResearch(parsed, {
                    now: () => BigInt(Date.now()),
                    randomThreadId: () =>
                      ResearchThreadId.make(crypto.randomUUID()),
                    randomRunId: () =>
                      ResearchRunId.make(crypto.randomUUID()),
                    randomJobId: () => JobQueueId.make(crypto.randomUUID()),
                    randomEventId: () =>
                      EventJournalId.make(crypto.randomUUID()),
                    register: (input) =>
                      ResearchExecutionRepo.register(input).pipe(
                        Effect.provide(researchLayer),
                      ),
                  })
                  yield* Effect.annotateCurrentSpan({
                    'struct.run.id': started.run.id,
                    'struct.job.id': started.job.id,
                  })
                  return started
                }),
              )
              yield* Effect.annotateCurrentSpan({
                'struct.run.id': started.run.id,
                'struct.job.id': started.job.id,
              })
              yield* logWalkingSlice({
                event: 'research.run.started',
                identity: {
                  workspaceId: parsed.workspaceId,
                  projectId: parsed.projectId,
                  runId: started.run.id,
                  jobId: started.job.id,
                },
              })
              yield* incrementWalkingSliceMetric('runs.started')
              return started
            }),
          )
          return started
        })

        const exit = await Runtime.runPromiseExit(effectRuntime)(program)
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
        const credential = bearerCredential(req)
        if (
          credential === undefined
          || !credentialMatches(apiAuthToken, credential)
        ) {
          return jsonResponse({ error: 'ResearchAuthenticationRequired' }, 401)
        }
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
        const exit = await Runtime.runPromiseExit(effectRuntime)(identifiers)
        if (exit._tag === 'Failure') {
          return jsonResponse({ error: 'ResearchRunNotFound' }, 404)
        }
        const scopedRun = await Runtime.runPromiseExit(effectRuntime)(
          resolveResearchEventScope(
            exit.value.projectId,
            exit.value.runId,
            {
              findProject: (projectId) => ProjectRepo.findById(projectId)
                .pipe(Effect.provide(projectLayer)),
              runExists: (workspaceId, projectId, runId) =>
                ResearchProjectionRepo.runExists(
                  workspaceId,
                  projectId,
                  runId,
                ).pipe(Effect.provide(projectionLayer)),
            },
          ),
        )
        if (scopedRun._tag === 'Failure') {
          const failure = Option.getOrUndefined(
            Cause.failureOption(scopedRun.cause),
          )
          return failure === undefined
            ? jsonResponse({ error: 'ResearchEventsUnavailable' }, 503)
            : researchEventScopeFailureResponse(failure)
        }
        return researchEventsResponse(
          scopedRun.value,
          exit.value.projectId,
          exit.value.runId,
          cursor,
          {
            listEventsAfter: (workspaceId, projectId, runId, after, limit) =>
              ResearchProjectionRepo.listEventsAfter(
                workspaceId,
                projectId,
                runId,
                after,
                limit,
              ).pipe(Effect.provide(projectionLayer)),
            findCompleted: (workspaceId, projectId, runId) =>
              ResearchProjectionRepo.findCompleted(
                workspaceId,
                projectId,
                runId,
              ).pipe(
                Effect.provide(projectionLayer),
              ),
          },
          req.signal,
        )
      }

      const cancelRoute =
        /^\/api\/projects\/([^/]+)\/runs\/([^/]+)\/cancel$/.exec(url.pathname)
      if (cancelRoute !== null && req.method === 'POST') {
        const credential = bearerCredential(req)
        if (
          credential === undefined
          || !credentialMatches(apiAuthToken, credential)
        ) {
          return jsonResponse({ error: 'ResearchAuthenticationRequired' }, 401)
        }
        const scope = Effect.try({
          try: () => ({
            workspaceId: Schema.decodeUnknownSync(WorkspaceId)(
              url.searchParams.get('workspaceId'),
            ),
            projectId: Schema.decodeUnknownSync(ProjectId)(cancelRoute[1]),
            runId: Schema.decodeUnknownSync(ResearchRunId)(cancelRoute[2]),
          }),
          catch: () => new ValidationError({
            field: 'researchCancel',
            reason: 'invalid-scope',
            message: 'Research cancellation scope is invalid',
          }),
        })
        const exit = await Runtime.runPromiseExit(effectRuntime)(
          scope.pipe(
            Effect.flatMap((decoded) => cancelResearch(
              decoded,
              req.headers.get('Idempotency-Key') ?? '',
              {
                now: () => BigInt(Date.now()),
                randomEventId: () =>
                  EventJournalId.make(crypto.randomUUID()),
                request: (input) =>
                  ResearchExecutionRepo.requestCancellation(input).pipe(
                    Effect.provide(researchLayer),
                  ),
              },
            )),
          ),
        )
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          return failure instanceof ValidationError
            ? jsonResponse({ error: 'InvalidResearchCancellation' }, 400)
            : failure instanceof AuthorizationError
              ? jsonResponse({ error: 'ResearchRunNotFound' }, 404)
              : jsonResponse({ error: 'ResearchCancellationUnavailable' }, 503)
        }
        return jsonResponse(exit.value, exit.value.result === 'cancelled' ? 202 : 200)
      }

      const recursiveAnalysisRoute =
        /^\/api\/projects\/([^/]+)\/runs\/([^/]+)\/recursive-analysis$/
          .exec(url.pathname)
      if (recursiveAnalysisRoute !== null && req.method === 'GET') {
        const credential = bearerCredential(req)
        if (
          credential === undefined
          || !credentialMatches(apiAuthToken, credential)
        ) {
          return jsonResponse({ error: 'ResearchAuthenticationRequired' }, 401)
        }
        const identifiers = Effect.try({
          try: () => ({
            projectId: Schema.decodeUnknownSync(ProjectId)(
              recursiveAnalysisRoute[1],
            ),
            runId: Schema.decodeUnknownSync(ResearchRunId)(
              recursiveAnalysisRoute[2],
            ),
          }),
          catch: () => new Error('Invalid recursive analysis identifiers'),
        })
        const identified = await Runtime.runPromiseExit(effectRuntime)(
          identifiers,
        )
        if (identified._tag === 'Failure') {
          return jsonResponse({ error: 'ResearchRunNotFound' }, 404)
        }
        const scoped = await Runtime.runPromiseExit(effectRuntime)(
          resolveResearchEventScope(
            identified.value.projectId,
            identified.value.runId,
            {
              findProject: (projectId) => ProjectRepo.findById(projectId)
                .pipe(Effect.provide(projectLayer)),
              runExists: (workspaceId, projectId, runId) =>
                ResearchProjectionRepo.runExists(
                  workspaceId,
                  projectId,
                  runId,
                ).pipe(Effect.provide(projectionLayer)),
            },
          ),
        )
        if (scoped._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(scoped.cause))
          return failure === undefined
            ? jsonResponse({ error: 'RecursiveAnalysisUnavailable' }, 503)
            : researchEventScopeFailureResponse(failure)
        }
        const loaded = await Runtime.runPromiseExit(effectRuntime)(
          loadRecursiveAnalysis(
            scoped.value,
            identified.value.projectId,
            identified.value.runId,
            {
              listEventsAfter: (
                workspaceId,
                projectId,
                runId,
                after,
                limit,
              ) => ResearchProjectionRepo.listEventsAfter(
                workspaceId,
                projectId,
                runId,
                after,
                limit,
              ).pipe(Effect.provide(projectionLayer)),
            },
          ),
        )
        if (loaded._tag === 'Failure') {
          return jsonResponse({ error: 'RecursiveAnalysisUnavailable' }, 503)
        }
        return Option.match(loaded.value, {
          onNone: () => jsonResponse({ error: 'RecursiveAnalysisNotFound' }, 404),
          onSome: (progress) => jsonResponse(progress),
        })
      }

      const citationRoute =
        /^\/api\/projects\/([^/]+)\/research\/([^/]+)\/citation\/([^/]+)$/
          .exec(url.pathname)

      const datasetQueryResponse = await Runtime.runPromise(effectRuntime)(
        datasetQueryReadRoute(req, {
          authorize: (credential, workspaceId, projectId) =>
            Effect.gen(function* () {
              if (!credentialMatches(apiAuthToken, credential)) {
                return yield* new DatasetQueryAuthenticationError({
                  message: 'API bearer credential is invalid',
                })
              }
              const project = yield* ProjectRepo.findById(projectId).pipe(
                Effect.provide(projectLayer),
                Effect.mapError(() =>
                  new DatasetQueryAuthorizationError({
                    message: 'Dataset query scope is not authorized',
                  })),
              )
              if (project.workspaceId !== workspaceId) {
                return yield* new DatasetQueryAuthorizationError({
                  message: 'Dataset query scope is not authorized',
                })
              }
            }),
          list: (workspaceId, projectId, limit) =>
            listDatasetQueryHistory(workspaceId, projectId, limit).pipe(
              Effect.provide(datasetQueryEvidenceLayer),
            ),
          reopen: (workspaceId, projectId, citationId) =>
            reopenDatasetCitation(
              workspaceId,
              projectId,
              citationId,
            ).pipe(Effect.provide(datasetQueryEvidenceLayer)),
        }),
      )
      if (datasetQueryResponse !== undefined) return datasetQueryResponse

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
        const exit = await Runtime.runPromiseExit(effectRuntime)(
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
            || failure instanceof EntityNotFoundError
            ? jsonResponse({ error: 'CitationNotFound' }, 404)
            : jsonResponse({ error: 'CitationUnavailable' }, 503)
        }
        return jsonResponse(exit.value)
      }

          return new Response('Not Found', { status: 404 })
        },
      }),
    ),
    (httpServer) =>
      Effect.promise(() => httpServer.stop(true)).pipe(Effect.orDie),
  )

  yield* Effect.log(`API server starting on port ${port}`)
  yield* Effect.log(`Health check: http://localhost:${port}/healthz`)
  yield* Effect.never
})

Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const otlpEndpoint = yield* tracingOtlpEndpointConfig
      yield* server.pipe(
        Effect.provide(
          makeTracingLayer({
            serviceName: '@struct/api',
            otlpEndpoint,
          }),
        ),
      )
    }),
  ),
).catch((error) => {
  console.error('API server failed to start:', error)
  process.exit(1)
})
