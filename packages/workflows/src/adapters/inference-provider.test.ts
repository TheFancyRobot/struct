import { describe, expect, it } from 'bun:test'
import { ConfigProvider, Effect, Layer } from 'effect'
import { resolveInferenceProviderCredential } from './inference-provider'

describe('inference provider credentials', () => {
  it('resolves only a server environment reference', async () => {
    const result = await Effect.runPromise(resolveInferenceProviderCredential('env://OPENAI_API_KEY').pipe(
      Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map([
        ['OPENAI_API_KEY', 'server-only-secret'],
      ])))),
    ))
    expect(result).toEqual({ environmentVariable: 'OPENAI_API_KEY', secret: 'server-only-secret' })
    const invalid = await Effect.runPromiseExit(resolveInferenceProviderCredential('secret://openai'))
    expect(invalid._tag).toBe('Failure')
    const unsupported = await Effect.runPromiseExit(resolveInferenceProviderCredential('env://DATABASE_URL'))
    expect(unsupported._tag).toBe('Failure')
  })
})
