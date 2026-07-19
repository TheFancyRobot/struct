import {
  DatasetId,
  DatasetFieldSchema,
  DatasetSnapshotId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
} from '@struct/domain'
import { Schema } from 'effect'

export const DATA_ENGINE_PROTOCOL_VERSION = '1' as const

const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())
const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const ArtifactDigest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
export const ArtifactToken = Schema.String.pipe(Schema.pattern(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
))
export type ArtifactToken = Schema.Schema.Type<typeof ArtifactToken>

export const DataEngineInput = Schema.Struct({
  ordinal: NonNegativeInteger,
  format: Schema.Literal('json', 'jsonl', 'csv'),
  artifactDigest: ArtifactDigest,
  contentHash: Sha256Digest,
})
export type DataEngineInput = Schema.Schema.Type<typeof DataEngineInput>

export const MaterializeRequest = Schema.Struct({
  protocolVersion: Schema.Literal(DATA_ENGINE_PROTOCOL_VERSION),
  operation: Schema.Literal('materialize'),
  snapshotId: DatasetSnapshotId,
  inputs: Schema.Array(DataEngineInput).pipe(Schema.minItems(1)),
  fields: Schema.Array(DatasetFieldSchema).pipe(Schema.minItems(1)),
  limits: Schema.Struct({
    maxInputBytes: PositiveInteger,
    maxRows: PositiveInteger,
    maxOutputBytes: PositiveInteger,
    timeoutMs: PositiveInteger,
  }),
}).pipe(
  Schema.filter((request) => [
    request.inputs.every((input, index) => input.ordinal === index)
      ? undefined
      : 'inputs require contiguous zero-based ordinals',
    request.fields.every((field, index) => field.ordinal === index)
      ? undefined
      : 'fields require contiguous zero-based ordinals',
  ]),
)
export type MaterializeRequest = Schema.Schema.Type<typeof MaterializeRequest>

export const ColumnProfile = Schema.Struct({
  ordinal: NonNegativeInteger,
  name: Schema.String,
  nullCount: NonNegativeInteger,
  distinctCount: NonNegativeInteger,
  minimum: Schema.NullOr(Schema.String),
  maximum: Schema.NullOr(Schema.String),
})
export type ColumnProfile = Schema.Schema.Type<typeof ColumnProfile>

export const DatasetProfile = Schema.Struct({
  rowCount: NonNegativeInteger,
  columns: Schema.Array(ColumnProfile),
})
export type DatasetProfile = Schema.Schema.Type<typeof DatasetProfile>

export const MaterializeResult = Schema.Struct({
  protocolVersion: Schema.Literal(DATA_ENGINE_PROTOCOL_VERSION),
  snapshotId: DatasetSnapshotId,
  artifactToken: ArtifactToken,
  parquetDigest: ArtifactDigest,
  parquetByteLength: PositiveInteger,
  profileHash: Sha256Digest,
  profile: DatasetProfile,
})
export type MaterializeResult = Schema.Schema.Type<typeof MaterializeResult>

export const MaterializeSuccess = Schema.Struct({
  ok: Schema.Literal(true),
  result: MaterializeResult,
})

export const DataEngineErrorCode = Schema.Literal(
  'authentication',
  'protocol',
  'invalid-input',
  'invalid-query',
  'not-found',
  'handoff-not-found',
  'lineage',
  'resource-limit',
  'busy',
  'cancelled',
  'timeout',
  'engine',
)
export type DataEngineErrorCode = Schema.Schema.Type<typeof DataEngineErrorCode>

export const MaterializeFailure = Schema.Struct({
  ok: Schema.Literal(false),
  error: Schema.Struct({
    code: DataEngineErrorCode,
    message: Schema.String,
  }),
})

export const MaterializeResponse = Schema.Union(
  MaterializeSuccess,
  MaterializeFailure,
)
export type MaterializeResponse = Schema.Schema.Type<typeof MaterializeResponse>

const SqlAlias = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,62}$/),
)
const SqlText = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32_768))

export const QuerySnapshotBinding = Schema.Struct({
  alias: SqlAlias,
  datasetId: DatasetId,
  snapshotId: DatasetSnapshotId,
  schemaHash: Sha256Digest,
  parquetDigest: ArtifactDigest,
})
export type QuerySnapshotBinding =
  Schema.Schema.Type<typeof QuerySnapshotBinding>

export const QueryRequest = Schema.Struct({
  protocolVersion: Schema.Literal(DATA_ENGINE_PROTOCOL_VERSION),
  operation: Schema.Literal('query'),
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sql: SqlText,
  snapshots: Schema.Array(QuerySnapshotBinding).pipe(
    Schema.minItems(1),
    Schema.maxItems(8),
  ),
  limits: Schema.Struct({
    maxRows: PositiveInteger,
    maxOutputBytes: PositiveInteger,
    maxMemoryMb: PositiveInteger,
    timeoutMs: PositiveInteger,
  }),
}).pipe(
  Schema.filter((request) => {
    const aliases = new Set(request.snapshots.map((snapshot) => snapshot.alias))
    const snapshotIds = new Set(
      request.snapshots.map((snapshot) => snapshot.snapshotId),
    )
    return [
      aliases.size === request.snapshots.length
        ? undefined
        : 'snapshot aliases must be unique',
      snapshotIds.size === request.snapshots.length
        ? undefined
        : 'snapshot bindings must be unique',
    ]
  }),
)
export type QueryRequest = Schema.Schema.Type<typeof QueryRequest>

export const QueryColumn = Schema.Struct({
  ordinal: NonNegativeInteger,
  name: Schema.String,
  type: Schema.String,
})
export type QueryColumn = Schema.Schema.Type<typeof QueryColumn>

export const QueryValue = Schema.Union(
  Schema.Null,
  Schema.Boolean,
  Schema.String,
)
export type QueryValue = Schema.Schema.Type<typeof QueryValue>

export const QueryResult = Schema.Struct({
  protocolVersion: Schema.Literal(DATA_ENGINE_PROTOCOL_VERSION),
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  canonicalSql: SqlText,
  snapshots: Schema.Array(QuerySnapshotBinding),
  schemaHash: Sha256Digest,
  resultHash: Sha256Digest,
  columns: Schema.Array(QueryColumn),
  rows: Schema.Array(Schema.Array(QueryValue)),
  rowCount: NonNegativeInteger,
  truncated: Schema.Boolean,
  executionMs: NonNegativeInteger,
})
export type QueryResult = Schema.Schema.Type<typeof QueryResult>

export const QuerySuccess = Schema.Struct({
  ok: Schema.Literal(true),
  result: QueryResult,
})

export const QueryFailure = Schema.Struct({
  ok: Schema.Literal(false),
  error: Schema.Struct({
    code: DataEngineErrorCode,
    message: Schema.String,
  }),
})

export const QueryResponse = Schema.Union(QuerySuccess, QueryFailure)
export type QueryResponse = Schema.Schema.Type<typeof QueryResponse>
