import { describe, expect, it } from 'bun:test'
import {
  Sha256Digest,
  SourceVersionId,
  type RecursiveEvidenceReference,
  type ResearchFinding,
} from '@struct/domain'
import { Effect } from 'effect'
import {
  computeRecursiveContradictionId,
  computeRecursiveEvidenceId,
  computeRecursiveFindingId,
} from '../src/aggregation-schema.js'
import {
  materializeContradictions,
} from '../src/contradiction-detection.js'
import { computeCoverageSnapshotId } from '../src/coverage-metadata.js'
import {
  attachContradictions,
  materializeFindingProposals,
  mergeCoverage,
  mergeResearchFindings,
} from '../src/merge-findings.js'

const sha = (character: string) => `sha256:${character.repeat(64)}`
const source = SourceVersionId.make('690e8400-e29b-41d4-a716-446655440001')

function coverage() {
  const value = {
    expectedItems: 2,
    examinedItems: 2,
    missingItems: 0,
    excludedItems: 0,
    expectedPartitions: 1,
    examinedPartitions: 1,
    status: 'complete' as const,
  }
  return { ...value, id: computeCoverageSnapshotId(value) }
}

function evidence(character: string): RecursiveEvidenceReference {
  const value = {
    sourceVersionId: source,
    artifact: {
      digest: Sha256Digest.make(sha(character)),
      byteLength: 32,
      mediaType: 'application/json',
    },
    locator: `/records/${character}`,
  }
  return { ...value, id: computeRecursiveEvidenceId(value) }
}

function finding(
  claim: string,
  signature: typeof Sha256Digest.Type,
  references: ReadonlyArray<RecursiveEvidenceReference>,
): ResearchFinding {
  const identity = {
    claimSignature: signature,
    evidence: references,
    confidence: 0.8,
    importance: 0.7,
    coverage: coverage(),
    supportingExamples: [references[0]!.id],
    counterEvidence: [],
    contradictions: [],
  }
  return {
    ...identity,
    id: computeRecursiveFindingId(identity),
    claim,
    limitations: ['z-limit', 'a-limit'],
    tags: ['z-tag', 'a-tag'],
  }
}

describe('recursive synthesis deterministic boundaries', () => {
  it('rejects invalid evidence identities and support/counter overlap', async () => {
    const item = evidence('1')
    const invalid = { ...item, id: evidence('2').id }
    const invalidIdentity = await Effect.runPromise(Effect.either(
      materializeFindingProposals([{
        claim: 'Claim',
        supportingEvidence: [invalid.id],
        counterEvidence: [],
        confidence: 0.8,
        importance: 0.7,
        limitations: [],
        tags: [],
      }], [invalid], coverage()),
    ))
    expect(invalidIdentity).toMatchObject({ _tag: 'Left' })

    const overlap = await Effect.runPromise(Effect.either(
      materializeFindingProposals([{
        claim: 'Claim',
        supportingEvidence: [item.id],
        counterEvidence: [item.id],
        confidence: 0.8,
        importance: 0.7,
        limitations: [],
        tags: [],
      }], [item], coverage()),
    ))
    expect(overlap).toMatchObject({ _tag: 'Left' })
  })

  it('binds shared evidence contradictions to an explicit claim signature', async () => {
    const shared = evidence('1')
    const alphaOnly = evidence('2')
    const betaOnly = evidence('3')
    const alphaSignature = Sha256Digest.make(sha('a'))
    const betaSignature = Sha256Digest.make(sha('b'))
    const findings = [
      finding('Alpha', alphaSignature, [shared, alphaOnly]),
      finding('Beta', betaSignature, [shared, betaOnly]),
    ]
    const result = await Effect.runPromise(Effect.either(
      materializeContradictions(findings, [{
        claimSignature: alphaSignature,
        supportingEvidence: [shared.id],
        conflictingEvidence: [betaOnly.id],
        status: 'unresolved',
        limitations: [],
      }]),
    ))
    expect(result).toMatchObject({ _tag: 'Left' })
  })

  it('is stable across reordered equivalent findings', async () => {
    const itemA = evidence('1')
    const itemB = evidence('2')
    const signature = Sha256Digest.make(sha('a'))
    const first = finding('Zeta display', signature, [itemA])
    const second = finding('Alpha display', signature, [itemB])

    const forward = await Effect.runPromise(
      mergeResearchFindings([first, second], coverage()),
    )
    const reverse = await Effect.runPromise(
      mergeResearchFindings([second, first], coverage()),
    )

    expect(reverse).toEqual(forward)
    expect(forward[0]?.claim).toBe('Alpha display')
    expect(forward[0]?.claimSignature).toBe(signature)
    expect(forward[0]?.id).toBe(computeRecursiveFindingId(forward[0]!))
    expect(forward[0]?.limitations).toEqual(['a-limit', 'z-limit'])
    expect(forward[0]?.tags).toEqual(['a-tag', 'z-tag'])
  })

  it('rejects forged merge identities and unsafe coverage sums', async () => {
    const itemA = evidence('1')
    const itemB = evidence('2')
    const signature = Sha256Digest.make(sha('a'))
    const base = finding('Claim', signature, [itemA, itemB])
    const forgedEvidence = {
      ...base,
      evidence: [{ ...itemA, id: itemB.id }, itemB],
    }
    expect(await Effect.runPromise(Effect.either(
      mergeResearchFindings([forgedEvidence], coverage()),
    ))).toMatchObject({ _tag: 'Left' })

    const forgedFinding = { ...base, id: finding(
      'Other',
      Sha256Digest.make(sha('b')),
      [itemA],
    ).id }
    expect(await Effect.runPromise(Effect.either(
      mergeResearchFindings([forgedFinding], coverage()),
    ))).toMatchObject({ _tag: 'Left' })

    const contradictionBase = {
      claimSignature: signature,
      supportingEvidence: [itemA.id],
      conflictingEvidence: [itemB.id],
    }
    const contradiction = {
      ...contradictionBase,
      id: computeRecursiveContradictionId(contradictionBase),
      status: 'unresolved' as const,
      limitations: [],
    }
    const linkedIdentity = {
      claimSignature: signature,
      evidence: [itemA, itemB],
      confidence: 0.8,
      importance: 0.7,
      coverage: coverage(),
      supportingExamples: [itemA.id],
      counterEvidence: [itemB.id],
      contradictions: [{ ...contradiction, id: computeRecursiveContradictionId({
        ...contradictionBase,
        claimSignature: Sha256Digest.make(sha('c')),
      }) }],
    }
    const forgedContradictionFinding = {
      ...linkedIdentity,
      id: computeRecursiveFindingId(linkedIdentity),
      claim: 'Claim',
      limitations: [],
      tags: [],
    }
    expect(await Effect.runPromise(Effect.either(
      mergeResearchFindings([forgedContradictionFinding], coverage()),
    ))).toMatchObject({ _tag: 'Left' })

    const forgedCoverage = { ...coverage(), id: computeCoverageSnapshotId({
      expectedItems: 1,
      examinedItems: 1,
      missingItems: 0,
      excludedItems: 0,
      expectedPartitions: 1,
      examinedPartitions: 1,
      status: 'complete',
    }) }
    expect(await Effect.runPromise(Effect.either(
      mergeCoverage([forgedCoverage]),
    ))).toMatchObject({ _tag: 'Left' })

    const maximum = {
      expectedItems: Number.MAX_SAFE_INTEGER,
      examinedItems: Number.MAX_SAFE_INTEGER,
      missingItems: 0,
      excludedItems: 0,
      expectedPartitions: 1,
      examinedPartitions: 1,
      status: 'complete' as const,
    }
    const maximumCoverage = {
      ...maximum,
      id: computeCoverageSnapshotId(maximum),
    }
    expect(await Effect.runPromise(Effect.either(
      mergeCoverage([maximumCoverage, maximumCoverage]),
    ))).toMatchObject({ _tag: 'Left' })
  })

  it('preserves semantic signatures and contradictions deterministically', async () => {
    const itemA = evidence('1')
    const itemB = evidence('2')
    const signature = Sha256Digest.make(sha('f'))
    const original = finding('Display claim', signature, [itemA, itemB])
    const proposal = {
      claimSignature: signature,
      supportingEvidence: [itemA.id],
      conflictingEvidence: [itemB.id],
      status: 'unresolved' as const,
      limitations: ['new-limit'],
    }
    const attached = await Effect.runPromise(
      attachContradictions([original], [proposal]),
    )
    const retained = attached.findings[0]!
    expect(retained.claimSignature).toBe(signature)
    expect(retained.id).toBe(computeRecursiveFindingId(retained))

    const existing = {
      ...attached.contradictions[0]!,
      status: 'resolved' as const,
      limitations: ['existing-limit'],
    }
    const existingIdentity = {
      claimSignature: signature,
      evidence: [itemA, itemB],
      confidence: 0.8,
      importance: 0.7,
      coverage: coverage(),
      supportingExamples: [itemA.id],
      counterEvidence: [itemB.id],
      contradictions: [existing],
    }
    const withExisting = {
      ...existingIdentity,
      id: computeRecursiveFindingId(existingIdentity),
      claim: 'Display claim',
      limitations: [],
      tags: [],
    }
    const retainedExisting = await Effect.runPromise(
      attachContradictions([withExisting], []),
    )
    expect(retainedExisting.contradictions).toEqual([existing])

    const unresolvedVariant = {
      ...existing,
      status: 'unresolved' as const,
      limitations: ['new-limit'],
    }
    const unresolvedIdentity = {
      ...existingIdentity,
      contradictions: [unresolvedVariant],
    }
    const withUnresolved = {
      ...unresolvedIdentity,
      id: computeRecursiveFindingId(unresolvedIdentity),
      claim: 'Alternate display',
      limitations: [],
      tags: [],
    }
    const forward = await Effect.runPromise(
      mergeResearchFindings([withExisting, withUnresolved], coverage()),
    )
    const reverse = await Effect.runPromise(
      mergeResearchFindings([withUnresolved, withExisting], coverage()),
    )
    expect(reverse).toEqual(forward)
    expect(forward[0]?.contradictions[0]).toMatchObject({
      status: 'unresolved',
      limitations: ['existing-limit', 'new-limit'],
    })
  })

  it('rejects contradictions bound to a different semantic claim', async () => {
    const itemA = evidence('1')
    const itemB = evidence('2')
    const signature = Sha256Digest.make(sha('a'))
    const foreignSignature = Sha256Digest.make(sha('b'))
    const contradictionBase = {
      claimSignature: foreignSignature,
      supportingEvidence: [itemA.id],
      conflictingEvidence: [itemB.id],
    }
    const contradiction = {
      ...contradictionBase,
      id: computeRecursiveContradictionId(contradictionBase),
      status: 'unresolved' as const,
      limitations: [],
    }
    const identity = {
      claimSignature: signature,
      evidence: [itemA, itemB],
      confidence: 0.8,
      importance: 0.7,
      coverage: coverage(),
      supportingExamples: [itemA.id],
      counterEvidence: [itemB.id],
      contradictions: [contradiction],
    }
    const foreign = {
      ...identity,
      id: computeRecursiveFindingId(identity),
      claim: 'Claim',
      limitations: [],
      tags: [],
    }
    expect(await Effect.runPromise(Effect.either(
      mergeResearchFindings([foreign], coverage()),
    ))).toMatchObject({ _tag: 'Left' })
    expect(await Effect.runPromise(Effect.either(
      attachContradictions([foreign], []),
    ))).toMatchObject({ _tag: 'Left' })
  })
})
