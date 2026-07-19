import { describe, expect, it } from 'bun:test'
import { walkingSkeletonCorpus } from '../src'

describe('walking-skeleton corpus contract', () => {
  it('keeps the Phase 01 smoke corpus small and provenance-aware', () => {
    expect(walkingSkeletonCorpus.expectedFileCount).toBe(1)
    expect(walkingSkeletonCorpus.checks).toContain('exactness')
    expect(walkingSkeletonCorpus.checks).toContain('provenance')
  })
})
