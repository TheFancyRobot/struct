/**
 * Config — Effect Config.* for the worker application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 */

import { Config, Effect, Schema } from 'effect'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '../../..')

const positive = (name: string) => ({
  message: `${name} must be positive`,
  validation: (value: number) => value > 0,
})

/** Worker metrics port configuration (default: 3002). */
export const workerMetricsPortConfig = Config.number('WORKER_METRICS_PORT').pipe(
  Config.withDefault(3002),
)

/** Database connection URL (required, no default). */
export const databaseUrlConfig = Config.redacted('DATABASE_URL')

/** Local filesystem artifact root for finalized source artifacts. */
export const artifactStorageRootConfig = Config.string('ARTIFACT_STORAGE_ROOT').pipe(
  Config.withDefault('.local/artifacts'),
  Config.map((root) => resolve(repositoryRoot, root)),
)

/** Worker polling interval for durable jobs. */
export const workerPollIntervalMsConfig = Config.number('WORKER_POLL_INTERVAL_MS').pipe(
  Config.withDefault(1000),
  Config.validate(positive('WORKER_POLL_INTERVAL_MS')),
)

/** Age after which in-progress jobs are considered stale. */
export const workerJobStaleMsConfig = Config.number('WORKER_JOB_STALE_MS').pipe(
  Config.withDefault(300000),
  Config.validate(positive('WORKER_JOB_STALE_MS')),
)

/**
 * A workflow gets this much time beyond its Fred deadline before stale
 * recovery may take ownership. Two poll intervals cover scheduling jitter and
 * terminal persistence; the fixed floor keeps very fast pollers from erasing
 * that operational margin.
 */
export const MIN_RESEARCH_JOB_STALE_MARGIN_MS = 30_000
export const MAX_RESEARCH_JOB_HEARTBEAT_MS = 10_000
export const MAX_INGESTION_JOB_HEARTBEAT_MS = 10_000
export const MAX_SOURCE_TEXT_REINDEX_HEARTBEAT_MS = 10_000

export interface IngestionJobTiming {
  readonly pollIntervalMs: number
  readonly staleMs: number
}

/**
 * Keep at least three renewal opportunities inside one stale window, never
 * renew less frequently than the poll cadence, and cap steady-state DB load.
 */
export function deriveIngestionJobHeartbeatIntervalMs(
  timing: IngestionJobTiming,
): number {
  return Math.max(
    1,
    Math.min(
      MAX_INGESTION_JOB_HEARTBEAT_MS,
      Math.floor(timing.pollIntervalMs),
      Math.floor(timing.staleMs / 3),
    ),
  )
}

/** Keep reindex leases live with at least three renewals per stale window. */
export function deriveSourceTextReindexHeartbeatIntervalMs(
  timing: IngestionJobTiming,
): number {
  return Math.max(
    1,
    Math.min(
      MAX_SOURCE_TEXT_REINDEX_HEARTBEAT_MS,
      Math.floor(timing.pollIntervalMs),
      Math.floor(timing.staleMs / 3),
    ),
  )
}

export interface ResearchJobTiming {
  readonly pollIntervalMs: number
  readonly staleMs: number
  readonly researchMaxElapsedMs: number
}

export interface ValidatedResearchJobTiming extends ResearchJobTiming {
  readonly heartbeatIntervalMs: number
  readonly minimumStaleMs: number
}

export class ResearchJobTimingConfigurationError
  extends Schema.TaggedError<ResearchJobTimingConfigurationError>()(
    'ResearchJobTimingConfigurationError',
    {
      staleMs: Schema.Number,
      minimumStaleMs: Schema.Number,
      researchMaxElapsedMs: Schema.Number,
      pollIntervalMs: Schema.Number,
      message: Schema.String,
    },
  ) {}

export const validateResearchJobTiming = Effect.fn(
  'WorkerConfig.validateResearchJobTiming',
)(function* (
  timing: ResearchJobTiming,
) {
  const schedulingMarginMs = Math.max(
    MIN_RESEARCH_JOB_STALE_MARGIN_MS,
    timing.pollIntervalMs * 2,
  )
  const minimumStaleMs = timing.researchMaxElapsedMs + schedulingMarginMs
  if (timing.staleMs < minimumStaleMs) {
    return yield* new ResearchJobTimingConfigurationError({
      staleMs: timing.staleMs,
      minimumStaleMs,
      researchMaxElapsedMs: timing.researchMaxElapsedMs,
      pollIntervalMs: timing.pollIntervalMs,
      message:
        'WORKER_JOB_STALE_MS must be at least RESEARCH_MAX_ELAPSED_MS plus the research lease safety margin',
    })
  }

  return {
    ...timing,
    minimumStaleMs,
    heartbeatIntervalMs: Math.max(
      1,
      Math.min(
        MAX_RESEARCH_JOB_HEARTBEAT_MS,
        Math.floor(timing.staleMs / 3),
      ),
    ),
  } satisfies ValidatedResearchJobTiming
})
