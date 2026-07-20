import { Schema } from 'effect'
import {
  DatasetId,
  DatasetSnapshotId,
  DocumentChunkId,
  DocumentId,
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import { DatasetCitationEvidence } from './dataset-query-evidence.js'
import { DocumentLocator } from './document.js'
import { Sha256Digest } from './directory-manifest.js'
import { RecursiveEvidenceReference } from './research-finding.js'

const StableIdentity = Schema.String.pipe(
  Schema.pattern(/^sha256:[0-9a-f]{64}$/),
)
const CanonicalString = Schema.String.pipe(
  Schema.maxLength(2_048),
  Schema.filter((value) => !value.includes('\u0000') || 'must not contain NUL'),
)
const NonBlank = CanonicalString.pipe(
  Schema.minLength(1),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const CanonicalValue = Schema.Union(
  Schema.Null,
  Schema.Boolean,
  CanonicalString,
)

export const CrossSourceEvidenceId = StableIdentity.pipe(
  Schema.brand('CrossSourceEvidenceId'),
)
export type CrossSourceEvidenceId =
  Schema.Schema.Type<typeof CrossSourceEvidenceId>

export const CrossSourceReconciliationId = StableIdentity.pipe(
  Schema.brand('CrossSourceReconciliationId'),
)
export type CrossSourceReconciliationId =
  Schema.Schema.Type<typeof CrossSourceReconciliationId>

export const EvidenceFilter = Schema.Struct({
  field: NonBlank,
  operator: Schema.Literal('eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in'),
  value: CanonicalValue,
})
export type EvidenceFilter = Schema.Schema.Type<typeof EvidenceFilter>

export const EvidenceTimeWindow = Schema.Struct({
  startInclusive: NonBlank,
  endExclusive: NonBlank,
  timezone: NonBlank,
})
export type EvidenceTimeWindow = Schema.Schema.Type<typeof EvidenceTimeWindow>

/**
 * Explicit comparison metadata supplied by deterministic tools. Null means the
 * dimension was not established; reconciliation never infers it from prose.
 */
export const CrossSourceSemantics = Schema.Struct({
  unit: Schema.NullOr(NonBlank),
  timeWindow: Schema.NullOr(EvidenceTimeWindow),
  version: Schema.NullOr(NonBlank),
  filters: Schema.Array(EvidenceFilter).pipe(Schema.maxItems(64)),
  cohort: Schema.NullOr(NonBlank),
  denominator: Schema.NullOr(NonBlank),
  joinKeys: Schema.Array(NonBlank).pipe(Schema.maxItems(32)),
}).pipe(
  Schema.filter((semantics) => [
    new Set(semantics.filters.map((filter) =>
      `${filter.field}\u0000${filter.operator}\u0000${String(filter.value)}`))
      .size === semantics.filters.length
      ? undefined
      : 'evidence filters must be unique',
    new Set(semantics.joinKeys).size === semantics.joinKeys.length
      ? undefined
      : 'join keys must be unique',
  ]),
)
export type CrossSourceSemantics =
  Schema.Schema.Type<typeof CrossSourceSemantics>

export const CrossSourceDocumentEvidence = Schema.Struct({
  kind: Schema.Literal('document'),
  chunkId: DocumentChunkId,
  documentId: DocumentId,
  sourceVersionId: SourceVersionId,
  chunkingVersion: NonBlank,
  ordinal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  locator: DocumentLocator,
  citationLocator: NonBlank,
  excerpt: NonBlank,
  trust: Schema.Literal('untrusted-evidence'),
})
export type CrossSourceDocumentEvidence =
  Schema.Schema.Type<typeof CrossSourceDocumentEvidence>

export const CrossSourceDatasetEvidence = Schema.Struct({
  kind: Schema.Literal('dataset'),
  evidence: DatasetCitationEvidence,
  exactness: Schema.Literal('exact-immutable-query-result'),
})
export type CrossSourceDatasetEvidence =
  Schema.Schema.Type<typeof CrossSourceDatasetEvidence>

export const CrossSourceRecursiveEvidence = Schema.Struct({
  kind: Schema.Literal('recursive'),
  reference: RecursiveEvidenceReference,
  excerpt: NonBlank,
  trust: Schema.Literal('untrusted-evidence'),
})
export type CrossSourceRecursiveEvidence =
  Schema.Schema.Type<typeof CrossSourceRecursiveEvidence>

export const CrossSourceEvidencePayload = Schema.Union(
  CrossSourceDocumentEvidence,
  CrossSourceDatasetEvidence,
  CrossSourceRecursiveEvidence,
)
export type CrossSourceEvidencePayload =
  Schema.Schema.Type<typeof CrossSourceEvidencePayload>

const CrossSourceEvidenceFields = {
  claimSignature: Sha256Digest,
  stance: Schema.Literal('supports', 'conflicts'),
  semantics: CrossSourceSemantics,
  payload: CrossSourceEvidencePayload,
  limitations: Schema.Array(NonBlank).pipe(Schema.maxItems(64)),
}

export const CrossSourceEvidenceInput = Schema.Struct(
  CrossSourceEvidenceFields,
)
export type CrossSourceEvidenceInput =
  Schema.Schema.Type<typeof CrossSourceEvidenceInput>

export const CrossSourceEvidence = Schema.Struct({
  id: CrossSourceEvidenceId,
  ...CrossSourceEvidenceFields,
})
export type CrossSourceEvidence = Schema.Schema.Type<typeof CrossSourceEvidence>

export const CrossSourceEvidenceScope = Schema.Struct({
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.maxItems(512)),
  datasetSnapshots: Schema.Array(Schema.Struct({
    datasetId: DatasetId,
    datasetSnapshotId: DatasetSnapshotId,
  })).pipe(Schema.maxItems(512)),
}).pipe(
  Schema.filter((scope) =>
    new Set(scope.datasetSnapshots.map((snapshot) =>
      `${snapshot.datasetId}:${snapshot.datasetSnapshotId}`))
      .size === scope.datasetSnapshots.length
      ? true
      : 'authorized dataset snapshots must be unique'),
)
export type CrossSourceEvidenceScope =
  Schema.Schema.Type<typeof CrossSourceEvidenceScope>

export const CrossSourceReconciliationPolicy = Schema.Struct({
  requiredEvidenceKinds: Schema.Array(
    Schema.Literal('document', 'dataset', 'recursive'),
  ).pipe(Schema.minItems(2), Schema.maxItems(3)),
  authorizedJoinKeys: Schema.Array(NonBlank).pipe(Schema.maxItems(32)),
}).pipe(
  Schema.filter((policy) => [
    new Set(policy.requiredEvidenceKinds).size
      === policy.requiredEvidenceKinds.length
      ? undefined
      : 'required cross-source evidence kinds must be unique',
    new Set(policy.authorizedJoinKeys).size === policy.authorizedJoinKeys.length
      ? undefined
      : 'authorized join keys must be unique',
  ]),
)
export type CrossSourceReconciliationPolicy =
  Schema.Schema.Type<typeof CrossSourceReconciliationPolicy>

export const CrossSourceMismatch = Schema.Struct({
  dimension: Schema.Literal(
    'unit',
    'time-window',
    'version',
    'filters',
    'cohort',
    'denominator',
    'join-keys',
  ),
  values: Schema.Array(NonBlank).pipe(Schema.minItems(2), Schema.maxItems(64)),
})
export type CrossSourceMismatch =
  Schema.Schema.Type<typeof CrossSourceMismatch>

export const CrossSourceConflict = Schema.Struct({
  claimSignature: Sha256Digest,
  supportingEvidence: Schema.Array(CrossSourceEvidenceId).pipe(
    Schema.minItems(1),
  ),
  conflictingEvidence: Schema.Array(CrossSourceEvidenceId).pipe(
    Schema.minItems(1),
  ),
}).pipe(
  Schema.filter((conflict) => {
    const supporting = new Set(conflict.supportingEvidence)
    return [
      supporting.size === conflict.supportingEvidence.length
        ? undefined
        : 'supporting cross-source evidence identities must be unique',
      new Set(conflict.conflictingEvidence).size
        === conflict.conflictingEvidence.length
        ? undefined
        : 'conflicting cross-source evidence identities must be unique',
      conflict.conflictingEvidence.every((id) => !supporting.has(id))
        ? undefined
        : 'cross-source evidence cannot both support and conflict',
    ]
  }),
)
export type CrossSourceConflict = Schema.Schema.Type<typeof CrossSourceConflict>

export const CrossSourceReconciliationResult = Schema.Struct({
  id: CrossSourceReconciliationId,
  claimSignature: Sha256Digest,
  status: Schema.Literal(
    'aligned',
    'disclosed-mismatch',
    'contradictory',
    'insufficient',
    'rejected',
  ),
  evidence: Schema.Array(CrossSourceEvidence).pipe(Schema.maxItems(512)),
  mismatches: Schema.Array(CrossSourceMismatch).pipe(Schema.maxItems(16)),
  conflicts: Schema.Array(CrossSourceConflict).pipe(Schema.maxItems(16)),
  limitations: Schema.Array(NonBlank).pipe(Schema.maxItems(128)),
}).pipe(
  Schema.filter((result) => [
    result.evidence.every((item) =>
      item.claimSignature === result.claimSignature)
      ? undefined
      : 'reconciliation evidence must share the result claim signature',
    new Set(result.evidence.map((item) => item.id)).size
      === result.evidence.length
      ? undefined
      : 'reconciliation evidence identities must be unique',
    result.status === 'contradictory' && result.conflicts.length === 0
      ? 'contradictory reconciliation must retain its conflicts'
      : undefined,
    result.status !== 'contradictory'
      && result.status !== 'rejected'
      && result.conflicts.length > 0
      ? 'retained conflicts require contradictory or rejected reconciliation'
      : undefined,
    result.status === 'disclosed-mismatch' && result.mismatches.length === 0
      ? 'mismatched reconciliation must disclose its dimensions'
      : undefined,
  ]),
)
export type CrossSourceReconciliationResult =
  Schema.Schema.Type<typeof CrossSourceReconciliationResult>

export class CrossSourceEvidenceValidationError
  extends Schema.TaggedError<CrossSourceEvidenceValidationError>()(
    'CrossSourceEvidenceValidationError',
    {
      reason: Schema.Literal(
        'malformed',
        'invalid-identity',
        'invalid-lineage',
        'unsupported-join',
      ),
      path: Schema.String,
      message: Schema.String,
    },
  ) {}
