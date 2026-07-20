export interface CorpusSpec {
  readonly id: string
  readonly description: string
  readonly expectedFileCount: number
  readonly checks: ReadonlyArray<
    'exactness' | 'provenance' | 'contradiction' | 'prompt-injection'
  >
}

export const walkingSkeletonCorpus: CorpusSpec = {
  id: 'walking-skeleton',
  description: 'Small synthetic evidence set for the Phase 01 walking slice.',
  expectedFileCount: 1,
  checks: ['exactness', 'provenance'],
}

export * from './corpus.js'
export * from './document-retrieval.js'
export * from './directory-refresh.js'
export * from './phase-02-fixture.js'
export * from './phase-04-evaluation.js'
export * from './phase-05-evaluation.js'
export * from './hybrid-research.js'
export * from './prompt-injection.js'
export * from './recursive-analysis.js'
export * from './report-fidelity.js'
export * from './run-phase-02-evaluation.js'
