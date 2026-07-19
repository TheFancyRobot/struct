import { Schema } from 'effect'
import {
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultSnapshotId,
  WorkspaceId,
} from './branded-ids.js'
import { Sha256Digest } from './directory-manifest.js'

const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())
const CanonicalSql = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32_768))
const QueryValue = Schema.Union(Schema.Null, Schema.Boolean, Schema.String)
const ArtifactDigest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))

export const QuerySnapshotReference = Schema.Struct({
  alias: Schema.String.pipe(Schema.pattern(/^[a-z][a-z0-9_]{0,62}$/)),
  datasetId: DatasetId,
  snapshotId: DatasetSnapshotId,
  schemaHash: Sha256Digest,
  parquetDigest: ArtifactDigest,
})
export type QuerySnapshotReference =
  Schema.Schema.Type<typeof QuerySnapshotReference>

export const QueryResultColumn = Schema.Struct({
  ordinal: NonNegativeInteger,
  name: Schema.String.pipe(Schema.minLength(1)),
  type: Schema.String.pipe(Schema.minLength(1)),
})
export type QueryResultColumn = Schema.Schema.Type<typeof QueryResultColumn>

export const QueryResultSnapshot = Schema.Struct({
  id: QueryResultSnapshotId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  requestHash: Sha256Digest,
  protocolVersion: Schema.Literal('1'),
  engineVersion: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(128)),
  engineConfigHash: Sha256Digest,
  canonicalSql: CanonicalSql,
  snapshots: Schema.Array(QuerySnapshotReference).pipe(Schema.minItems(1)),
  schemaHash: Sha256Digest,
  resultHash: Sha256Digest,
  resultArtifactHash: Sha256Digest,
  columns: Schema.Array(QueryResultColumn).pipe(Schema.minItems(1)),
  rows: Schema.Array(Schema.Array(QueryValue)),
  rowCount: NonNegativeInteger,
  truncated: Schema.Boolean,
  executedAt: Schema.BigIntFromNumber,
  createdAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((snapshot) => [
    snapshot.columns.every((column, index) => column.ordinal === index)
      ? undefined
      : 'query result columns require contiguous zero-based ordinals',
    snapshot.rows.every((row) => row.length === snapshot.columns.length)
      ? undefined
      : 'query result rows must match the selected columns',
    snapshot.rowCount === snapshot.rows.length
      ? undefined
      : 'query result row count must match the persisted rows',
  ]),
)
export type QueryResultSnapshot =
  Schema.Schema.Type<typeof QueryResultSnapshot>

export const DatasetQueryHistoryItem = Schema.Struct({
  id: QueryResultSnapshotId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  requestHash: Sha256Digest,
  protocolVersion: Schema.Literal('1'),
  engineVersion: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(128)),
  engineConfigHash: Sha256Digest,
  canonicalSql: CanonicalSql,
  snapshots: Schema.Array(QuerySnapshotReference).pipe(Schema.minItems(1)),
  schemaHash: Sha256Digest,
  resultHash: Sha256Digest,
  resultArtifactHash: Sha256Digest,
  rowCount: NonNegativeInteger,
  truncated: Schema.Boolean,
  executedAt: Schema.BigIntFromNumber,
  createdAt: Schema.BigIntFromNumber,
})
export type DatasetQueryHistoryItem =
  Schema.Schema.Type<typeof DatasetQueryHistoryItem>

export const DatasetCitation = Schema.Struct({
  id: DatasetCitationId,
  queryResultSnapshotId: QueryResultSnapshotId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  datasetId: DatasetId,
  datasetSnapshotId: DatasetSnapshotId,
  schemaHash: Sha256Digest,
  parquetDigest: ArtifactDigest,
  resultHash: Sha256Digest,
  resultArtifactHash: Sha256Digest,
  canonicalSql: CanonicalSql,
  selectedColumns: Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
    Schema.minItems(1),
  ),
  rowStart: NonNegativeInteger,
  rowEndExclusive: PositiveInteger,
  createdAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((citation) =>
    citation.rowEndExclusive > citation.rowStart
      ? true
      : 'dataset citation row range must be non-empty'),
)
export type DatasetCitation = Schema.Schema.Type<typeof DatasetCitation>

export const DatasetCitationEvidence = Schema.Struct({
  citation: DatasetCitation,
  snapshot: QueryResultSnapshot,
  columns: Schema.Array(QueryResultColumn).pipe(Schema.minItems(1)),
  rows: Schema.Array(Schema.Array(QueryValue)).pipe(Schema.minItems(1)),
})
export type DatasetCitationEvidence =
  Schema.Schema.Type<typeof DatasetCitationEvidence>
