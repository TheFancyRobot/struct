import { describe, it, expect } from 'vitest'
import { Effect, ConfigProvider, Layer, Exit } from 'effect'
import {
  artifactStorageRootConfig,
  databaseUrlConfig,
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

    expect(root).toBe('./.local/artifacts')
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
})
