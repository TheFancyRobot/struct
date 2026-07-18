/**
 * apps/worker — Durable ingestion, research execution, and recovery.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 */

import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import {
  EventJournalRepo,
  JobQueueRepo,
  QueryError,
  ResearchExecutionRepo,
  ResearchRunRepo,
  SourceRepo,
  SourceVersionRepo,
  SqlClientLive,
} from '@struct/persistence'
import { CitationId, EventJournalId, SourceVersionId } from '@struct/domain'
import { LocalArtifactStore } from '@struct/source-storage'
import { ingestTextSource } from '@struct/ingestion'
import { TextRetrieval } from '@struct/retrieval'
import { validateAnswerCitations } from '@struct/research-engine'
import {
  fredRuntimeConfig,
  preflightFredRuntime,
  runFredWalkingSkeleton,
} from '@struct/fred-workflows'
import {
  artifactStorageRootConfig,
  databaseUrlConfig,
  workerJobStaleMsConfig,
  workerMetricsPortConfig,
  workerPollIntervalMsConfig,
} from './config'
import { processOneIngestionJob } from './jobs/ingest-source'
import { processOneResearchJob } from './jobs/run-research'
import { runWorkerPollLoops } from './polling'

const program = Effect.gen(function* () {
  const metricsPort = yield* workerMetricsPortConfig
  const databaseUrl = yield* databaseUrlConfig
  const artifactRoot = yield* artifactStorageRootConfig
  const pollMs = yield* workerPollIntervalMsConfig
  const staleMs = yield* workerJobStaleMsConfig
  const fredConfig = yield* fredRuntimeConfig
  const storage = yield* LocalArtifactStore.make({ root: artifactRoot })
  const sql = yield* Effect.acquireRelease(
    Effect.sync(() => postgres(databaseUrl, { max: 5, idle_timeout: 5, connect_timeout: 2 })),
    (client) => Effect.promise(() => client.end({ timeout: 5 })).pipe(Effect.orDie),
  )
  const sqlLayer = SqlClientLive(sql)
  const jobLayer = Layer.provide(JobQueueRepo.Default, sqlLayer)
  const sourceVersionLayer = Layer.provide(SourceVersionRepo.Default, sqlLayer)
  const sourceLayer = Layer.provide(SourceRepo.Default, sqlLayer)
  const eventLayer = Layer.provide(EventJournalRepo.Default, sqlLayer)
  const retrievalLayer = Layer.provide(TextRetrieval.Default, sqlLayer)
  const researchExecutionLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
  const researchRunLayer = Layer.provide(ResearchRunRepo.Default, sqlLayer)

  yield* Effect.log(`Worker starting (metrics on port ${metricsPort})`)
  yield* Effect.tryPromise({
    try: () => sql.unsafe('SELECT 1'),
    catch: () => new QueryError({ operation: 'startupValidation', entity: 'WorkerDatabase', message: 'Worker database validation failed' }),
  })
  yield* preflightFredRuntime(fredConfig)
  yield* Effect.log('Worker ready for ingestion and research jobs')

  const poll = Effect.suspend(() => processOneIngestionJob({
    now: () => BigInt(Date.now()),
    randomSourceVersionId: () => SourceVersionId.make(crypto.randomUUID()),
    staleBeforeMs: Date.now() - staleMs,
    jobs: {
      recoverStaleIngestionJobs: (staleBeforeMs) => JobQueueRepo.recoverStaleIngestionJobs(staleBeforeMs).pipe(Effect.provide(jobLayer)),
      claimNextIngestionJob: () => JobQueueRepo.claimNextIngestionJob().pipe(Effect.provide(jobLayer)),
      markCompleted: (id) => JobQueueRepo.markCompleted(id).pipe(Effect.provide(jobLayer)),
      markPending: (id) => JobQueueRepo.markPending(id).pipe(Effect.provide(jobLayer)),
      markFailed: (id) => JobQueueRepo.markFailed(id).pipe(Effect.provide(jobLayer)),
    },
    sourceVersions: {
      findBySourceId: (sourceId) => SourceVersionRepo.findBySourceId(sourceId).pipe(Effect.provide(sourceVersionLayer)),
      create: (version) => SourceVersionRepo.create(version).pipe(Effect.provide(sourceVersionLayer)),
    },
    sources: {
      findProjectId: (sourceId) =>
        SourceRepo.findById(sourceId).pipe(
          Effect.map((source) => source.projectId),
          Effect.provide(sourceLayer),
        ),
    },
    textIndex: {
      indexText: (input) => TextRetrieval.indexText(input).pipe(Effect.provide(retrievalLayer)),
    },
    events: {
      append: (event) => EventJournalRepo.append(event).pipe(Effect.provide(eventLayer)),
    },
    ingestion: {
      ingestTextSource: (input) => ingestTextSource({ store: storage, ...input }),
    },
  }))

  const researchPoll = Effect.suspend(() => processOneResearchJob({
    now: () => BigInt(Date.now()),
    staleBeforeMs: Date.now() - staleMs,
    randomEventId: () => EventJournalId.make(crypto.randomUUID()),
    randomCitationId: () => CitationId.make(crypto.randomUUID()),
    jobs: {
      recoverStale: (staleBeforeMs) =>
        ResearchExecutionRepo.recoverStale(staleBeforeMs).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      claimNext: () =>
        ResearchExecutionRepo.claimNext().pipe(Effect.provide(researchExecutionLayer)),
      appendEvent: (event) =>
        ResearchExecutionRepo.appendEvent(event).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      complete: (input) =>
        ResearchExecutionRepo.complete(input).pipe(
          Effect.provide(researchExecutionLayer),
        ),
      fail: (input) =>
        ResearchExecutionRepo.fail(input).pipe(Effect.provide(researchExecutionLayer)),
    },
    runs: {
      findById: (runId) =>
        ResearchRunRepo.findById(runId).pipe(Effect.provide(researchRunLayer)),
    },
    workflow: {
      run: ({ run, workspaceId, projectId, sourceVersionIds, onRetrievalCompleted }) =>
        Effect.gen(function* () {
          return yield* runFredWalkingSkeleton(
            {
              runId: run.id,
              workspaceId,
              projectId,
              sourceVersionIds: [...sourceVersionIds],
              question: run.question,
            },
            {
              searchText: (input) =>
                Effect.runPromise(
                  TextRetrieval.searchText({
                    workspaceId: input.workspaceId,
                    projectId: input.projectId,
                    sourceVersionIds: [...input.sourceVersionIds],
                    query: input.question,
                    limit: 5,
                  }).pipe(
                    Effect.map((result) => result.evidence),
                    Effect.provide(retrievalLayer),
                  ),
                ),
              onRetrievalCompleted: (evidence) =>
                Effect.runPromise(onRetrievalCompleted(evidence).pipe(Effect.asVoid)),
              validate: (answer, evidence, question) =>
                Effect.runPromise(validateAnswerCitations(answer, evidence, question)),
            },
            fredConfig,
          )
        }),
    },
  }))

  yield* runWorkerPollLoops(poll, researchPoll, pollMs)
})

Effect.runPromise(Effect.scoped(program)).catch((error) => {
  console.error('Worker failed:', error)
  process.exit(1)
})
