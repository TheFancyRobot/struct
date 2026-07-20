/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  RecursiveCoverage,
  RecursiveEvidenceId,
  ResearchContractValidationError,
  ResearchFinding,
  Sha256Digest,
  type RecursiveCoverage as typeRecursiveCoverage,
  type RecursiveEvidenceReference as typeRecursiveEvidenceReference,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import {
  computeRecursiveContradictionId,
  computeRecursiveFindingId,
  computeRecursiveEvidenceId,
  orderCanonicalIdentities,
} from './aggregation-schema.js'
import {
  computeCoverageSnapshotId,
  validateCoverageIdentity,
} from './coverage-metadata.js'
import type {
  ContradictionProposal as typeContradictionProposal,
} from './contradiction-detection.js'
/* eslint-enable no-unused-vars */
import { materializeContradictions } from './contradiction-detection.js'

export interface FindingProposal {
  readonly claim: string
  readonly supportingEvidence: ReadonlyArray<RecursiveEvidenceId>
  readonly counterEvidence: ReadonlyArray<RecursiveEvidenceId>
  readonly confidence: number
  readonly importance: number
  readonly limitations: ReadonlyArray<string>
  readonly tags: ReadonlyArray<string>
}

function digestText(value: string): typeof Sha256Digest.Type {
  return Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256').update(value).digest('hex')}`,
  )
}

function invalid(path: string, message: string) {
  return new ResearchContractValidationError({
    contract: 'recursive-aggregation',
    reason: 'invalid-lineage',
    path,
    message,
  })
}

function canonicalClaim(claim: string): string {
  return claim.trim().replace(/\s+/g, ' ')
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

const validateCoverageBoundary = Effect.fn(
  'RecursiveSynthesis.validateMergeCoverage',
)(function* (
  coverage: typeRecursiveCoverage,
  path: string,
) {
  const decoded = Schema.decodeUnknownEither(RecursiveCoverage)(coverage)
  if (decoded._tag === 'Left') {
    return yield* invalid(path, 'Coverage counters or relationships are invalid')
  }
  yield* validateCoverageIdentity(decoded.right)
  return decoded.right
})

const validateFindingBoundary = Effect.fn(
  'RecursiveSynthesis.validateMergeFinding',
)(function* (finding: ResearchFinding, index: number) {
  const decoded = Schema.decodeUnknownEither(ResearchFinding)(finding)
  if (decoded._tag === 'Left') {
    return yield* invalid(
      `findings.${index}`,
      'Finding structure does not satisfy the recursive finding contract',
    )
  }
  const value = decoded.right
  yield* validateCoverageBoundary(value.coverage, `findings.${index}.coverage`)
  for (const [evidenceIndex, evidence] of value.evidence.entries()) {
    if (evidence.id !== computeRecursiveEvidenceId(evidence)) {
      return yield* invalid(
        `findings.${index}.evidence.${evidenceIndex}.id`,
        'Evidence identity does not match its canonical source lineage',
      )
    }
  }
  for (const [contradictionIndex, contradiction] of
    value.contradictions.entries()) {
    if (contradiction.claimSignature !== value.claimSignature) {
      return yield* invalid(
        `findings.${index}.contradictions.${contradictionIndex}.claimSignature`,
        'Finding contradictions must describe the same semantic claim',
      )
    }
    if (
      contradiction.id
      !== computeRecursiveContradictionId(contradiction)
    ) {
      return yield* invalid(
        `findings.${index}.contradictions.${contradictionIndex}.id`,
        'Contradiction identity does not match its canonical evidence',
      )
    }
  }
  if (value.id !== computeRecursiveFindingId(value)) {
    return yield* invalid(
      `findings.${index}.id`,
      'Finding identity does not match its canonical evidence',
    )
  }
  return value
})

const mergeContradictionVariants = Effect.fn(
  'RecursiveSynthesis.mergeContradictionVariants',
)(function* (
  contradictions: ReadonlyArray<ResearchFinding['contradictions'][number]>,
) {
  const byId = new Map<
    ResearchFinding['contradictions'][number]['id'],
    ResearchFinding['contradictions'][number]
  >()
  for (const [index, contradiction] of contradictions.entries()) {
    const normalized = {
      ...contradiction,
      supportingEvidence: orderCanonicalIdentities(
        contradiction.supportingEvidence,
      ),
      conflictingEvidence: orderCanonicalIdentities(
        contradiction.conflictingEvidence,
      ),
      limitations: Array.from(new Set(contradiction.limitations))
        .sort(compareUtf8),
    }
    const existing = byId.get(contradiction.id)
    if (existing === undefined) {
      byId.set(contradiction.id, normalized)
      continue
    }
    if (
      existing.claimSignature !== contradiction.claimSignature
      || orderCanonicalIdentities(existing.supportingEvidence).join('\u0000')
        !== orderCanonicalIdentities(
          contradiction.supportingEvidence,
        ).join('\u0000')
      || orderCanonicalIdentities(existing.conflictingEvidence).join('\u0000')
        !== orderCanonicalIdentities(
          contradiction.conflictingEvidence,
        ).join('\u0000')
    ) {
      return yield* invalid(
        `contradictions.${index}.id`,
        'A contradiction ID cannot describe different canonical evidence',
      )
    }
    byId.set(contradiction.id, {
      ...existing,
      status: existing.status === 'unresolved'
        || normalized.status === 'unresolved'
        ? 'unresolved'
        : 'resolved',
      limitations: Array.from(new Set([
        ...existing.limitations,
        ...normalized.limitations,
      ])).sort(compareUtf8),
    })
  }
  return orderCanonicalIdentities([...byId.keys()])
    .map((id) => byId.get(id)!)
})

function materializeFinding(
  claimSignature: ResearchFinding['claimSignature'],
  claim: string,
  evidence: ReadonlyArray<typeRecursiveEvidenceReference>,
  coverage: typeRecursiveCoverage,
  confidence: number,
  importance: number,
  supportingExamples: ReadonlyArray<RecursiveEvidenceId>,
  counterEvidence: ReadonlyArray<RecursiveEvidenceId>,
  contradictions: ResearchFinding['contradictions'],
  limitations: ReadonlyArray<string>,
  tags: ReadonlyArray<string>,
): ResearchFinding {
  const base = {
    claimSignature,
    evidence,
    confidence,
    importance,
    coverage,
    supportingExamples,
    counterEvidence,
    contradictions,
  }
  return {
    ...base,
    id: computeRecursiveFindingId(base),
    claim: canonicalClaim(claim),
    limitations: Array.from(new Set(limitations)).sort(compareUtf8),
    tags: Array.from(new Set(tags)).sort(compareUtf8),
  }
}

export const materializeFindingProposals = Effect.fn(
  'RecursiveSynthesis.materializeFindings',
)(function* (
  proposals: ReadonlyArray<FindingProposal>,
  availableEvidence: ReadonlyArray<typeRecursiveEvidenceReference>,
  coverage: typeRecursiveCoverage,
) {
  yield* validateCoverageIdentity(coverage)
  const evidenceById = new Map(
    availableEvidence.map((evidence) => [evidence.id, evidence]),
  )
  for (const [index, evidence] of availableEvidence.entries()) {
    if (evidence.id !== computeRecursiveEvidenceId(evidence)) {
      return yield* invalid(
        `evidence.${index}.id`,
        'Evidence identity does not match its canonical source lineage',
      )
    }
  }
  const findings: ResearchFinding[] = []
  for (const [index, proposal] of proposals.entries()) {
    const supporting = orderCanonicalIdentities(
      Array.from(new Set(proposal.supportingEvidence)),
    )
    const counter = orderCanonicalIdentities(
      Array.from(new Set(proposal.counterEvidence)),
    )
    const evidenceIds = orderCanonicalIdentities(
      Array.from(new Set([...supporting, ...counter])),
    )
    const supportingSet = new Set(supporting)
    if (counter.some((id) => supportingSet.has(id))) {
      return yield* invalid(
        `findings.${index}.counterEvidence`,
        'The same evidence cannot support and counter the same finding',
      )
    }
    if (evidenceIds.length === 0) {
      return yield* invalid(
        `findings.${index}.evidence`,
        'Finding proposals require at least one supplied evidence reference',
      )
    }
    const evidence: typeRecursiveEvidenceReference[] = []
    for (const evidenceId of evidenceIds) {
      const reference = evidenceById.get(evidenceId)
      if (reference === undefined) {
        return yield* invalid(
          `findings.${index}.evidence`,
          'Finding proposal references evidence outside the bounded node input',
        )
      }
      evidence.push(reference)
    }
    findings.push(materializeFinding(
      digestText(canonicalClaim(proposal.claim).toLocaleLowerCase('en-US')),
      proposal.claim,
      evidence,
      coverage,
      proposal.confidence,
      proposal.importance,
      supporting,
      counter,
      [],
      proposal.limitations,
      proposal.tags,
    ))
  }
  return findings
})

export const attachContradictions = Effect.fn(
  'RecursiveSynthesis.attachContradictions',
)(function* (
  findings: ReadonlyArray<ResearchFinding>,
  proposals: ReadonlyArray<typeContradictionProposal>,
) {
  const validatedFindings: ResearchFinding[] = []
  for (const [index, finding] of findings.entries()) {
    validatedFindings.push(yield* validateFindingBoundary(finding, index))
  }
  if (validatedFindings.length === 0) {
    const contradictions = yield* materializeContradictions([], proposals)
    return { contradictions, findings: [] }
  }
  const sharedCoverage = validatedFindings[0]!.coverage
  if (validatedFindings.some((finding) =>
    finding.coverage.id !== sharedCoverage.id)) {
    return yield* invalid(
      'findings.coverage',
      'Findings in one contradiction boundary must share a coverage snapshot',
    )
  }
  const mergedFindings = yield* mergeResearchFindings(
    validatedFindings,
    sharedCoverage,
  )
  const contradictions = yield* materializeContradictions(
    mergedFindings,
    proposals,
  )
  const attachedFindings: ResearchFinding[] = []
  for (const finding of mergedFindings) {
    const attached = yield* mergeContradictionVariants([
      ...finding.contradictions,
      ...contradictions.filter(
        (contradiction) =>
          contradiction.claimSignature === finding.claimSignature,
      ),
    ])
    const counterEvidence = orderCanonicalIdentities(Array.from(new Set([
      ...finding.counterEvidence,
      ...attached.flatMap((item) => item.conflictingEvidence),
    ])))
    attachedFindings.push(materializeFinding(
      finding.claimSignature,
      finding.claim,
      finding.evidence,
      finding.coverage,
      finding.confidence,
      finding.importance,
      finding.supportingExamples,
      counterEvidence,
      attached,
      finding.limitations,
      finding.tags,
    ))
  }
  const retainedContradictions = yield* mergeContradictionVariants(
    attachedFindings.flatMap((finding) => finding.contradictions),
  )
  return {
    contradictions: retainedContradictions,
    findings: attachedFindings,
  }
})

export const mergeCoverage = Effect.fn(
  'RecursiveSynthesis.mergeCoverage',
)(function* (
  inputs: ReadonlyArray<typeRecursiveCoverage>,
): Effect.fn.Return<typeRecursiveCoverage, ResearchContractValidationError> {
  const counts = {
    expectedItems: 0,
    examinedItems: 0,
    missingItems: 0,
    excludedItems: 0,
    expectedPartitions: 0,
    examinedPartitions: 0,
  }
  const fields = [
    'expectedItems',
    'examinedItems',
    'missingItems',
    'excludedItems',
    'expectedPartitions',
    'examinedPartitions',
  ] as const
  for (const [index, input] of inputs.entries()) {
    const coverage = yield* validateCoverageBoundary(
      input,
      `coverage.${index}`,
    )
    for (const field of fields) {
      const next = counts[field] + coverage[field]
      if (!Number.isSafeInteger(next)) {
        return yield* invalid(
          `coverage.${index}.${field}`,
          'Merged coverage counter exceeds the safe integer range',
        )
      }
      counts[field] = next
    }
  }
  const withoutId = {
    ...counts,
    status: (
      counts.missingItems === 0
      && counts.examinedPartitions === counts.expectedPartitions
    ) ? 'complete' as const : 'partial' as const,
  }
  const merged = { ...withoutId, id: computeCoverageSnapshotId(withoutId) }
  return yield* validateCoverageBoundary(merged, 'coverage')
})

export const mergeResearchFindings = Effect.fn(
  'RecursiveSynthesis.mergeFindings',
)(function* (
  inputs: ReadonlyArray<ResearchFinding>,
  coverage: typeRecursiveCoverage,
): Effect.fn.Return<
  ReadonlyArray<ResearchFinding>,
  ResearchContractValidationError
> {
  const validatedCoverage = yield* validateCoverageBoundary(
    coverage,
    'coverage',
  )
  const validatedInputs: ResearchFinding[] = []
  for (const [index, finding] of inputs.entries()) {
    validatedInputs.push(yield* validateFindingBoundary(finding, index))
  }
  const bySignature = new Map<ResearchFinding['claimSignature'], ResearchFinding[]>()
  for (const finding of validatedInputs) {
    const current = bySignature.get(finding.claimSignature) ?? []
    current.push(finding)
    bySignature.set(finding.claimSignature, current)
  }
  const merged: ResearchFinding[] = []
  for (const signature of orderCanonicalIdentities([...bySignature.keys()])) {
    const group = bySignature.get(signature)!
    const evidenceById = new Map(
      group.flatMap((finding) => finding.evidence)
        .map((evidence) => [evidence.id, evidence]),
    )
    const contradictions = yield* mergeContradictionVariants(
      group.flatMap((finding) => finding.contradictions),
    )
    const evidenceIds = orderCanonicalIdentities([...evidenceById.keys()])
    const displayClaim = group.map((finding) => canonicalClaim(finding.claim))
      .sort(compareUtf8)[0]!
    merged.push(materializeFinding(
      signature,
      displayClaim,
      evidenceIds.map((id) => evidenceById.get(id)!),
      validatedCoverage,
      Math.min(...group.map((finding) => finding.confidence)),
      Math.max(...group.map((finding) => finding.importance)),
      orderCanonicalIdentities(Array.from(new Set(
        group.flatMap((finding) => finding.supportingExamples),
      ))),
      orderCanonicalIdentities(Array.from(new Set(
        group.flatMap((finding) => finding.counterEvidence),
      ))),
      contradictions,
      Array.from(new Set(group.flatMap((finding) => finding.limitations)))
        .sort(compareUtf8),
      Array.from(new Set(group.flatMap((finding) => finding.tags)))
        .sort(compareUtf8),
    ))
  }
  for (const [index, finding] of merged.entries()) {
    yield* validateFindingBoundary(finding, index)
  }
  return merged
})
