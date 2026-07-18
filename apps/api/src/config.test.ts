import { describe, it, expect } from 'vitest'
import { Effect, ConfigProvider, Layer, Exit } from 'effect'
import { apiPortConfig } from './config'

describe('API Config', () => {
  it('uses default port 3001 when API_PORT not set', async () => {
    const provider = ConfigProvider.fromMap(new Map())
    const result = await Effect.runPromise(
      apiPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(result).toBe(3001)
  })

  it('reads API_PORT override when set', async () => {
    const provider = ConfigProvider.fromMap(new Map([['API_PORT', '4001']]))
    const result = await Effect.runPromise(
      apiPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(result).toBe(4001)
  })

  it('rejects invalid API_PORT value', async () => {
    const provider = ConfigProvider.fromMap(new Map([['API_PORT', 'not-a-number']]))
    const result = await Effect.runPromiseExit(
      apiPortConfig.pipe(Effect.provide(Layer.setConfigProvider(provider))),
    )
    expect(Exit.isFailure(result)).toBe(true)
  })
})
