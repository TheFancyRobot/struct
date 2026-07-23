/**
 * apps/api — Typed HTTP API boundary for the struct research workspace.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 */

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
  DatasetCitationValidationError,
  DatasetQueryEvidenceScopeError,
  DurableArtifactsRepo,
  EntityNotFoundError,
  ProvenanceGraphRepo,
  ResearchExecutionRepo,
  ResearchRunRepo,
  ResearchThreadRepo,
  ResearchProjectionRepo,
  SourceRegistrationRepo,
  SourceCatalogRepo,
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
  DatasetCitationEvidence,
  DatasetCitationId,
  NotFoundError,
  SourceId,
  WorkspaceId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  ValidationError,
} from '@struct/domain'
import {
  LocalArtifactStore,
  REPORT_EXPORT_PRODUCER_VERSION,
  prepareReportExport,
  publishReportExport,
  readVerifiedReportExport,
} from '@struct/source-storage'
import {
  DependencyReadinessError,
  healthResponse,
  incrementWalkingSliceMetric,
  logWalkingSlice,
  makeTracingLayer,
  observeBoundary,
  readinessResponse,
  renderWalkingSliceMetrics,
  tracingOtlpEndpointConfig,
  withReadinessDeadline,
  withWalkingSliceSpan,
} from '@struct/observability'
import {
  apiPortConfig,
  apiAuthTokenConfig,
  apiWorkspaceIdConfig,
  artifactStorageRootConfig,
  databaseUrlConfig,
  maxTextSourceBytesConfig,
} from './config'
import {
  ApiAuthorizationError,
  authenticateApiCredential,
  authenticateApiRequest,
  authorizeWorkspace,
  isPublicApiRequest,
} from './auth'
import { projectRoute } from './routes/projects'
import { registerTextSource } from './routes/sources'
import { decodeBrowserSourceImport } from './routes/browser-source-import'
import {
  loadSourceCatalog,
  sourceActivityResponse,
} from './routes/source-catalog'
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
import { durableArtifactRoute } from './routes/durable-artifacts'
import { reportExportRoute } from './routes/report-export'

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

const databaseReadinessCheck = (
  sql: import('postgres').Sql,
): Effect.Effect<void, unknown> => withReadinessDeadline(
  'database',
  Effect.async<void, DependencyReadinessError>((resume) => {
    const query = sql.unsafe('SELECT 1')
    void query.then(
      () => resume(Effect.void),
      () => resume(Effect.fail(new DependencyReadinessError({
        dependency: 'database',
        classification: 'dependency-unavailable',
        message: 'API database readiness failed',
      }))),
    )
    return Effect.sync(() => query.cancel())
  }),
)

const server = Effect.gen(function* () {
  const port = yield* apiPortConfig
  const databaseUrl = yield* databaseUrlConfig
  const apiAuthToken = yield* apiAuthTokenConfig
  const apiWorkspaceId = yield* apiWorkspaceIdConfig
  const artifactRoot = yield* artifactStorageRootConfig
  const maxBytes = yield* maxTextSourceBytesConfig
  const storage = yield* LocalArtifactStore.make({ root: artifactRoot })
  const sql = yield* Effect.acquireRelease(
    Effect.sync(() => postgres(Redacted.value(databaseUrl), {
      max: 5,
      idle_timeout: 5,
    })),
    (client) =>
      Effect.promise(() => client.end({ timeout: 5 })).pipe(Effect.orDie),
  )
  const sqlLayer = SqlClientLive(sql)
  const projectLayer = Layer.provide(ProjectRepo.Default, sqlLayer)
  const registrationLayer = Layer.provide(SourceRegistrationRepo.Default, sqlLayer)
  const sourceCatalogLayer = Layer.provide(SourceCatalogRepo.Default, sqlLayer)
  const researchLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
  const researchRunLayer = Layer.provide(ResearchRunRepo.Default, sqlLayer)
  const researchThreadLayer = Layer.provide(ResearchThreadRepo.Default, sqlLayer)
  const projectionLayer = Layer.provide(ResearchProjectionRepo.Default, sqlLayer)
  const directoryControlLayer = Layer.provide(
    DirectoryControlRepo.Default,
    sqlLayer,
  )
  const datasetQueryEvidenceLayer = Layer.provide(
    DatasetQueryEvidenceRepo.Default,
    sqlLayer,
  )
  const durableArtifactLayer = Layer.provide(
    DurableArtifactsRepo.Default,
    sqlLayer,
  )
  const provenanceGraphLayer = Layer.provide(
    ProvenanceGraphRepo.Default,
    sqlLayer,
  )
  const effectRuntime = yield* Effect.runtime<never>()
  const authorizeApiScope = Effect.fn('ApiAuth.authorizeScope')(
    function* (
      credential: string,
      workspaceId: typeof WorkspaceId.Type,
      projectId: typeof ProjectId.Type,
    ) {
      const authenticated = yield* authenticateApiCredential(
        credential,
        apiAuthToken,
        apiWorkspaceId,
      ).pipe(Effect.mapError(() => new DatasetQueryAuthenticationError({
        message: 'API bearer credential is invalid',
      })))
      yield* authorizeWorkspace(authenticated, workspaceId).pipe(
        Effect.mapError(() => new DatasetQueryAuthorizationError({
          message: 'Resource scope is not authorized',
        })),
      )
      const project = yield* ProjectRepo.findById(projectId).pipe(
        Effect.provide(projectLayer),
        Effect.mapError(() => new DatasetQueryAuthorizationError({
          message: 'Resource scope is not authorized',
        })),
      )
      if (project.workspaceId !== workspaceId) {
        return yield* new DatasetQueryAuthorizationError({
          message: 'Resource scope is not authorized',
        })
      }
    },
  )

  const handleRequest = async (req: Request): Promise<Response> => {
      const url = new URL(req.url)

      if (isPublicApiRequest(req)) {
        if (url.pathname === '/healthz') return healthResponse()
        return Runtime.runPromise(effectRuntime)(readinessResponse([{
          dependency: 'database',
          check: observeBoundary({
            boundary: 'readiness',
            event: 'api.database.readiness',
            identity: {},
            effect: databaseReadinessCheck(sql),
          }),
        }]))
      }

      const authenticated = await Runtime.runPromiseExit(effectRuntime)(
        authenticateApiRequest(req, apiAuthToken, apiWorkspaceId),
      )
      if (authenticated._tag === 'Failure') {
        return jsonResponse({ error: 'AuthenticationRequired' }, 401)
      }
      const identity = authenticated.value

      const projectResponse = await Runtime.runPromise(effectRuntime)(projectRoute(req, identity, {
        listByWorkspaceId: (workspaceId, options) =>
          ProjectRepo.listByWorkspaceId(workspaceId, options).pipe(
            Effect.provide(projectLayer),
          ),
        createWithIdempotency: (input) =>
          ProjectRepo.createWithIdempotency(input).pipe(
            Effect.provide(projectLayer),
          ),
        findById: (projectId) =>
          ProjectRepo.findById(projectId).pipe(
            Effect.provide(projectLayer),
          ),
        randomProjectId: () => ProjectId.make(crypto.randomUUID()),
        now: () => BigInt(Date.now()),
      }))
      if (projectResponse !== undefined) return projectResponse

      const projectPath = /^\/api\/projects\/([^/]+)/.exec(url.pathname)
      if (projectPath !== null) {
        const projectScope = await Runtime.runPromiseExit(effectRuntime)(
          Effect.gen(function* () {
            const projectId = yield* Schema.decodeUnknown(ProjectId)(
              projectPath[1],
            )
            const project = yield* ProjectRepo.findById(projectId).pipe(
              Effect.provide(projectLayer),
            )
            yield* authorizeWorkspace(identity, project.workspaceId)
          }),
        )
        if (projectScope._tag === 'Failure') {
          const failure = Option.getOrUndefined(
            Cause.failureOption(projectScope.cause),
          )
          const isMalformedProjectId = typeof failure === 'object'
            && failure !== null
            && '_tag' in failure
            && failure._tag === 'ParseError'
          return failure instanceof EntityNotFoundError
            || failure instanceof ApiAuthorizationError
            || isMalformedProjectId
            ? jsonResponse({ error: 'ResourceNotFound' }, 404)
            : jsonResponse({ error: 'ProjectScopeUnavailable' }, 503)
        }
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
          yield* authorizeWorkspace(identity, parsed.workspaceId)
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
            : failure instanceof ApiAuthorizationError
              ? 404
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
            Effect.flatMap((decoded) => Effect.gen(function* () {
              yield* authorizeWorkspace(identity, decoded.workspaceId)
              return yield* getDirectoryJobStatus(decoded, {
                findStatus: (workspaceId, projectId, jobId) =>
                  DirectoryControlRepo.findStatus(
                    workspaceId,
                    projectId,
                    jobId,
                  ).pipe(Effect.provide(directoryControlLayer)),
              })
            })),
          ),
        )
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          return failure instanceof ValidationError
            ? jsonResponse({ error: 'InvalidDirectoryJobScope' }, 400)
            : failure instanceof ApiAuthorizationError
              ? jsonResponse({ error: 'ResourceNotFound' }, 404)
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
          yield* authorizeWorkspace(identity, scope.workspaceId)
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
            : failure instanceof ApiAuthorizationError
              ? 404
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
        if (exit.value.workspaceId !== identity.workspaceId) {
          return jsonResponse({ error: 'ResourceNotFound' }, 404)
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
      if (sourceRoute !== null && req.method === 'GET') {
        const projectId = Schema.decodeUnknownSync(ProjectId)(sourceRoute[1])
        const exit = await Runtime.runPromiseExit(effectRuntime)(
          loadSourceCatalog(identity.workspaceId, projectId, {
            list: (workspaceId, scopedProjectId) =>
              SourceCatalogRepo.list(workspaceId, scopedProjectId).pipe(
                Effect.provide(sourceCatalogLayer),
              ),
          }),
        )
        return exit._tag === 'Failure'
          ? jsonResponse({ error: 'SourceCatalogUnavailable' }, 503)
          : jsonResponse(exit.value)
      }

      const sourceActivityRoute =
        /^\/api\/projects\/([^/]+)\/source-activity$/.exec(url.pathname)
      if (sourceActivityRoute !== null && req.method === 'GET') {
        const cursor = parseEventCursor(url.searchParams.get('cursor'))
        if (cursor === undefined) {
          return jsonResponse({ error: 'InvalidSourceActivityCursor' }, 400)
        }
        const projectId = Schema.decodeUnknownSync(ProjectId)(
          sourceActivityRoute[1],
        )
        return sourceActivityResponse(
          identity.workspaceId,
          projectId,
          cursor,
          {
            listEventsAfter: (workspaceId, scopedProjectId, after, limit) =>
              SourceCatalogRepo.listEventsAfter(
                workspaceId,
                scopedProjectId,
                after,
                limit,
              ).pipe(Effect.provide(sourceCatalogLayer)),
          },
          req.signal,
        )
      }

      const sourceJobCommandRoute =
        /^\/api\/projects\/([^/]+)\/source-jobs\/([^/]+)\/(cancel|retry)$/
          .exec(url.pathname)
      if (sourceJobCommandRoute !== null && req.method === 'POST') {
        const decoded = Effect.try({
          try: () => ({
            projectId: Schema.decodeUnknownSync(ProjectId)(
              sourceJobCommandRoute[1],
            ),
            jobId: Schema.decodeUnknownSync(JobQueueId)(
              sourceJobCommandRoute[2],
            ),
            command: sourceJobCommandRoute[3] as 'cancel' | 'retry',
          }),
          catch: () => new ValidationError({
            field: 'sourceJob',
            reason: 'invalid-scope',
            message: 'Source job scope is invalid',
          }),
        })
        const exit = await Runtime.runPromiseExit(effectRuntime)(
          decoded.pipe(Effect.flatMap((scope) =>
            SourceCatalogRepo.controlJob(
              identity.workspaceId,
              scope.projectId,
              scope.jobId,
              scope.command,
              EventJournalId.make(crypto.randomUUID()),
              BigInt(Date.now()),
            ).pipe(Effect.provide(sourceCatalogLayer)))),
        )
        if (exit._tag === 'Failure') {
          return jsonResponse({ error: 'SourceJobControlUnavailable' }, 503)
        }
        return exit.value
          ? jsonResponse({ status: 'accepted' }, 202)
          : jsonResponse({ error: 'SourceJobNotFound' }, 404)
      }

      if (sourceRoute !== null && req.method === 'POST') {
        const program = Effect.gen(function* () {
          const parsed = yield* Effect.tryPromise({
            try: () => decodeBrowserSourceImport(req, maxBytes),
            catch: () => new ValidationError({
              field: 'sourceImport',
              reason: 'invalid',
              message: 'Invalid browser source import',
            }),
          })
          const projectId = yield* Schema.decodeUnknown(ProjectId)(sourceRoute[1])
          const results = yield* Effect.forEach(parsed.items, (item) =>
            Effect.either(Effect.gen(function* () {
              const registered = yield* withWalkingSliceSpan(
                'command',
                {
                  workspaceId: identity.workspaceId,
                  projectId,
                },
                Effect.gen(function* () {
                  const registered = yield* registerTextSource({
                    workspaceId: identity.workspaceId,
                    projectId,
                    ...item,
                  }, {
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
                  workspaceId: identity.workspaceId,
                  projectId,
                  sourceId: registered.source.id,
                  jobId: registered.job.id,
                },
              })
              return registered
            })))
          return {
            accepted: results.flatMap((result, index) =>
              result._tag === 'Right'
                ? [{
                    sourceId: result.right.source.id,
                    jobId: result.right.job.id,
                    name: parsed.items[index]!.name,
                  }]
                : []),
            rejected: [
              ...parsed.rejected,
              ...results.flatMap((result, index) =>
                result._tag === 'Left'
                  ? [{
                      name: parsed.items[index]!.name,
                      reason: result.left instanceof ValidationError
                        ? result.left.reason
                        : 'registration-failed',
                    }]
                  : []),
            ],
          }
        })

        const exit = await Runtime.runPromiseExit(effectRuntime)(program)
        if (exit._tag === 'Failure') {
          return jsonResponse({ error: 'SourceRegistrationFailed' }, 400)
        }
        return jsonResponse(exit.value, exit.value.accepted.length > 0 ? 202 : 200)
      }

      const researchRoute = /^\/api\/projects\/([^/]+)\/research$/.exec(url.pathname)
      if (researchRoute !== null && req.method === 'GET') {
        const parsedProjectId = Schema.decodeUnknownEither(ProjectId)(researchRoute[1])
        if (parsedProjectId._tag === 'Left') {
          return jsonResponse({ error: 'ResourceNotFound' }, 404)
        }
        const project = await Runtime.runPromiseExit(effectRuntime)(
          ProjectRepo.findById(parsedProjectId.right).pipe(Effect.provide(projectLayer)),
        )
        if (
          project._tag === 'Failure'
          || project.value.workspaceId !== identity.workspaceId
        ) return jsonResponse({ error: 'ResourceNotFound' }, 404)
        const threads = await Runtime.runPromiseExit(effectRuntime)(
          ResearchThreadRepo.findByProjectId(parsedProjectId.right).pipe(
            Effect.provide(researchThreadLayer),
          ),
        )
        if (threads._tag === 'Failure') {
          return jsonResponse({ error: 'ResearchServiceUnavailable' }, 503)
        }
        return jsonResponse({
          items: threads.value.map((thread) => ({
            ...thread,
            createdAt: Number(thread.createdAt),
            updatedAt: Number(thread.updatedAt),
          })),
        })
      }
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
          const parsed = yield* parseResearchBody({
            ...body,
            workspaceId: identity.workspaceId,
            projectId: researchRoute[1],
          })
          const started = yield* Effect.gen(function* () {
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
            })
          return started
        })

        const exit = await Runtime.runPromiseExit(effectRuntime)(program)
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          if (failure instanceof ApiAuthorizationError) {
            return jsonResponse({ error: 'ResourceNotFound' }, 404)
          }
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

      const researchThreadRoute =
        /^\/api\/projects\/([^/]+)\/research\/([^/]+)$/.exec(url.pathname)
      if (researchThreadRoute !== null && req.method === 'GET') {
        const identifiers = Effect.try({
          try: () => ({
            projectId: Schema.decodeUnknownSync(ProjectId)(researchThreadRoute[1]),
            threadId: Schema.decodeUnknownSync(ResearchThreadId)(researchThreadRoute[2]),
          }),
          catch: () => new Error('Invalid research thread identifiers'),
        })
        const ids = await Runtime.runPromiseExit(effectRuntime)(identifiers)
        if (ids._tag === 'Failure') return jsonResponse({ error: 'ResourceNotFound' }, 404)
        const thread = await Runtime.runPromiseExit(effectRuntime)(
          ResearchThreadRepo.findById(ids.value.threadId).pipe(
            Effect.provide(researchThreadLayer),
          ),
        )
        if (thread._tag === 'Failure' || thread.value.projectId !== ids.value.projectId) {
          return jsonResponse({ error: 'ResourceNotFound' }, 404)
        }
        const project = await Runtime.runPromiseExit(effectRuntime)(
          ProjectRepo.findById(ids.value.projectId).pipe(Effect.provide(projectLayer)),
        )
        if (
          project._tag === 'Failure'
          || project.value.workspaceId !== identity.workspaceId
        ) return jsonResponse({ error: 'ResourceNotFound' }, 404)
        const runs = await Runtime.runPromiseExit(effectRuntime)(
          ResearchRunRepo.findByThreadId(ids.value.threadId).pipe(
            Effect.provide(researchRunLayer),
          ),
        )
        if (runs._tag === 'Failure') {
          return jsonResponse({ error: 'ResearchServiceUnavailable' }, 503)
        }
        return jsonResponse({
          thread: {
            ...thread.value,
            createdAt: Number(thread.value.createdAt),
            updatedAt: Number(thread.value.updatedAt),
          },
          runs: [...runs.value].reverse().map((run) => ({
            ...run,
            createdAt: Number(run.createdAt),
            updatedAt: Number(run.updatedAt),
          })),
        })
      }
      if (researchThreadRoute !== null && req.method === 'POST') {
        const program = Effect.gen(function* () {
          const projectId = yield* Schema.decodeUnknown(ProjectId)(researchThreadRoute[1])
          const threadId = yield* Schema.decodeUnknown(ResearchThreadId)(researchThreadRoute[2])
          const thread = yield* ResearchThreadRepo.findById(threadId).pipe(
            Effect.provide(researchThreadLayer),
          )
          if (thread.projectId !== projectId) {
            return yield* new ApiAuthorizationError({ message: 'Resource scope is not authorized' })
          }
          const project = yield* ProjectRepo.findById(projectId).pipe(
            Effect.provide(projectLayer),
          )
          if (project.workspaceId !== identity.workspaceId) {
            return yield* new ApiAuthorizationError({ message: 'Resource scope is not authorized' })
          }
          const body = yield* Effect.tryPromise({
            try: () => req.json() as Promise<ResearchRequestBody>,
            catch: () => new ValidationError({
              field: 'research',
              reason: 'invalid-json',
              message: 'Invalid JSON body',
            }),
          })
          const parsed = yield* parseResearchBody({
            ...body,
            workspaceId: identity.workspaceId,
            projectId,
          })
          return yield* startResearch({ ...parsed, thread }, {
            now: () => BigInt(Date.now()),
            randomThreadId: () => ResearchThreadId.make(crypto.randomUUID()),
            randomRunId: () => ResearchRunId.make(crypto.randomUUID()),
            randomJobId: () => JobQueueId.make(crypto.randomUUID()),
            randomEventId: () => EventJournalId.make(crypto.randomUUID()),
            register: (input) => ResearchExecutionRepo.register(input).pipe(
              Effect.provide(researchLayer),
            ),
          })
        })
        const exit = await Runtime.runPromiseExit(effectRuntime)(program)
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          if (
            failure instanceof ApiAuthorizationError
            || failure instanceof EntityNotFoundError
          ) return jsonResponse({ error: 'ResourceNotFound' }, 404)
          return researchFailureResponse(exit.cause)
        }
        return jsonResponse({
          threadId: exit.value.thread.id,
          runId: exit.value.run.id,
          jobId: exit.value.job.id,
          status: exit.value.run.status,
        }, 202)
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
        if (scopedRun.value !== identity.workspaceId) {
          return jsonResponse({ error: 'ResourceNotFound' }, 404)
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
            Effect.flatMap((decoded) => Effect.gen(function* () {
              yield* authorizeWorkspace(identity, decoded.workspaceId)
              return yield* cancelResearch(
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
              )
            })),
          ),
        )
        if (exit._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
          return failure instanceof ValidationError
            ? jsonResponse({ error: 'InvalidResearchCancellation' }, 400)
            : failure instanceof ApiAuthorizationError
              ? jsonResponse({ error: 'ResourceNotFound' }, 404)
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
        if (scoped.value !== identity.workspaceId) {
          return jsonResponse({ error: 'ResourceNotFound' }, 404)
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

      const evidenceRoute =
        /^\/api\/projects\/([^/]+)\/research\/([^/]+)\/runs\/([^/]+)\/evidence\/(document|dataset)\/([^/]+)$/
          .exec(url.pathname)
      if (evidenceRoute !== null && req.method === 'GET') {
        const identifiers = Effect.try({
          try: () => ({
            projectId: Schema.decodeUnknownSync(ProjectId)(evidenceRoute[1]),
            threadId: Schema.decodeUnknownSync(ResearchThreadId)(evidenceRoute[2]),
            runId: Schema.decodeUnknownSync(ResearchRunId)(evidenceRoute[3]),
            kind: evidenceRoute[4] as 'document' | 'dataset',
            evidenceId: evidenceRoute[5] ?? '',
          }),
          catch: () => new NotFoundError({
            entityType: 'Evidence',
            entityId: evidenceRoute[5] ?? '',
            message: 'Evidence not found',
          }),
        })
        const program = identifiers.pipe(Effect.flatMap((ids) =>
          Effect.gen(function* () {
            const project = yield* ProjectRepo.findById(ids.projectId).pipe(
              Effect.provide(projectLayer),
            )
            const thread = yield* ResearchThreadRepo.findById(ids.threadId).pipe(
              Effect.provide(researchThreadLayer),
            )
            const run = yield* ResearchRunRepo.findById(ids.runId).pipe(
              Effect.provide(researchRunLayer),
            )
            if (
              project.workspaceId !== identity.workspaceId
              || thread.projectId !== ids.projectId
              || run.threadId !== ids.threadId
            ) {
              return yield* new NotFoundError({
                entityType: 'Evidence',
                entityId: ids.evidenceId,
                message: 'Evidence not found',
              })
            }

            const completed = yield* ResearchProjectionRepo.findCompleted(
              identity.workspaceId,
              ids.projectId,
              ids.runId,
            ).pipe(Effect.provide(projectionLayer))
            if (ids.kind === 'document') {
              const citationId = yield* Schema.decodeUnknown(CitationId)(ids.evidenceId)
              if (!completed.citations.some((citation) => citation.id === citationId)) {
                return yield* new NotFoundError({
                  entityType: 'Evidence',
                  entityId: citationId,
                  message: 'Evidence not found',
                })
              }
              const evidence = yield* getCitationDetail(
                ids.projectId,
                ids.threadId,
                citationId,
                (projectId, threadId, scopedCitationId) =>
                  ResearchProjectionRepo.findCitation(
                    projectId,
                    threadId,
                    scopedCitationId,
                  ).pipe(Effect.provide(projectionLayer)),
              )
              if (evidence.runId !== ids.runId) {
                return yield* new NotFoundError({
                  entityType: 'Evidence',
                  entityId: citationId,
                  message: 'Evidence not found',
                })
              }
              return { kind: 'document' as const, evidence }
            }

            const citationId = yield* Schema.decodeUnknown(DatasetCitationId)(
              ids.evidenceId,
            )
            if (
              !completed.datasetCitations.some((citation) =>
                citation.id === citationId)
            ) {
              return yield* new NotFoundError({
                entityType: 'Evidence',
                entityId: citationId,
                message: 'Evidence not found',
              })
            }
            const evidence = yield* reopenDatasetCitation(
              identity.workspaceId,
              ids.projectId,
              citationId,
            ).pipe(
              Effect.provide(datasetQueryEvidenceLayer),
              Effect.flatMap(Schema.encode(DatasetCitationEvidence)),
            )
            return { kind: 'dataset' as const, evidence }
          }),
        ))
        const result = await Runtime.runPromiseExit(effectRuntime)(program)
        if (result._tag === 'Failure') {
          const failure = Option.getOrUndefined(Cause.failureOption(result.cause))
          if (failure instanceof DatasetCitationValidationError) {
            return jsonResponse({ error: 'EvidenceInvalid' }, 409)
          }
          return failure instanceof EntityNotFoundError
            || failure instanceof NotFoundError
            || failure instanceof DatasetQueryEvidenceScopeError
            || (
              typeof failure === 'object'
              && failure !== null
              && '_tag' in failure
              && failure._tag === 'ParseError'
            )
            ? jsonResponse({ error: 'EvidenceNotFound' }, 404)
            : jsonResponse({ error: 'EvidenceUnavailable' }, 503)
        }
        return jsonResponse(result.value)
      }

      const datasetQueryResponse = await Runtime.runPromise(effectRuntime)(
        datasetQueryReadRoute(req, {
          authorize: authorizeApiScope,
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

      const durableArtifactResponse = await Runtime.runPromise(effectRuntime)(
        durableArtifactRoute(req, {
          authorize: authorizeApiScope,
          saveFinding: (finding, key) =>
            DurableArtifactsRepo.saveFinding(finding, key).pipe(
              Effect.provide(durableArtifactLayer),
            ),
          listFindings: (workspaceId, projectId) =>
            DurableArtifactsRepo.listFindings(workspaceId, projectId).pipe(
              Effect.provide(durableArtifactLayer),
            ),
          findFinding: (workspaceId, projectId, findingId) =>
            DurableArtifactsRepo.findFinding(
              workspaceId,
              projectId,
              findingId,
            ).pipe(Effect.provide(durableArtifactLayer)),
          saveReport: (report, expectedRevision, key) =>
            DurableArtifactsRepo.saveReport(
              report,
              expectedRevision,
              key,
            ).pipe(Effect.provide(durableArtifactLayer)),
          findReport: (workspaceId, projectId, reportId) =>
            DurableArtifactsRepo.findReport(
              workspaceId,
              projectId,
              reportId,
            ).pipe(Effect.provide(durableArtifactLayer)),
          findReportRevision: (
            workspaceId,
            projectId,
            reportId,
            revision,
          ) => DurableArtifactsRepo.findReportRevision(
            workspaceId,
            projectId,
            reportId,
            revision,
          ).pipe(Effect.provide(durableArtifactLayer)),
          findReportRevisionByKey: (
            workspaceId,
            projectId,
            reportId,
            key,
          ) => DurableArtifactsRepo.findReportRevisionByKey(
            workspaceId,
            projectId,
            reportId,
            key,
          ).pipe(Effect.provide(durableArtifactLayer)),
        }),
      )
      if (durableArtifactResponse !== undefined) {
        return durableArtifactResponse
      }

      const reportExportResponse = await Runtime.runPromise(effectRuntime)(
        reportExportRoute(req, {
          producerVersion: REPORT_EXPORT_PRODUCER_VERSION,
          authorize: authorizeApiScope,
          findReportRevision: (
            workspaceId,
            projectId,
            reportId,
            revision,
          ) => DurableArtifactsRepo.findReportRevision(
            workspaceId,
            projectId,
            reportId,
            revision,
          ).pipe(Effect.provide(durableArtifactLayer)),
          findProvenance: (
            workspaceId,
            projectId,
            reportId,
            revision,
          ) => ProvenanceGraphRepo.find(
            workspaceId,
            projectId,
            reportId,
            revision,
          ).pipe(Effect.provide(provenanceGraphLayer)),
          authorizeSources: (report) => Effect.gen(function* () {
            const versions = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `SELECT version.id, version.artifact_ref
                 FROM source_versions version
                 JOIN sources source ON source.id = version.source_id
                 JOIN projects project ON project.id = source.project_id
                 WHERE version.id = ANY($1::uuid[])
                   AND source.project_id = $2
                   AND project.workspace_id = $3`,
                [
                  [...report.sourceVersionIds],
                  report.projectId,
                  report.workspaceId,
                ],
              ),
              catch: () => new DatasetQueryAuthorizationError({
                message: 'Report source authorization could not be checked',
              }),
            })
            if (versions.length !== report.sourceVersionIds.length) {
              return yield* new DatasetQueryAuthorizationError({
                message: 'A report source is not visible in this scope',
              })
            }
            yield* Effect.forEach(versions, (version) =>
              storage.readObject(String(version['artifact_ref']) as
                `artifact://sha256/${string}`), { concurrency: 4 }).pipe(
              Effect.mapError(() => new DatasetQueryAuthorizationError({
                message: 'A report source artifact is no longer available',
              })),
            )
            const datasets = report.claims.flatMap((claim) =>
              claim.support.kind === 'supported'
                ? claim.support.evidence.flatMap((evidence) =>
                    evidence.payload.kind === 'dataset'
                      ? [evidence.payload.evidence]
                      : [])
                : [])
            for (const evidence of datasets) {
              const rows = yield* Effect.tryPromise({
                try: () => sql.unsafe(
                  `SELECT 1
                   FROM dataset_citations citation
                   JOIN query_result_snapshots result
                     ON result.id = citation.query_result_snapshot_id
                    AND result.workspace_id = citation.workspace_id
                    AND result.project_id = citation.project_id
                   JOIN dataset_snapshots snapshot
                     ON snapshot.id = citation.dataset_snapshot_id
                    AND snapshot.dataset_id = citation.dataset_id
                    AND snapshot.workspace_id = citation.workspace_id
                    AND snapshot.project_id = citation.project_id
                   WHERE citation.id = $1
                     AND citation.workspace_id = $2
                     AND citation.project_id = $3
                     AND citation.query_result_snapshot_id = $4
                     AND citation.dataset_snapshot_id = $5
                     AND citation.result_hash = $6
                     AND citation.result_artifact_hash = $7`,
                  [
                    evidence.citation.id,
                    report.workspaceId,
                    report.projectId,
                    evidence.citation.queryResultSnapshotId,
                    evidence.citation.datasetSnapshotId,
                    evidence.citation.resultHash,
                    evidence.citation.resultArtifactHash,
                  ],
                ),
                catch: () => new DatasetQueryAuthorizationError({
                  message: 'Dataset evidence authorization could not be checked',
                }),
              })
              if (rows.length !== 1) {
                return yield* new DatasetQueryAuthorizationError({
                  message: 'Dataset evidence is no longer visible',
                })
              }
              yield* storage.readObject(
                `artifact://sha256/${evidence.citation.resultArtifactHash
                  .slice('sha256:'.length)}`,
              ).pipe(
                Effect.mapError(() => new DatasetQueryAuthorizationError({
                  message: 'Dataset result artifact is no longer available',
                })),
              )
            }
            const recursiveArtifacts = report.claims.flatMap((claim) =>
              claim.support.kind === 'supported'
                ? claim.support.evidence.flatMap((evidence) =>
                    evidence.payload.kind === 'recursive'
                      ? [evidence.payload.reference.artifact.digest]
                      : [])
                : [])
            yield* Effect.forEach(recursiveArtifacts, (digest) =>
              storage.readObject(
                `artifact://sha256/${digest.slice('sha256:'.length)}`,
              ), { concurrency: 4 }).pipe(
              Effect.mapError(() => new DatasetQueryAuthorizationError({
                message: 'Recursive evidence artifact is no longer available',
              })),
            )
          }),
          prepare: (report, provenance) => prepareReportExport({
            report,
            provenance,
            producerVersion: REPORT_EXPORT_PRODUCER_VERSION,
          }),
          publish: (report, provenance) => publishReportExport(storage, {
            report,
            provenance,
            producerVersion: REPORT_EXPORT_PRODUCER_VERSION,
          }).pipe(Effect.map((result) => result.status)),
          read: (digest) => readVerifiedReportExport(storage, digest).pipe(
            Effect.map((result) => result.stored),
          ),
        }),
      )
      if (reportExportResponse !== undefined) return reportExportResponse

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
  }

  yield* Effect.acquireRelease(
    Effect.sync(() => Bun.serve({
      port,
      fetch(req: Request) {
        return Runtime.runPromise(effectRuntime)(observeBoundary({
          boundary: 'request',
          event: 'api.request',
          identity: {
            requestId: req.headers.get('x-request-id') ?? crypto.randomUUID(),
          },
          effect: Effect.promise(() => handleRequest(req)),
          resultClassification: (response) => response.status >= 500
            ? 'internal-failure'
            : undefined,
        }))
      },
    })),
    (httpServer) =>
      Effect.promise(() => httpServer.stop(true)).pipe(Effect.orDie),
  )

  yield* Effect.log(`API server starting on port ${port}`)
  yield* Effect.log(`Health check: http://localhost:${port}/healthz`)
  yield* Effect.log(`Readiness check: http://localhost:${port}/readyz`)
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
