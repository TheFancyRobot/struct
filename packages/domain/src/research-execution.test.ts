import { describe, expect, it } from 'bun:test'
import { Effect, Either, Schema } from 'effect'
import {
  decodeResearchExecutionCheckpoint,
  ResearchExecutionCheckpoint,
} from './index.js'

const id = (suffix: string) =>
  `720e8400-e29b-41d4-a716-${suffix}`

function checkpointInput() {
  return {
    version: '1',
    id: id('446655440000'),
    state: {
      version: '1',
      runId: id('446655440001'),
      planId: id('446655440002'),
      status: 'running',
      currentNodeId: id('446655440003'),
      completed: [{
        nodeId: id('446655440004'),
        artifacts: [{
          digest: `sha256:${'a'.repeat(64)}`,
          byteLength: 100_000,
          mediaType: 'application/json',
          body: 'large output is not checkpoint state',
        }],
      }],
      budget: {
        limits: {
          maximumSteps: 4,
          maximumModelCalls: 1,
          maximumToolCalls: 3,
          maximumTokens: 20_000,
          maximumElapsedMilliseconds: 60_000,
          maximumEstimatedCostMicros: 500_000,
          maximumFanOut: 2,
          maximumRevisions: 1,
        },
        used: {
          steps: 2,
          modelCalls: 0,
          toolCalls: 2,
          tokens: 500,
          elapsedMilliseconds: 1_000,
          estimatedCostMicros: 1_000,
          revisions: 0,
        },
      },
      cancellation: 'none',
      duplicateActionCount: 0,
      noProgressCount: 0,
      fredCorrelation: 'fred-run-123',
      lastEventSequence: 4,
      providerClient: () => 'not serializable',
    },
  }
}

async function failureReason(
  effect: Effect.Effect<unknown, { readonly reason: string }>,
): Promise<string | undefined> {
  const result = await Effect.runPromise(Effect.either(effect))
  return Either.isLeft(result) ? result.left.reason : undefined
}

describe('research execution contracts', () => {
  it('round-trips compact checkpoint state and strips artifact bodies and clients', async () => {
    const decoded = await Effect.runPromise(
      decodeResearchExecutionCheckpoint(checkpointInput()),
    )
    const encoded = Schema.encodeSync(ResearchExecutionCheckpoint)(decoded)
    const serialized = JSON.stringify(encoded)

    expect(decoded.state.completed).toHaveLength(1)
    expect(serialized).toContain('sha256:')
    expect(serialized).not.toContain('large output')
    expect(serialized).not.toContain('providerClient')
    await Effect.runPromise(decodeResearchExecutionCheckpoint(encoded))
  })

  it('rejects exceeded, oversized, and non-finite budget state', async () => {
    const checkpoint = checkpointInput()
    expect(await failureReason(decodeResearchExecutionCheckpoint({
      ...checkpoint,
      state: {
        ...checkpoint.state,
        budget: {
          ...checkpoint.state.budget,
          used: { ...checkpoint.state.budget.used, toolCalls: 4 },
        },
      },
    }))).toBe('invalid-budget')
    expect(await failureReason(decodeResearchExecutionCheckpoint({
      ...checkpoint,
      state: {
        ...checkpoint.state,
        completed: Array.from({ length: 64 }, (_, nodeIndex) => ({
          nodeId: id(String(446655441000 + nodeIndex).padStart(12, '0')),
          artifacts: Array.from({ length: 64 }, () => ({
            digest: `sha256:${'a'.repeat(64)}`,
            byteLength: 100_000,
            mediaType: `application/${'x'.repeat(243)}`,
          })),
        })),
      },
    }))).toBe('invalid-budget')
    expect(await failureReason(decodeResearchExecutionCheckpoint({
      ...checkpoint,
      state: {
        ...checkpoint.state,
        lastEventSequence: Number.POSITIVE_INFINITY,
      },
    }))).toBe('malformed')
  })

  it('rejects malformed identities and running state without a current node', async () => {
    const checkpoint = checkpointInput()
    expect(await failureReason(decodeResearchExecutionCheckpoint({
      ...checkpoint,
      id: 'not-a-uuid',
    }))).toBe('invalid-identity')
    expect(await failureReason(decodeResearchExecutionCheckpoint({
      ...checkpoint,
      state: { ...checkpoint.state, currentNodeId: null },
    }))).toBe('malformed')
  })
})
