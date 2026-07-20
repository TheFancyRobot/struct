import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { RecursiveEvidenceCriticOutput } from './evidence-critic.js'

const sha = (character: string) => `sha256:${character.repeat(64)}`

describe('recursive evidence critic contract', () => {
  it('cannot suppress a new contradiction as resolved', () => {
    const decoded = Schema.decodeUnknownEither(RecursiveEvidenceCriticOutput)({
      contradictions: [{
        claimSignature: sha('a'),
        supportingEvidence: [sha('b')],
        conflictingEvidence: [sha('c')],
        status: 'resolved',
        limitations: [],
      }],
      sufficiency: 'contradictory',
      evidenceIds: [sha('b'), sha('c')],
      limitations: [],
    })
    expect(decoded._tag).toBe('Left')
  })
})
