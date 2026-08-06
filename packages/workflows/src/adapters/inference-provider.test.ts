import { describe, expect, it } from 'bun:test'
import { ConfigProvider, Effect, Layer } from 'effect'
import {
  isApprovedInferenceProviderConfiguration,
  resolveInferenceProviderCredential,
} from './inference-provider'

describe('inference provider credentials', () => {
  it('resolves only a server environment reference', async () => {
    const result = await Effect.runPromise(resolveInferenceProviderCredential('@fancyrobot/fred-openai', 'env://OPENAI_API_KEY').pipe(
      Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map([
        ['OPENAI_API_KEY', 'server-only-secret'],
      ])))),
    ))
    expect(result).toEqual({ environmentVariable: 'OPENAI_API_KEY', secret: 'server-only-secret' })
    const invalid = await Effect.runPromiseExit(resolveInferenceProviderCredential('@fancyrobot/fred-openai', 'secret://openai'))
    expect(invalid._tag).toBe('Failure')
    const unsupported = await Effect.runPromiseExit(resolveInferenceProviderCredential('@fancyrobot/fred-openai', 'env://DATABASE_URL'))
    expect(unsupported._tag).toBe('Failure')
  })

  it('accepts only the matching credential and approved endpoint', () => {
    expect(isApprovedInferenceProviderConfiguration({
      providerPackage: '@fancyrobot/fred-openai',
      endpoint: 'https://api.openai.com/v1',
      credentialReference: 'env://OPENAI_API_KEY',
    })).toBe(true)
    expect(isApprovedInferenceProviderConfiguration({
      providerPackage: '@fancyrobot/fred-openai',
      endpoint: 'https://api.openai.com.evil.example/v1',
      credentialReference: 'env://OPENAI_API_KEY',
    })).toBe(false)
    expect(isApprovedInferenceProviderConfiguration({
      providerPackage: '@fancyrobot/fred-openai',
      endpoint: 'https://api.openai.com/v1',
      credentialReference: 'env://FRED_ANTHROPIC_API_KEY',
    })).toBe(false)
  })
})
