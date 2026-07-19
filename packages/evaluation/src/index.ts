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

export * from './document-retrieval.js'
export * from './phase-02-fixture.js'
export * from './prompt-injection.js'
export * from './run-phase-02-evaluation.js'
