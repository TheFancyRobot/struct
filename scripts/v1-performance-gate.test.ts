import { describe, expect, it } from 'bun:test'
import { liveGates } from './v1-performance-gate'

describe('v1 live performance gate inventory', () => {
  it('executes every versioned phase and required live fault class under a bound', () => {
    expect(liveGates.map(({ id }) => id)).toEqual([
      'phase-02-document-retrieval',
      'phase-03-directory-ingestion',
      'phase-04-structured-query',
      'phase-05-dataset-research',
      'phase-06-recursive-25000',
      'phase-07-hybrid-research',
      'phase-08-report-fidelity',
      'unit-resilience-matrix',
      'real-interruption-restart-replacement',
      'canonical-report',
    ])
    expect(liveGates.every(({ maximumMilliseconds }) =>
      Number.isSafeInteger(maximumMilliseconds) && maximumMilliseconds > 0)).toBe(true)
    expect(liveGates.find(({ id }) => id === 'real-interruption-restart-replacement')?.environment)
      .toMatchObject({ DATA_ENGINE_INTEGRATION: '1' })
  })
})
