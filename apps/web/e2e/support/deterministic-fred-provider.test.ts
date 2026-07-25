import { describe, expect, it } from 'bun:test'
import * as LanguageModel from '@effect/ai/LanguageModel'
import { Effect, Stream } from 'effect'
import deterministicFredProvider from './deterministic-fred-provider'

describe('deterministic Fred provider', () => {
  it('uses the requested model id and streams well-formed text parts', async () => {
    const { getModel } = await deterministicFredProvider.load()
    const model = await Effect.runPromise(getModel('deterministic-e2e:test'))

    expect(model.provider).toBe('deterministic-e2e:test')

    const parts = Array.from(await Effect.runPromise(
      Stream.runCollect(LanguageModel.streamText({
        prompt: 'What should we do next?',
      })).pipe(Effect.provide(model)),
    ))
    const textDelta = parts.find((part) => part.type === 'text-delta')
    const finish = parts.find((part) => part.type === 'finish')

    expect(parts.map((part) => part.type)).toEqual([
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ])
    expect(textDelta).toMatchObject({
      type: 'text-delta',
      id: expect.any(String),
    })
    expect(textDelta?.delta).toContain('Contact the account owner.')
    expect(finish).toMatchObject({
      type: 'finish',
      reason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    })
  })
})
