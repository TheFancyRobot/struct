import { describe, it, expect } from 'vitest'
import { Effect, ConfigProvider, Layer, Exit } from 'effect'
import { workerMetricsPortConfig, databaseUrlConfig } from './config'

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
