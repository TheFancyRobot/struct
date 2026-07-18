/**
 * apps/worker — Durable ingestion, research execution, and recovery.
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 */

import { Effect, Layer, Schedule } from 'effect'
import postgres from 'postgres'
import {
  EventJournalRepo,
  JobQueueRepo,
  QueryError,
  SourceVersionRepo,
  SqlClientLive,
} from '@struct/persistence'
import { SourceVersionId } from '@struct/domain'
import { LocalArtifactStore } from '@struct/source-storage'
import { ingestTextSource } from '@struct/ingestion'
import {
  artifactStorageRootConfig,
  databaseUrlConfig,
  workerJobStaleMsConfig,
  workerMetricsPortConfig,
  workerPollIntervalMsConfig,
} from './config'
import { processOneIngestionJob } from './jobs/ingest-source'

const program = Effect.gen(function* () {
  const metricsPort = yield* workerMetricsPortConfig
  const databaseUrl = yield* databaseUrlConfig
  const artifactRoot = yield* artifactStorageRootConfig
  const pollMs = yield* workerPollIntervalMsConfig
  const staleMs = yield* workerJobStaleMsConfig
  const storage = yield* LocalArtifactStore.make({ root: artifactRoot })
  const sql = yield* Effect.acquireRelease(
    Effect.sync(() => postgres(databaseUrl, { max: 5, idle_timeout: 5, connect_timeout: 2 })),
    (client) => Effect.promise(() => client.end({ timeout: 5 })).pipe(Effect.orDie),
  )
  const sqlLayer = SqlClientLive(sql)
  const jobLayer = Layer.provide(JobQueueRepo.Default, sqlLayer)
  const sourceVersionLayer = Layer.provide(SourceVersionRepo.Default, sqlLayer)
  const eventLayer = Layer.provide(EventJournalRepo.Default, sqlLayer)

  yield* Effect.log(`Worker starting (metrics on port ${metricsPort})`)
  yield* Effect.tryPromise({
    try: () => sql.unsafe('SELECT 1'),
    catch: () => new QueryError({ operation: 'startupValidation', entity: 'WorkerDatabase', message: 'Worker database validation failed' }),
  })
  yield* Effect.log('Worker ready for ingestion jobs')

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
    events: {
      append: (event) => EventJournalRepo.append(event).pipe(Effect.provide(eventLayer)),
    },
    ingestion: {
      ingestTextSource: (input) => ingestTextSource({ store: storage, ...input }),
    },
  }))

  yield* poll.pipe(Effect.repeat(Schedule.spaced(`${pollMs} millis`)))
})

Effect.runPromise(Effect.scoped(program)).catch((error) => {
  console.error('Worker failed:', error)
  process.exit(1)
})
