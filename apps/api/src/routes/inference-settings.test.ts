import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { inferenceSettingsRoute, runInferenceSettingsRoute, type InferenceSettingsRouteDeps } from './inference-settings'

describe('inference settings route', () => {
  it('keeps credentials write-only, normalizes endpoints, and clears assignments', async () => {
    const providers: Array<{ id: string, type: string, endpoint: string | null, credentialReference: string, enabled: boolean, hasCredential: boolean }> = []
    const models: Array<{ id: string, providerId: string, name: string, capabilities: ReadonlyArray<'chat' | 'embedding' | 'vision'> }> = []
    const assignments = { chat: null, embedding: null, vision: null } as { chat: string | null, embedding: string | null, vision: string | null }
    let sequence = 0
    const deps: InferenceSettingsRouteDeps = {
      list: () => Effect.succeed({ providers, models, assignments }),
      createProvider: (input: { id: string, type: string, endpoint: string | null, credentialReference: string }) => Effect.sync(() => providers.push({ ...input, enabled: true, hasCredential: true })),
      updateProvider: (input: { id: string, type: string, endpoint: string | null }) => Effect.sync(() => {
        const provider = providers.find((item) => item.id === input.id)
        if (provider !== undefined) Object.assign(provider, input)
      }),
      setProviderEnabled: (input: { id: string, enabled: boolean }) => Effect.sync(() => {
        const provider = providers.find((item) => item.id === input.id)
        if (provider !== undefined) provider.enabled = input.enabled
      }),
      deleteProvider: (input: { id: string }) => Effect.sync(() => {
        const index = providers.findIndex((item) => item.id === input.id)
        if (index >= 0) providers.splice(index, 1)
      }),
      testProvider: () => Effect.succeed({ ok: false, message: 'Secret resolver unavailable' }),
      createModel: (input: { id: string, providerId: string, name: string, capabilities: ReadonlyArray<'chat' | 'embedding' | 'vision'> }) => Effect.sync(() => models.push(input)),
      assign: (input: { role: 'chat' | 'embedding' | 'vision', modelId: string }) => Effect.sync(() => { assignments[input.role] = input.modelId }),
      clearAssignment: (input: { role: 'chat' | 'embedding' | 'vision' }) => Effect.sync(() => { assignments[input.role] = null }),
      randomId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    }
    const route = async (request: Request) => {
      const result = await runInferenceSettingsRoute(inferenceSettingsRoute(request, 'workspace', deps))
      if (result === undefined) throw new Error('inference settings route did not respond')
      return result
    }
    const provider = await route(new Request('http://local/api/settings/inference/providers', { method: 'POST', body: JSON.stringify({ type: '@fancyrobot/fred-openai', endpoint: '', credentialReference: 'env://OPENAI_API_KEY' }) }))
    expect(provider.status).toBe(201)
    expect(providers[0]?.endpoint).toBeNull()
    expect(providers[0]?.credentialReference).toBe('env://OPENAI_API_KEY')
    const listed = await route(new Request('http://local/api/settings/inference'))
    expect(await listed.text()).not.toContain('env://OPENAI_API_KEY')

    const unapprovedEndpoint = await route(new Request('http://local/api/settings/inference/providers', { method: 'POST', body: JSON.stringify({ type: '@fancyrobot/fred-openai', endpoint: 'https://api.openai.com.evil.example/v1', credentialReference: 'env://OPENAI_API_KEY' }) }))
    expect(unapprovedEndpoint.status).toBe(400)

    const unsupportedCredential = await route(new Request('http://local/api/settings/inference/providers', { method: 'POST', body: JSON.stringify({ type: '@fancyrobot/fred-openai', credentialReference: 'env://DATABASE_URL' }) }))
    expect(unsupportedCredential.status).toBe(400)
    const mismatchedCredential = await route(new Request('http://local/api/settings/inference/providers', { method: 'POST', body: JSON.stringify({ type: '@fancyrobot/fred-openai', credentialReference: 'env://FRED_ANTHROPIC_API_KEY' }) }))
    expect(mismatchedCredential.status).toBe(400)
    expect(providers).toHaveLength(1)
    const providerId = providers[0]?.id
    if (providerId === undefined) throw new Error('provider was not created')
    await route(new Request('http://local/api/settings/inference/models', { method: 'POST', body: JSON.stringify({ providerId, name: 'embed', capabilities: ['embedding'] }) }))
    const modelId = models[0]?.id
    if (modelId === undefined) throw new Error('model was not created')
    const rejected = await route(new Request('http://local/api/settings/inference/assignments/chat', { method: 'PUT', body: JSON.stringify({ modelId }) }))
    expect(rejected.status).toBe(409)

    await route(new Request('http://local/api/settings/inference/assignments/embedding', { method: 'PUT', body: JSON.stringify({ modelId }) }))
    expect(assignments.embedding).toBe(modelId)
    expect((await route(new Request('http://local/api/settings/inference/assignments/embedding', { method: 'DELETE' }))).status).toBe(200)
    expect(assignments.embedding).toBeNull()

    expect((await route(new Request(`http://local/api/settings/inference/providers/${providerId}/enabled`, { method: 'PUT', body: JSON.stringify({ enabled: false }) }))).status).toBe(200)
    expect(providers[0]?.enabled).toBe(false)
    const test = await route(new Request(`http://local/api/settings/inference/providers/${providerId}/test`, { method: 'POST' }))
    expect(await test.text()).toContain('Secret resolver unavailable')
    expect((await route(new Request(`http://local/api/settings/inference/providers/${providerId}`, { method: 'DELETE' }))).status).toBe(200)
    expect(providers).toEqual([])
  })
})
