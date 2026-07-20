import { describe, expect, it } from 'bun:test'
import { hybridResearchAnswerAgent } from './research-execution.js'

describe('hybrid research answer agent', () => {
  it('is a one-step tool-free typed narrator behind deterministic guardrails', () => {
    const agent = hybridResearchAnswerAgent('mock-provider', 'mock-model')

    expect(agent).toMatchObject({
      id: 'struct.research-run.hybrid-synthesizer',
      platform: 'mock-provider',
      model: 'mock-model',
      maxSteps: 1,
      toolChoice: 'none',
    })
    expect(agent.systemMessage).toContain('Preserve numeric strings exactly')
    expect(agent.systemMessage).toContain('Never calculate, join, reconcile')
  })
})
