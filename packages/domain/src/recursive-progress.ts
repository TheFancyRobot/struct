import { Schema } from 'effect'
import {
  CitationId,
  JobQueueId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import {
  RecursiveAnalysisRequestId,
  RecursiveBatchId,
  RecursiveDecompositionNodeId,
  RecursivePartitionId,
} from './recursive-analysis.js'
import {
  RecursiveContradiction,
  RecursiveCoverage,
  RecursiveEvidenceId,
  ResearchFinding,
} from './research-finding.js'

const Counter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)
const Timestamp = Counter
const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const StableIdentity = Schema.String.pipe(
  Schema.pattern(/^sha256:[0-9a-f]{64}$/),
)

export const RecursiveRunProgressStatus = Schema.Literal(
  'queued',
  'running',
  'recovering',
  'partial',
  'completed',
  'failed',
  'cancelled',
)
export type RecursiveRunProgressStatus =
  Schema.Schema.Type<typeof RecursiveRunProgressStatus>

export const RecursiveBatchProgress = Schema.Struct({
  id: RecursiveBatchId,
  status: Schema.Literal(
    'queued',
    'running',
    'retrying',
    'committed',
    'failed',
    'cancelled',
  ),
  attempt: Counter,
  evidenceIds: Schema.Array(RecursiveEvidenceId),
  updatedAt: Timestamp,
}).pipe(
  Schema.filter((batch) =>
    new Set(batch.evidenceIds).size === batch.evidenceIds.length
      || 'batch evidence identities must be unique'),
)
export type RecursiveBatchProgress =
  Schema.Schema.Type<typeof RecursiveBatchProgress>

export const RecursivePartitionProgressDetail = Schema.Struct({
  id: RecursivePartitionId,
  nodeId: RecursiveDecompositionNodeId,
  ordinal: Counter,
  status: Schema.Literal(
    'queued',
    'running',
    'retrying',
    'committed',
    'failed',
    'cancelled',
  ),
  attempt: Counter,
  batches: Schema.Array(RecursiveBatchProgress).pipe(Schema.maxItems(16)),
  failureTag: Schema.NullOr(NonBlank),
  startedAt: Schema.NullOr(Timestamp),
  updatedAt: Timestamp,
}).pipe(
  Schema.filter((partition) => [
    new Set(partition.batches.map((batch) => batch.id)).size
      === partition.batches.length
      ? undefined
      : 'partition batch identities must be unique',
    partition.status === 'failed' && partition.failureTag === null
      ? 'failed partitions require a failure tag'
      : undefined,
  ]),
)
export type RecursivePartitionProgressDetail =
  Schema.Schema.Type<typeof RecursivePartitionProgressDetail>

export const RecursiveResultProgress = Schema.Struct({
  status: Schema.Literal('partial', 'complete'),
  coverage: RecursiveCoverage,
  findings: Schema.Array(ResearchFinding).pipe(Schema.maxItems(512)),
  contradictions: Schema.Array(RecursiveContradiction).pipe(
    Schema.maxItems(512),
  ),
  missingEvidence: Schema.Array(NonBlank).pipe(Schema.maxItems(512)),
  excludedEvidence: Schema.Array(NonBlank).pipe(Schema.maxItems(512)),
  limitations: Schema.Array(NonBlank).pipe(Schema.maxItems(128)),
  citations: Schema.Array(Schema.Struct({
    citationId: CitationId,
    evidenceId: RecursiveEvidenceId,
    sourceVersionId: SourceVersionId,
    locator: NonBlank,
  })).pipe(Schema.maxItems(512)),
  updatedAt: Timestamp,
}).pipe(
  Schema.filter((result) => {
    const evidence = new Map(
      result.findings.flatMap((finding) =>
        finding.evidence.map((item) => [item.id, item] as const)),
    )
    const topContradictions = new Map(
      result.contradictions.map((item) => [item.id, item] as const),
    )
    const findingContradictions = result.findings.flatMap(
      (finding) => finding.contradictions,
    )
    const citedEvidenceIds = result.citations.map(
      (citation) => citation.evidenceId,
    )
    const citationIds = result.citations.map(
      (citation) => citation.citationId,
    )
    return [
    new Set(result.findings.map((finding) => finding.id)).size
      === result.findings.length
      ? undefined
      : 'recursive result finding identities must be unique',
    new Set(result.contradictions.map((item) => item.id)).size
      === result.contradictions.length
      ? undefined
      : 'recursive result contradiction identities must be unique',
    findingContradictions.every((item) => {
      const retained = topContradictions.get(item.id)
      return retained !== undefined
        && JSON.stringify(retained) === JSON.stringify(item)
    })
      ? undefined
      : 'finding contradictions must be retained exactly at result level',
    result.contradictions.every((item) =>
      findingContradictions.some((retained) => retained.id === item.id))
      ? undefined
      : 'result contradictions must belong to a retained finding',
    result.contradictions.flatMap((item) => [
      ...item.supportingEvidence,
      ...item.conflictingEvidence,
    ]).every((id) => evidence.has(id))
      ? undefined
      : 'result contradictions must reference retained evidence',
    result.status === 'complete' && result.coverage.status !== 'complete'
      ? 'complete recursive results require complete coverage'
      : undefined,
    result.citations.every((citation) => {
      const referenced = evidence.get(citation.evidenceId)
      return referenced?.sourceVersionId === citation.sourceVersionId
        && referenced.locator === citation.locator
    })
      ? undefined
      : 'recursive citations must match exact retained evidence lineage',
    new Set(citationIds).size === citationIds.length
      ? undefined
      : 'recursive citation identities must be unique',
    new Set(citedEvidenceIds).size === citedEvidenceIds.length
      ? undefined
      : 'recursive citations must reference each evidence item at most once',
    ]
  }),
)
export type RecursiveResultProgress =
  Schema.Schema.Type<typeof RecursiveResultProgress>

export const RecursiveRunProgress = Schema.Struct({
  runId: ResearchRunId,
  workspaceId: WorkspaceId,
  requestId: RecursiveAnalysisRequestId,
  planId: StableIdentity,
  status: RecursiveRunProgressStatus,
  cancellation: Schema.Literal('none', 'requested', 'acknowledged'),
  recoveryCount: Counter,
  expectedPartitions: Counter,
  committedPartitions: Counter,
  failedPartitions: Counter,
  partitions: Schema.Array(RecursivePartitionProgressDetail).pipe(
    Schema.maxItems(65_536),
  ),
  result: Schema.NullOr(RecursiveResultProgress),
  updatedAt: Timestamp,
}).pipe(
  Schema.filter((progress) => [
    progress.committedPartitions + progress.failedPartitions
      <= progress.expectedPartitions
      ? undefined
      : 'terminal partition counts cannot exceed expected partitions',
    new Set(progress.partitions.map((partition) => partition.id)).size
      === progress.partitions.length
      ? undefined
      : 'recursive progress partition identities must be unique',
    progress.result?.status === 'complete'
      && progress.status !== 'completed'
      ? 'complete results require a completed run'
      : undefined,
  ]),
)
export type RecursiveRunProgress =
  Schema.Schema.Type<typeof RecursiveRunProgress>

export const RecursiveRunProgressCommittedData = Schema.Struct({
  jobId: JobQueueId,
  attempt: Counter,
  workspaceId: WorkspaceId,
  requestId: RecursiveAnalysisRequestId,
  planId: StableIdentity,
  status: RecursiveRunProgressStatus,
  cancellation: Schema.Literal('none', 'requested', 'acknowledged'),
  recoveryCount: Counter,
  expectedPartitions: Counter,
  committedPartitions: Counter,
  failedPartitions: Counter,
})

export const RecursivePartitionProgressCommittedData = Schema.Struct({
  jobId: JobQueueId,
  attempt: Counter,
  workspaceId: WorkspaceId,
  requestId: RecursiveAnalysisRequestId,
  planId: StableIdentity,
  partition: RecursivePartitionProgressDetail,
})

export const RecursiveResultProgressCommittedData = Schema.Struct({
  jobId: JobQueueId,
  attempt: Counter,
  workspaceId: WorkspaceId,
  requestId: RecursiveAnalysisRequestId,
  planId: StableIdentity,
  result: RecursiveResultProgress,
})
