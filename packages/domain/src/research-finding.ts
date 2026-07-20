import { Schema } from 'effect'
import { SourceVersionId } from './branded-ids.js'
import { ResearchArtifactRef } from './research-execution.js'

const StableIdentity = Schema.String.pipe(
  Schema.pattern(/^sha256:[0-9a-f]{64}$/),
)
const NonBlankString = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const Counter = Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.nonNegative())

export const RecursiveEvidenceId = StableIdentity.pipe(
  Schema.brand('RecursiveEvidenceId'),
)
export type RecursiveEvidenceId = Schema.Schema.Type<typeof RecursiveEvidenceId>

export const RecursiveFindingId = StableIdentity.pipe(
  Schema.brand('RecursiveFindingId'),
)
export type RecursiveFindingId = Schema.Schema.Type<typeof RecursiveFindingId>

export const CoverageSnapshotId = StableIdentity.pipe(
  Schema.brand('CoverageSnapshotId'),
)
export type CoverageSnapshotId = Schema.Schema.Type<typeof CoverageSnapshotId>

export const RecursiveContradictionId = StableIdentity.pipe(
  Schema.brand('RecursiveContradictionId'),
)
export type RecursiveContradictionId =
  Schema.Schema.Type<typeof RecursiveContradictionId>

export const RecursiveEvidenceReference = Schema.Struct({
  id: RecursiveEvidenceId,
  sourceVersionId: SourceVersionId,
  artifact: ResearchArtifactRef,
  locator: NonBlankString,
})
export type RecursiveEvidenceReference =
  Schema.Schema.Type<typeof RecursiveEvidenceReference>

export const RecursiveCoverage = Schema.Struct({
  id: CoverageSnapshotId,
  expectedItems: Counter,
  examinedItems: Counter,
  missingItems: Counter,
  excludedItems: Counter,
  expectedPartitions: Counter,
  examinedPartitions: Counter,
  status: Schema.Literal('complete', 'partial'),
}).pipe(
  Schema.filter((coverage) => [
    coverage.examinedItems + coverage.missingItems + coverage.excludedItems
      === coverage.expectedItems
      ? undefined
      : 'item coverage counts must sum to expectedItems',
    coverage.examinedPartitions <= coverage.expectedPartitions
      ? undefined
      : 'examinedPartitions cannot exceed expectedPartitions',
    coverage.status === 'complete'
      && (
        coverage.missingItems > 0
        || coverage.examinedPartitions !== coverage.expectedPartitions
      )
      ? 'complete coverage cannot contain missing items or partitions'
      : undefined,
    coverage.status === 'partial'
      && coverage.missingItems === 0
      && coverage.examinedPartitions === coverage.expectedPartitions
      ? 'fully accounted coverage must be complete'
      : undefined,
  ]),
)
export type RecursiveCoverage = Schema.Schema.Type<typeof RecursiveCoverage>

export const RecursiveContradiction = Schema.Struct({
  id: RecursiveContradictionId,
  claimSignature: StableIdentity,
  supportingEvidence: Schema.Array(RecursiveEvidenceId).pipe(Schema.minItems(1)),
  conflictingEvidence: Schema.Array(RecursiveEvidenceId).pipe(Schema.minItems(1)),
  status: Schema.Literal('unresolved', 'resolved'),
  limitations: Schema.Array(NonBlankString).pipe(Schema.maxItems(64)),
}).pipe(
  Schema.filter((contradiction) => {
    const supporting = new Set(contradiction.supportingEvidence)
    const conflicting = new Set(contradiction.conflictingEvidence)
    return [
      supporting.size === contradiction.supportingEvidence.length
        ? undefined
        : 'supporting evidence identities must be unique',
      conflicting.size === contradiction.conflictingEvidence.length
        ? undefined
        : 'conflicting evidence identities must be unique',
      contradiction.supportingEvidence.every((id) => !conflicting.has(id))
        ? undefined
        : 'the same evidence cannot both support and conflict with a claim',
    ]
  }),
)
export type RecursiveContradiction =
  Schema.Schema.Type<typeof RecursiveContradiction>

export const ResearchFinding = Schema.Struct({
  id: RecursiveFindingId,
  claimSignature: StableIdentity,
  claim: NonBlankString,
  evidence: Schema.Array(RecursiveEvidenceReference).pipe(Schema.minItems(1)),
  confidence: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  importance: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  coverage: RecursiveCoverage,
  supportingExamples: Schema.Array(RecursiveEvidenceId).pipe(Schema.maxItems(64)),
  counterEvidence: Schema.Array(RecursiveEvidenceId).pipe(Schema.maxItems(64)),
  contradictions: Schema.Array(RecursiveContradiction).pipe(Schema.maxItems(64)),
  limitations: Schema.Array(NonBlankString).pipe(Schema.maxItems(64)),
  tags: Schema.Array(
    Schema.String.pipe(
      Schema.pattern(/^[a-z0-9][a-z0-9-]{0,62}$/),
    ),
  ).pipe(Schema.maxItems(64)),
}).pipe(
  Schema.filter((finding) => {
    const evidenceIds = new Set(finding.evidence.map((evidence) => evidence.id))
    const contradictionEvidence = finding.contradictions.flatMap(
      (contradiction) => [
        ...contradiction.supportingEvidence,
        ...contradiction.conflictingEvidence,
      ],
    )
    return [
      evidenceIds.size === finding.evidence.length
        ? undefined
        : 'finding evidence identities must be unique',
      new Set(finding.supportingExamples).size === finding.supportingExamples.length
        ? undefined
        : 'supporting example identities must be unique',
      new Set(finding.counterEvidence).size === finding.counterEvidence.length
        ? undefined
        : 'counterevidence identities must be unique',
      new Set(finding.contradictions.map((item) => item.id)).size
        === finding.contradictions.length
        ? undefined
        : 'finding contradiction identities must be unique',
      finding.supportingExamples.every((id) => evidenceIds.has(id))
        ? undefined
        : 'supporting examples must reference finding evidence',
      finding.counterEvidence.every((id) => evidenceIds.has(id))
        ? undefined
        : 'counterevidence must reference finding evidence',
      contradictionEvidence.every((id) => evidenceIds.has(id))
        ? undefined
        : 'contradictions must reference finding evidence',
      finding.contradictions.length > 0 && finding.counterEvidence.length === 0
        ? 'findings with contradictions must retain counterevidence'
        : undefined,
    ]
  }),
)
export type ResearchFinding = Schema.Schema.Type<typeof ResearchFinding>
