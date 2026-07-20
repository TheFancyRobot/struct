/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  DatasetCitationEvidence,
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultColumn,
  QueryResultSnapshotId,
  Sha256Digest,
  WorkspaceId,
  type DatasetCitationEvidence as typeDatasetCitationEvidence,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())
const NonNegativeInteger = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
)
const QueryValue = Schema.Union(Schema.Null, Schema.Boolean, Schema.String)

export const ResultSummaryLimits = Schema.Struct({
  maximumRows: PositiveInteger.pipe(Schema.between(1, 1_000)),
  maximumColumns: PositiveInteger.pipe(Schema.between(1, 256)),
  maximumBytes: PositiveInteger.pipe(Schema.between(1, 1_048_576)),
})
export type ResultSummaryLimits =
  Schema.Schema.Type<typeof ResultSummaryLimits>

export const BoundedQueryResultSummary = Schema.Struct({
  summaryHash: Sha256Digest,
  queryResultSnapshotId: QueryResultSnapshotId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  datasetId: DatasetId,
  datasetSnapshotId: DatasetSnapshotId,
  datasetCitationId: DatasetCitationId,
  canonicalSql: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32_768)),
  resultHash: Sha256Digest,
  resultArtifactHash: Sha256Digest,
  columns: Schema.Array(QueryResultColumn).pipe(Schema.minItems(1)),
  rows: Schema.Array(Schema.Array(QueryValue)),
  rowStart: NonNegativeInteger,
  rowEndExclusive: NonNegativeInteger,
  rowCount: NonNegativeInteger,
  truncated: Schema.Literal(false),
})
export type BoundedQueryResultSummary =
  Schema.Schema.Type<typeof BoundedQueryResultSummary>

export class ResultSummaryValidationError
  extends Schema.TaggedError<ResultSummaryValidationError>()(
    'ResultSummaryValidationError',
    {
      reason: Schema.Literal(
        'malformed',
        'invalid-lineage',
        'truncated-result',
        'result-too-large',
      ),
      path: Schema.String,
      message: Schema.String,
    },
  ) {}

function failure(
  reason: typeof ResultSummaryValidationError.Type['reason'],
  path: string,
  message: string,
): ResultSummaryValidationError {
  return new ResultSummaryValidationError({ reason, path, message })
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

function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (
    typeof value === 'boolean'
    || typeof value === 'number'
    || typeof value === 'string'
  ) {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort(compareUtf8).map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(Reflect.get(value, key))}`
    ).join(',')}}`
  }
  return JSON.stringify(String(value))
}

function hashSummary(value: unknown): typeof Sha256Digest.Type {
  return Sha256Digest.make(
    `sha256:${
      new Bun.CryptoHasher('sha256')
        .update(canonicalJson(value))
        .digest('hex')
    }`,
  )
}

function sameRows(
  left: typeDatasetCitationEvidence['rows'],
  right: typeDatasetCitationEvidence['rows'],
): boolean {
  return left.length === right.length
    && left.every((row, rowIndex) =>
      row.length === right[rowIndex]?.length
      && row.every((value, columnIndex) =>
        value === right[rowIndex]?.[columnIndex]))
}

/**
 * Produces a bounded structured view of an already persisted exact result.
 * It never samples or truncates: evidence that does not fit is rejected so a
 * model can never mistake an incomplete preview for the complete result.
 */
export const summarizeQueryResult = Effect.fn(
  'QueryResultSummary.summarize',
)(function* (
  rawEvidence: typeDatasetCitationEvidence,
  rawLimits: ResultSummaryLimits,
) {
  const evidence = yield* Schema.decodeUnknown(
    Schema.typeSchema(DatasetCitationEvidence),
  )(rawEvidence).pipe(Effect.mapError(() =>
    failure('malformed', 'evidence', 'Dataset citation evidence is invalid')))
  const limits = yield* Schema.decodeUnknown(
    Schema.typeSchema(ResultSummaryLimits),
  )(rawLimits).pipe(Effect.mapError(() =>
    failure('malformed', 'limits', 'Result summary limits are invalid')))
  const { citation, snapshot, columns, rows } = evidence
  if (snapshot.truncated) {
    return yield* failure(
      'truncated-result',
      'evidence.snapshot.truncated',
      'Truncated query results cannot support an exact synthesis summary',
    )
  }
  const binding = snapshot.snapshots.find((candidate) =>
    candidate.datasetId === citation.datasetId
    && candidate.snapshotId === citation.datasetSnapshotId
  )
  if (
    binding === undefined
    || citation.queryResultSnapshotId !== snapshot.id
    || citation.workspaceId !== snapshot.workspaceId
    || citation.projectId !== snapshot.projectId
    || citation.schemaHash !== binding.schemaHash
    || citation.parquetDigest !== binding.parquetDigest
    || citation.resultHash !== snapshot.resultHash
    || citation.resultArtifactHash !== snapshot.resultArtifactHash
    || citation.canonicalSql !== snapshot.canonicalSql
    || citation.rowEndExclusive > snapshot.rows.length
  ) {
    return yield* failure(
      'invalid-lineage',
      'evidence.citation',
      'Dataset citation does not match its immutable query result',
    )
  }
  const expectedColumns = citation.selectedColumns.map((name) =>
    snapshot.columns.find((column) => column.name === name))
  if (
    expectedColumns.some((column) => column === undefined)
    || columns.length !== expectedColumns.length
    || columns.some((column, index) =>
      column.name !== expectedColumns[index]?.name
      || column.ordinal !== expectedColumns[index]?.ordinal
      || column.type !== expectedColumns[index]?.type)
  ) {
    return yield* failure(
      'invalid-lineage',
      'evidence.columns',
      'Summary columns do not match the cited immutable result',
    )
  }
  const expectedRows = snapshot.rows
    .slice(citation.rowStart, citation.rowEndExclusive)
    .map((row) => columns.map((column) => row[column.ordinal] ?? null))
  if (!sameRows(rows, expectedRows)) {
    return yield* failure(
      'invalid-lineage',
      'evidence.rows',
      'Summary rows do not exactly match the cited immutable result',
    )
  }
  if (
    rows.length > limits.maximumRows
    || columns.length > limits.maximumColumns
  ) {
    return yield* failure(
      'result-too-large',
      'evidence',
      'Exact query result exceeds the configured summary row or column limit',
    )
  }
  const withoutHash = {
    queryResultSnapshotId: snapshot.id,
    workspaceId: snapshot.workspaceId,
    projectId: snapshot.projectId,
    datasetId: citation.datasetId,
    datasetSnapshotId: citation.datasetSnapshotId,
    datasetCitationId: citation.id,
    canonicalSql: snapshot.canonicalSql,
    resultHash: snapshot.resultHash,
    resultArtifactHash: snapshot.resultArtifactHash,
    columns,
    rows,
    rowStart: citation.rowStart,
    rowEndExclusive: citation.rowEndExclusive,
    rowCount: rows.length,
    truncated: false as const,
  }
  const summary = {
    summaryHash: hashSummary(withoutHash),
    ...withoutHash,
  }
  if (
    new TextEncoder().encode(canonicalJson(summary)).byteLength
      > limits.maximumBytes
  ) {
    return yield* failure(
      'result-too-large',
      'evidence',
      'Exact query result exceeds the configured summary byte limit',
    )
  }
  return yield* Schema.decodeUnknown(
    Schema.typeSchema(BoundedQueryResultSummary),
  )(summary).pipe(Effect.mapError(() =>
    failure('malformed', 'summary', 'Bounded query result summary is invalid')))
})
