import { describe, expect, it } from 'bun:test'
import { ConfigProvider, Effect, Layer } from 'effect'
import { testInferenceProviderConnection } from './inference-provider-test'

describe('inference provider test', () => {
  it('resolves the server credential and performs a bounded authenticated check', async () => {
    let request: RequestInit | undefined
    let url: URL | undefined
    const result = await Effect.runPromise(testInferenceProviderConnection({
      endpoint: 'https://provider.example/v1',
      credentialReference: 'env://OPENAI_API_KEY',
    }, async (nextUrl, init) => {
      url = nextUrl
      request = init
      return new Response('', { status: 200 })
    }).pipe(Effect.provide(Layer.setConfigProvider(ConfigProvider.fromMap(new Map([
      ['OPENAI_API_KEY', 'server-only-secret'],
    ]))))))

    expect(result).toEqual({ ok: true, message: 'Connection succeeded.' })
    expect(url?.href).toBe('https://provider.example/v1/models')
    expect(request?.headers).toEqual({ Authorization: 'Bearer server-only-secret' })
  })
})
