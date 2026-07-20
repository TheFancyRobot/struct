import { describe, it, expect } from 'bun:test'
import { Effect, ConfigProvider, Layer, Exit } from 'effect'
import { resolve } from 'node:path'
import {
  artifactStorageRootConfig,
  databaseUrlConfig,
  deriveIngestionJobHeartbeatIntervalMs,
  deriveSourceTextReindexHeartbeatIntervalMs,
  MAX_INGESTION_JOB_HEARTBEAT_MS,
  MAX_RESEARCH_JOB_HEARTBEAT_MS,
  MAX_SOURCE_TEXT_REINDEX_HEARTBEAT_MS,
  MIN_RESEARCH_JOB_STALE_MARGIN_MS,
  ResearchJobTimingConfigurationError,
  validateResearchJobTiming,
  workerJobStaleMsConfig,
  workerMetricsPortConfig,
  workerPollIntervalMsConfig,
} from './config'

describe('Worker Config', () => {
  it('uses default metrics port 3002 when WORKER_METRICS_PORT not set', async () => {
    const provider = ConfigProvider.fromMap(new Map())
    const result = await Effect.runPromise(
      workerMetricsPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(result).toBe(3002)
  })

  it('reads WORKER_METRICS_PORT override when set', async () => {
    const provider = ConfigProvider.fromMap(new Map([['WORKER_METRICS_PORT', '4002']]))
    const result = await Effect.runPromise(
      workerMetricsPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(result).toBe(4002)
  })

  it('rejects invalid WORKER_METRICS_PORT value', async () => {
    const provider = ConfigProvider.fromMap(new Map([['WORKER_METRICS_PORT', 'not-a-number']]))
    const result = await Effect.runPromiseExit(
      workerMetricsPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(Exit.isFailure(result)).toBe(true)
  })
})

describe('Worker Database URL Config', () => {
  it('reads DATABASE_URL when set', async () => {
    const provider = ConfigProvider.fromMap(
      new Map([['DATABASE_URL', 'postgres://struct:struct@localhost:5432/struct']]),
    )
    const result = await Effect.runPromise(
      databaseUrlConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(result).toBe('postgres://struct:struct@localhost:5432/struct')
  })

  it('fails when DATABASE_URL not set', async () => {
    const provider = ConfigProvider.fromMap(new Map())
    const result = await Effect.runPromiseExit(
      databaseUrlConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(Exit.isFailure(result)).toBe(true)
  })
})

describe('Worker ingestion config', () => {
  it('uses safe defaults for artifact storage and polling', async () => {
    const provider = ConfigProvider.fromMap(new Map())
    const [root, poll, stale] = await Effect.runPromise(
      Effect.all([
        artifactStorageRootConfig,
        workerPollIntervalMsConfig,
        workerJobStaleMsConfig,
      ]).pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )

    expect(root).toBe(resolve(import.meta.dir, '../../..', '.local/artifacts'))
    expect(poll).toBe(1000)
    expect(stale).toBe(300000)
  })

  it('rejects non-positive worker polling values', async () => {
    const provider = ConfigProvider.fromMap(new Map([
      ['WORKER_POLL_INTERVAL_MS', '0'],
      ['WORKER_JOB_STALE_MS', '-1'],
    ]))
    const result = await Effect.runPromiseExit(
      Effect.all([
        workerPollIntervalMsConfig,
        workerJobStaleMsConfig,
      ], { mode: 'validate' }).pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )

    expect(Exit.isFailure(result)).toBe(true)
  })

  it('derives an ingestion heartbeat inside both the poll and stale windows', () => {
    expect(deriveIngestionJobHeartbeatIntervalMs({
      pollIntervalMs: 1_000,
      staleMs: 300_000,
    })).toBe(1_000)
    expect(deriveIngestionJobHeartbeatIntervalMs({
      pollIntervalMs: 60_000,
      staleMs: 300_000,
    })).toBe(MAX_INGESTION_JOB_HEARTBEAT_MS)
    expect(deriveIngestionJobHeartbeatIntervalMs({
      pollIntervalMs: 60_000,
      staleMs: 15_000,
    })).toBe(5_000)
  })

  it('derives a bounded source-text reindex heartbeat', () => {
    expect(deriveSourceTextReindexHeartbeatIntervalMs({
      pollIntervalMs: 1_000,
      staleMs: 300_000,
    })).toBe(1_000)
    expect(deriveSourceTextReindexHeartbeatIntervalMs({
      pollIntervalMs: 60_000,
      staleMs: 300_000,
    })).toBe(MAX_SOURCE_TEXT_REINDEX_HEARTBEAT_MS)
    expect(deriveSourceTextReindexHeartbeatIntervalMs({
      pollIntervalMs: 60_000,
      staleMs: 15_000,
    })).toBe(5_000)
  })

  it('accepts the exact safe research lease boundary and derives a bounded heartbeat', async () => {
    const researchMaxElapsedMs = 60_000
    const pollIntervalMs = 1_000
    const staleMs = researchMaxElapsedMs + MIN_RESEARCH_JOB_STALE_MARGIN_MS

    const timing = await Effect.runPromise(validateResearchJobTiming({
      pollIntervalMs,
      staleMs,
      researchMaxElapsedMs,
    }))

    expect(timing.minimumStaleMs).toBe(staleMs)
    expect(timing.heartbeatIntervalMs).toBe(MAX_RESEARCH_JOB_HEARTBEAT_MS)
  })

  it('rejects a stale threshold that only equals or approaches the Fred deadline', async () => {
    const researchMaxElapsedMs = 60_000
    const pollIntervalMs = 20_000
    const error = await Effect.runPromise(validateResearchJobTiming({
      pollIntervalMs,
      staleMs: researchMaxElapsedMs + (pollIntervalMs * 2) - 1,
      researchMaxElapsedMs,
    }).pipe(Effect.flip))

    expect(error).toBeInstanceOf(ResearchJobTimingConfigurationError)
    expect(error.minimumStaleMs).toBe(
      researchMaxElapsedMs + (pollIntervalMs * 2),
    )
    expect(error.message).toContain(
      'WORKER_JOB_STALE_MS must be at least RESEARCH_MAX_ELAPSED_MS',
    )
  })
})
