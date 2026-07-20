/**
 * apps/worker — Durable ingestion, research execution, and recovery.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 */

import { Effect, Layer, Redacted, Runtime, Schema } from 'effect'
import postgres from 'postgres'
import {
  DatasetCatalogRepo,
  DatasetMaterializationRepo,
  DatasetQueryEvidenceRepo,
  JobQueueRepo,
  QueryError,
  ResearchExecutionRepo,
  ResearchRunRepo,
  SourceTextReindexRepo,
  SourceVersionRepo,
  SqlClientLive,
} from '@struct/persistence'
import {
  DataEngineClient,
  DataEngineProtocolError,
  DataEngineTransportError,
  DatasetQueryAuthorizationError,
  DatasetQueryAuthenticationError,
  DatasetQueryCatalogError,
  DatasetQueryToolPersistenceError,
  DeterministicDatasetQueryInput,
  makeDeterministicDatasetQueryService,
  makeReadOnlySqlService,
} from '@struct/data-engine'
import {
  CitationId,
  DatasetCitationId,
  EventJournalId,
  QueryResultSnapshotId,
  ResearchPlanId,
  ResearchToolInputValidationError,
  ResearchToolAuthorizationError,
  ResearchToolProviderUnavailableError,
  ResearchToolSidecarUnavailableError,
  SourceVersionId,
} from '@struct/domain'
import { LocalArtifactStore } from '@struct/source-storage'
import { ingestTextSource } from '@struct/ingestion'
import { TextRetrieval } from '@struct/retrieval'
import {
  fredRuntimeConfig,
  preflightFredRuntime,
  runFredResearchPlanning,
} from '@struct/workflows'
import {
  DependencyReadinessError,
  healthResponse,
  makeTracingLayer,
  observeBoundary,
  readinessResponse,
  renderWalkingSliceMetrics,
  tracingOtlpEndpointConfig,
  withReadinessDeadline,
  withWalkingSliceSpan,
} from '@struct/observability'
import {
  artifactStorageRootConfig,
  databaseUrlConfig,
  deriveIngestionJobHeartbeatIntervalMs,
  deriveSourceTextReindexHeartbeatIntervalMs,
  validateResearchJobTiming,
  workerJobStaleMsConfig,
  workerMetricsPortConfig,
  workerPollIntervalMsConfig,
} from './config'
import { processOneIngestionJob } from './jobs/ingest-source'
import { processOneResearchJob } from './jobs/run-research'
import { makeProductionResearchWorkflow } from './jobs/research-workflow'
import { makeProductionResearchPlanningPolicy } from './jobs/research-planning'
import { processOneSourceTextReindex } from './jobs/reindex-source-text'
import { processOneDatasetMaterialization } from './jobs/materialize-dataset'
import { runWorkerPollLoops } from './polling'

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
        message: 'Worker database readiness failed',
      }))),
    )
    return Effect.sync(() => query.cancel())
  }),
)

const program = Effect.gen(function* () {
  const metricsPort = yield* workerMetricsPortConfig
  const databaseUrl = yield* databaseUrlConfig
  const artifactRoot = yield* artifactStorageRootConfig
  const pollMs = yield* workerPollIntervalMsConfig
  const staleMs = yield* workerJobStaleMsConfig
  const fredConfig = yield* fredRuntimeConfig
  const ingestionHeartbeatIntervalMs = deriveIngestionJobHeartbeatIntervalMs({
    pollIntervalMs: pollMs,
    staleMs,
  })
  const sourceTextReindexHeartbeatIntervalMs =
    deriveSourceTextReindexHeartbeatIntervalMs({
      pollIntervalMs: pollMs,
      staleMs,
    })
  const datasetMaterializationHeartbeatIntervalMs =
    deriveSourceTextReindexHeartbeatIntervalMs({
      pollIntervalMs: pollMs,
      staleMs,
    })
  const researchJobTiming = yield* validateResearchJobTiming({
    pollIntervalMs: pollMs,
    staleMs,
    researchMaxElapsedMs: fredConfig.maxElapsedMs,
  })
  const storage = yield* LocalArtifactStore.make({ root: artifactRoot })
  const sql = yield* Effect.acquireRelease(
    Effect.sync(() => postgres(Redacted.value(databaseUrl), {
      max: 5,
      idle_timeout: 5,
      connect_timeout: 2,
    })),
    (client) => Effect.promise(() => client.end({ timeout: 5 })).pipe(Effect.orDie),
  )
  const sqlLayer = SqlClientLive(sql)
  const jobLayer = Layer.provide(JobQueueRepo.Default, sqlLayer)
  const sourceVersionLayer = Layer.provide(SourceVersionRepo.Default, sqlLayer)
  const retrievalLayer = Layer.provide(TextRetrieval.Default, sqlLayer)
  const researchExecutionLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
  const researchRunLayer = Layer.provide(ResearchRunRepo.Default, sqlLayer)
  const sourceTextReindexLayer = Layer.provide(SourceTextReindexRepo.Default, sqlLayer)
  const datasetCatalogLayer = Layer.provide(DatasetCatalogRepo.Default, sqlLayer)
  const datasetMaterializationLayer = Layer.provide(
    DatasetMaterializationRepo.Default,
    sqlLayer,
  )
  const datasetQueryEvidenceLayer = Layer.provide(
    DatasetQueryEvidenceRepo.Default,
    sqlLayer,
  )
  const dataEngineClient = yield* DataEngineClient.pipe(
    Effect.provide(DataEngineClient.Default),
  )
  const readOnlySql = makeReadOnlySqlService({
    authorization: {
      authenticate: (credential) =>
        credential === 'research-worker'
          ? Effect.succeed({ userId: 'research-worker' })
          : Effect.fail(new DatasetQueryAuthenticationError({
              message: 'Dataset query worker credential is invalid',
            })),
      authorize: () => Effect.void,
    },
    catalog: {
      resolve: (workspaceId, projectId, snapshots) =>
        DatasetMaterializationRepo.resolveQuerySnapshots(
          workspaceId,
          projectId,
          snapshots,
        ).pipe(
          Effect.provide(datasetMaterializationLayer),
          Effect.mapError(() =>
            new DatasetQueryCatalogError({
              message: 'Dataset query snapshot scope could not be resolved',
            })),
        ),
    },
    client: {
      query: (request) => withWalkingSliceSpan(
        'data-engine',
        {
          workspaceId: request.workspaceId,
          projectId: request.projectId,
        },
        dataEngineClient.query(request),
      ),
    },
  })
  const deterministicDatasetQueryFor = (
    preview: Effect.Effect.Success<ReturnType<typeof readOnlySql.execute>>,
  ) => makeDeterministicDatasetQueryService({
    // The authorized read-only service has already executed this exact typed
    // request. Reuse that immutable result so citation persistence cannot
    // issue the same sidecar query a second time.
    query: { execute: () => Effect.succeed(preview) },
    store: {
      record: (result, citations) =>
        DatasetQueryEvidenceRepo.record(result, citations).pipe(
          Effect.provide(datasetQueryEvidenceLayer),
          Effect.mapError(() =>
            new DatasetQueryToolPersistenceError({
              message: 'Dataset query evidence could not be persisted',
            })),
        ),
    },
    identity: {
      resultId: () => QueryResultSnapshotId.make(crypto.randomUUID()),
      citationId: () => DatasetCitationId.make(crypto.randomUUID()),
      now: () => BigInt(Date.now()),
    },
  })
  const effectRuntime = yield* Effect.runtime<never>()
  let ready = false
  yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({
        port: metricsPort,
        async fetch(request) {
          const { pathname } = new URL(request.url)
          if (request.method !== 'GET') {
            return new Response('Method Not Allowed', { status: 405 })
          }
          if (pathname === '/healthz') return healthResponse()
          if (pathname === '/readyz') {
            return Runtime.runPromise(effectRuntime)(readinessResponse([
              {
                dependency: 'worker',
                check: ready
                  ? Effect.void
                  : Effect.fail(new DependencyReadinessError({
                      dependency: 'worker',
                      classification: 'stalled',
                      message: 'Worker startup is incomplete',
                    })),
              },
              {
                dependency: 'database',
                check: observeBoundary({
                  boundary: 'readiness',
                  event: 'worker.database.readiness',
                  identity: {},
                  effect: databaseReadinessCheck(sql),
                }),
              },
            ]))
          }
          if (pathname === '/metrics') {
            return new Response(
              await Runtime.runPromise(effectRuntime)(
                renderWalkingSliceMetrics,
              ),
              { headers: { 'Content-Type': 'text/plain; version=0.0.4' } },
            )
          }
          return new Response('Not Found', { status: 404 })
        },
      }),
    ),
    (metricsServer) =>
      Effect.promise(() => metricsServer.stop(true)).pipe(Effect.orDie),
  )

  yield* Effect.log(`Worker starting (metrics on port ${metricsPort})`)
  yield* Effect.tryPromise({
    try: () => sql.unsafe('SELECT 1'),
    catch: () => new QueryError({ operation: 'startupValidation', entity: 'WorkerDatabase', message: 'Worker database validation failed' }),
  })
  yield* preflightFredRuntime(fredConfig)
  ready = true
  yield* Effect.log('Worker ready for ingestion and research jobs')

  const poll = Effect.suspend(() => processOneIngestionJob({
    now: () => BigInt(Date.now()),
    randomSourceVersionId: () => SourceVersionId.make(crypto.randomUUID()),
    staleAfterMs: staleMs,
    heartbeatIntervalMs: ingestionHeartbeatIntervalMs,
    jobs: {
      recoverStaleIngestionJobs: (staleAfterMs) =>
        JobQueueRepo.recoverStaleIngestionJobs(staleAfterMs).pipe(
          Effect.provide(jobLayer),
        ),
      claimNextIngestionJob: () => JobQueueRepo.claimNextIngestionJob().pipe(Effect.provide(jobLayer)),
      renewLease: (job) =>
        JobQueueRepo.renewLease(job).pipe(Effect.provide(jobLayer)),
      appendInProgressEvent: (job, event) =>
        JobQueueRepo.appendInProgressEvent(job, event).pipe(Effect.provide(jobLayer)),
      markCompleted: (job, event) =>
        JobQueueRepo.markCompleted(job, event).pipe(Effect.provide(jobLayer)),
      markPending: (job, event) =>
        JobQueueRepo.markPending(job, event).pipe(Effect.provide(jobLayer)),
      markFailed: (job, event) =>
        JobQueueRepo.markFailed(job, event).pipe(Effect.provide(jobLayer)),
    },
    sourceVersions: {
      findBySourceId: (sourceId) => SourceVersionRepo.findBySourceId(sourceId).pipe(Effect.provide(sourceVersionLayer)),
      createForIngestionAttempt: (job, version) =>
        SourceVersionRepo.createForIngestionAttempt(job, version).pipe(
          Effect.provide(sourceVersionLayer),
        ),
    },
    textIndex: {
      indexText: (input) => TextRetrieval.indexText(input).pipe(Effect.provide(retrievalLayer)),
    },
    ingestion: {
      ingestTextSource: (input) => ingestTextSource({ store: storage, ...input }),
    },
  }))

  const researchPoll = Effect.suspend(() => processOneResearchJob({
    now: () => BigInt(Date.now()),
    staleAfterMs: researchJobTiming.staleMs,
    heartbeatIntervalMs: researchJobTiming.heartbeatIntervalMs,
    randomEventId: () => EventJournalId.make(crypto.randomUUID()),
    randomCitationId: () => CitationId.make(crypto.randomUUID()),
    jobs: {
      recoverStale: (staleAfterMs) =>
        ResearchExecutionRepo.recoverStale(staleAfterMs).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      claimNext: () =>
        ResearchExecutionRepo.claimNext().pipe(Effect.provide(researchExecutionLayer)),
      renewLease: (job) =>
        ResearchExecutionRepo.renewLease(job).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      appendInProgressEvent: (job, event) =>
        ResearchExecutionRepo.appendInProgressEvent(job, event).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      complete: (input) =>
        ResearchExecutionRepo.complete(input).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      fail: (input) =>
        ResearchExecutionRepo.fail(input).pipe(Effect.provide(researchExecutionLayer)),
      loadDurableState: (workspaceId, projectId, runId) =>
        ResearchExecutionRepo.loadDurableState(
          workspaceId,
          projectId,
          runId,
        ).pipe(Effect.provide(researchExecutionLayer)),
      persistPlan: (input) =>
        ResearchExecutionRepo.persistPlan(input).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      persistCheckpoint: (input) =>
        ResearchExecutionRepo.persistCheckpoint(input).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      persistPlanningFailure: (input) =>
        ResearchExecutionRepo.persistPlanningFailure(input).pipe(
          Effect.provide(researchExecutionLayer),
        ),
    },
    runs: {
      findById: (runId) =>
        ResearchRunRepo.findById(runId).pipe(Effect.provide(researchRunLayer)),
    },
    planning: {
      plan: ({ run, workspaceId, projectId, sourceVersionIds }) =>
        Effect.gen(function* () {
        const sourceScopes = yield* DatasetCatalogRepo
          .resolveResearchSourceScopes(
            workspaceId,
            projectId,
            sourceVersionIds,
          )
          .pipe(Effect.provide(datasetCatalogLayer))
        const { toolPolicy, budgetCeiling } =
          makeProductionResearchPlanningPolicy(
            sourceScopes,
            fredConfig.maxElapsedMs,
          )
        return yield* runFredResearchPlanning({
          classifier: {
            workspaceId,
            projectId,
            question: run.question,
            sourceScopes,
          },
          planner: {
            planId: ResearchPlanId.make(crypto.randomUUID()),
            runId: run.id,
            workspaceId,
            projectId,
            question: run.question,
            sourceScopes,
            toolPolicy,
            budgetCeiling,
          },
        }, fredConfig)
      }),
    },
    workflow: makeProductionResearchWorkflow({
      storage,
      runtime: effectRuntime,
      fredConfig,
      loadDurableState: (workspaceId, projectId, runId) =>
        ResearchExecutionRepo.loadDurableState(workspaceId, projectId, runId).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      retrieve: (input) =>
        TextRetrieval.searchText({ ...input, sourceVersionIds: [...input.sourceVersionIds] }).pipe(
          Effect.map((result) => result.evidence),
          Effect.provide(retrievalLayer),
        ),
      queryDataset: ({ plan, node }) => Effect.gen(function* () {
        if (node.toolInput?.kind !== "dataset-query") {
          return yield* new ResearchToolInputValidationError({
            toolId: "dataset-query", capability: "dataset:query",
            nodeId: node.id, runId: plan.runId,
            message: "Dataset query requires a typed operation spec",
          })
        }
        const spec = node.toolInput
        const alias = `"${spec.snapshot.alias}"`
        const sql = spec.operation === "count"
          ? `SELECT COUNT(*) AS row_count FROM ${alias}`
          : `SELECT ${
              spec.columns.map((column) => `"${column}"`).join(", ")
            } FROM ${alias} LIMIT ${spec.rowLimit}`
        const query = {
          credential: "research-worker", workspaceId: plan.workspaceId,
          projectId: plan.projectId, sql,
          snapshots: [{ alias: spec.snapshot.alias, datasetId: spec.snapshot.datasetId, snapshotId: spec.snapshot.datasetSnapshotId }],
          limits: spec.limits,
        }
        const preview = yield* readOnlySql.execute(query).pipe(
          Effect.mapError((failure) =>
            failure instanceof DatasetQueryAuthenticationError
            || failure instanceof DatasetQueryAuthorizationError
              ? new ResearchToolAuthorizationError({
                  toolId: "dataset-query", capability: "dataset:query",
                  nodeId: node.id, runId: plan.runId,
                  workspaceId: plan.workspaceId, projectId: plan.projectId,
                  detail: "dataset-query-authorization",
                  message: "Dataset query is not authorized",
                })
              : failure instanceof DataEngineTransportError
                  || failure instanceof DataEngineProtocolError
                ? new ResearchToolSidecarUnavailableError({
                    toolId: "dataset-query", capability: "dataset:query",
                    nodeId: node.id, runId: plan.runId,
                    message: "Dataset query sidecar failed",
                  })
                : new ResearchToolInputValidationError({
                    toolId: "dataset-query", capability: "dataset:query",
                    nodeId: node.id, runId: plan.runId,
                    message: "Dataset query request is invalid",
                  })),
        )
        const input = yield* Schema.decodeUnknown(DeterministicDatasetQueryInput)({
          query,
          citations: [{ datasetId: spec.snapshot.datasetId, datasetSnapshotId: spec.snapshot.datasetSnapshotId, selectedColumns: preview.columns.map((column) => column.name), rowStart: 0, rowEndExclusive: preview.rows.length }],
        }).pipe(Effect.mapError(() => new ResearchToolInputValidationError({
          toolId: "dataset-query", capability: "dataset:query",
          nodeId: node.id, runId: plan.runId, message: "Dataset query spec is invalid",
        })))
        return yield* deterministicDatasetQueryFor(preview).execute(input).pipe(
          Effect.mapError((failure) =>
            failure instanceof DatasetQueryAuthenticationError
            || failure instanceof DatasetQueryAuthorizationError
              ? new ResearchToolAuthorizationError({
                  toolId: "dataset-query", capability: "dataset:query",
                  nodeId: node.id, runId: plan.runId,
                  workspaceId: plan.workspaceId, projectId: plan.projectId,
                  detail: "dataset-query-authorization",
                  message: "Dataset query is not authorized",
                })
              : failure instanceof DataEngineTransportError
                  || failure instanceof DataEngineProtocolError
                ? new ResearchToolSidecarUnavailableError({
                    toolId: "dataset-query", capability: "dataset:query",
                    nodeId: node.id, runId: plan.runId,
                    message: "Dataset query sidecar failed",
                  })
                : failure instanceof DatasetQueryToolPersistenceError
                  ? new ResearchToolProviderUnavailableError({
                      toolId: "dataset-query", capability: "dataset:query",
                      nodeId: node.id, runId: plan.runId,
                      message: "Dataset evidence persistence failed",
                    })
                  : new ResearchToolInputValidationError({
                      toolId: "dataset-query", capability: "dataset:query",
                      nodeId: node.id, runId: plan.runId,
                      message: "Dataset query result is invalid",
                    })),
        )
      }),
    }),
  }))

  const reindexPoll = Effect.suspend(() => processOneSourceTextReindex({
    staleAfterMs: staleMs,
    heartbeatIntervalMs: sourceTextReindexHeartbeatIntervalMs,
    jobs: {
      recoverStale: (staleAfterMs) =>
        SourceTextReindexRepo.recoverStale(staleAfterMs).pipe(
          Effect.provide(sourceTextReindexLayer),
        ),
      claimNext: () =>
        SourceTextReindexRepo.claimNext().pipe(Effect.provide(sourceTextReindexLayer)),
      renewLease: (job) =>
        SourceTextReindexRepo.renewLease(job).pipe(
          Effect.provide(sourceTextReindexLayer),
        ),
      recordFailure: (job, errorCode) =>
        SourceTextReindexRepo.recordFailure(job, errorCode).pipe(
          Effect.provide(sourceTextReindexLayer),
        ),
    },
    store: storage,
    textIndex: {
      indexText: (input) =>
        TextRetrieval.indexText(input).pipe(Effect.provide(retrievalLayer)),
    },
  }))

  const datasetMaterializationPoll = Effect.suspend(() =>
    processOneDatasetMaterialization({
      leaseMs: staleMs,
      heartbeatIntervalMs: datasetMaterializationHeartbeatIntervalMs,
      limits: {
        maxInputBytes: 64 * 1024 * 1024,
        maxRows: 1_000_000,
        maxOutputBytes: 128 * 1024 * 1024,
        timeoutMs: 60_000,
      },
      jobs: {
        recoverExpired: () =>
          DatasetMaterializationRepo.recoverExpired().pipe(
            Effect.provide(datasetMaterializationLayer),
          ),
        claimNext: (leaseMs) =>
          DatasetMaterializationRepo.claimNext(leaseMs).pipe(
            Effect.provide(datasetMaterializationLayer),
          ),
        renewLease: (job, leaseMs) =>
          DatasetMaterializationRepo.renewLease(job, leaseMs).pipe(
            Effect.provide(datasetMaterializationLayer),
          ),
        complete: (job, materialization) =>
          DatasetMaterializationRepo.complete(job, materialization).pipe(
            Effect.provide(datasetMaterializationLayer),
          ),
        recordFailure: (job, retryable, errorCode) =>
          DatasetMaterializationRepo.recordFailure(
            job,
            retryable,
            errorCode,
          ).pipe(Effect.provide(datasetMaterializationLayer)),
      },
      catalog: {
        listSnapshots: (job) =>
          DatasetCatalogRepo.listSnapshots(
            job.workspaceId,
            job.projectId,
            job.datasetId,
          ).pipe(Effect.provide(datasetCatalogLayer)),
        getSchemaFamily: (job, familyId) =>
          DatasetCatalogRepo.getSchemaFamily(
            job.workspaceId,
            job.projectId,
            job.datasetId,
            familyId,
          ).pipe(Effect.provide(datasetCatalogLayer)),
      },
      client: dataEngineClient,
      store: storage,
    }))

  yield* runWorkerPollLoops(
    poll,
    researchPoll,
    pollMs,
    reindexPoll,
    datasetMaterializationPoll,
  )
})

Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const otlpEndpoint = yield* tracingOtlpEndpointConfig
      yield* program.pipe(
        Effect.provide(
          makeTracingLayer({
            serviceName: '@struct/worker',
            otlpEndpoint,
          }),
        ),
      )
    }),
  ),
).catch((error) => {
  console.error('Worker failed:', error)
  process.exit(1)
})
