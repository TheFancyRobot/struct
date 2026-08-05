import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import { InferenceSettingsRepo } from './inference-settings.js'
import { SqlClientTest } from '../sql-client.js'

describe('InferenceSettingsRepo runtime resolver', () => {
  it('resolves only the enabled assigned provider for chat and embedding', async () => {
    const sql = SqlClientTest(async (query, params) => {
      expect(query).toContain('inference_model_assignments')
      const role = params?.[1]
      return role === 'chat'
        ? [{ provider_type: '@fancyrobot/fred-openai', endpoint: null, credential_reference: 'secret://chat', name: 'chat-model' }]
        : role === 'embedding'
          ? [{ provider_type: '@fancyrobot/fred-openai', endpoint: 'https://api.example.test', credential_reference: 'secret://embedding', name: 'embedding-model' }]
          : []
    })
    const layer = Layer.provide(InferenceSettingsRepo.Default, sql)
    const [chat, embedding, vision] = await Effect.runPromise(Effect.all([
      InferenceSettingsRepo.resolveRuntimeModel('workspace', 'chat'),
      InferenceSettingsRepo.resolveRuntimeModel('workspace', 'embedding'),
      InferenceSettingsRepo.resolveRuntimeModel('workspace', 'vision'),
    ]).pipe(Effect.provide(layer)))
    expect(chat?.model).toBe('chat-model')
    expect(embedding?.model).toBe('embedding-model')
    expect(vision).toBeNull()
  })
})
