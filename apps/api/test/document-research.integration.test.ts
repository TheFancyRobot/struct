import { describe, expect, it } from 'bun:test'
import { runPhase02Evaluation } from '@struct/evaluation'
import { Effect } from 'effect'

describe('document research evaluation integration', () => {
  it('exposes the deterministic release signal without a model or API mutation', async () => {
    const report = await Effect.runPromise(runPhase02Evaluation())

    expect(report.passed).toBe(true)
    expect(report.promptInjection.modelCalls).toBe(0)
    expect(report.retrieval.metrics.scopeLeaks).toBe(0)
    expect(report.retrieval.metrics.staleVersionLeaks).toBe(0)
  })
})
