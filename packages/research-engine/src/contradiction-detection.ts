/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  ResearchContractValidationError,
  Sha256Digest,
  type RecursiveContradiction as typeRecursiveContradiction,
  type RecursiveEvidenceId,
  type ResearchFinding as typeResearchFinding,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect } from 'effect'
import {
  computeRecursiveContradictionId,
  orderCanonicalIdentities,
} from './aggregation-schema.js'

export interface ContradictionProposal {
  readonly claimSignature: typeof Sha256Digest.Type
  readonly supportingEvidence: ReadonlyArray<RecursiveEvidenceId>
  readonly conflictingEvidence: ReadonlyArray<RecursiveEvidenceId>
  readonly status: 'unresolved'
  readonly limitations: ReadonlyArray<string>
}

function invalid(path: string, message: string) {
  return new ResearchContractValidationError({
    contract: 'recursive-aggregation',
    reason: 'invalid-lineage',
    path,
    message,
  })
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const length = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

export const materializeContradictions = Effect.fn(
  'RecursiveSynthesis.materializeContradictions',
)(function* (
  findings: ReadonlyArray<typeResearchFinding>,
  proposals: ReadonlyArray<ContradictionProposal>,
) {
  const evidenceClaims = new Map<RecursiveEvidenceId, Set<string>>()
  for (const finding of findings) {
    for (const evidence of finding.evidence) {
      const claims = evidenceClaims.get(evidence.id) ?? new Set<string>()
      claims.add(finding.claimSignature)
      evidenceClaims.set(evidence.id, claims)
    }
  }

  const contradictions: typeRecursiveContradiction[] = []
  for (const [index, proposal] of proposals.entries()) {
    const supportingEvidence = orderCanonicalIdentities(
      Array.from(new Set(proposal.supportingEvidence)),
    )
    const conflictingEvidence = orderCanonicalIdentities(
      Array.from(new Set(proposal.conflictingEvidence)),
    )
    if (supportingEvidence.length === 0 || conflictingEvidence.length === 0) {
      return yield* invalid(
        `contradictions.${index}`,
        'Contradictions require both supporting and conflicting evidence',
      )
    }
    const overlap = new Set(supportingEvidence)
    if (conflictingEvidence.some((id) => overlap.has(id))) {
      return yield* invalid(
        `contradictions.${index}`,
        'Evidence cannot both support and conflict with the same claim',
      )
    }
    const referenced = [...supportingEvidence, ...conflictingEvidence]
    if (referenced.some((id) => !evidenceClaims.has(id))) {
      return yield* invalid(
        `contradictions.${index}`,
        'Contradiction proposal references evidence outside the bounded findings',
      )
    }
    if (
      !findings.some((finding) =>
        finding.claimSignature === proposal.claimSignature)
      || referenced.some((id) =>
        !evidenceClaims.get(id)?.has(proposal.claimSignature))
    ) {
      return yield* invalid(
        `contradictions.${index}`,
        'Every contradiction evidence ID must belong to its supplied claim signature',
      )
    }
    const identity = {
      claimSignature: proposal.claimSignature,
      supportingEvidence,
      conflictingEvidence,
    }
    contradictions.push({
      ...identity,
      id: computeRecursiveContradictionId(identity),
      status: 'unresolved',
      limitations: Array.from(new Set(proposal.limitations)).sort(compareUtf8),
    })
  }

  const byId = new Map(
    contradictions.map((contradiction) => [contradiction.id, contradiction]),
  )
  return orderCanonicalIdentities([...byId.keys()]).map((id) => byId.get(id)!)
})
