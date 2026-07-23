import {
  DATA_ENGINE_VERSION,
  DatasetCitation,
  DatasetCitationEvidence,
  DatasetCitationId,
  DatasetQueryHistoryItem,
  ProjectId,
  QueryResultSnapshot,
  QueryResultSnapshotId,
  WorkspaceId,
} from '@struct/domain'
import { Effect, ParseResult, Schema } from 'effect'
import {
  datasetCitationValidationErrorMessage,
  datasetQueryEvidenceConflictErrorMessage,
  datasetQueryEvidencePersistenceErrorMessage,
  datasetQueryEvidenceScopeErrorMessage,
  sanitizeDatasetCitationValidationReason,
  sanitizeDatasetQueryEvidenceEntity,
  sanitizeDatasetQueryEvidenceId,
  sanitizeDatasetQueryEvidenceOperation,
} from '../error-boundary.js'
import { SqlClient } from '../sql-client.js'

const DateToNumber = Schema.transformOrFail(Schema.DateFromSelf, Schema.Number, {
  decode: (date) => ParseResult.succeed(date.getTime()),
  encode: (milliseconds) => ParseResult.succeed(new Date(milliseconds)),
})
const StoredResultRow = Schema.Struct({
  id: QueryResultSnapshotId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  request_hash: Schema.String,
  protocol_version: Schema.Literal('1'),
  engine_version: Schema.Literal(DATA_ENGINE_VERSION),
  engine_adapter_version: Schema.String,
  execution_policy_version: Schema.Union(Schema.Number, Schema.NumberFromString),
  engine_config_hash: Schema.String,
  canonical_sql: Schema.String,
  dataset_snapshots: Schema.Unknown,
  schema_hash: Schema.String,
  result_hash: Schema.String,
  result_artifact_hash: Schema.String,
  columns: Schema.Unknown,
  rows: Schema.Unknown,
  row_count: Schema.Union(Schema.Number, Schema.NumberFromString),
  truncated: Schema.Boolean,
  executed_at: DateToNumber,
  created_at: DateToNumber,
})
const StoredCitationRow = Schema.Struct({
  id: DatasetCitationId,
  query_result_snapshot_id: QueryResultSnapshotId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  dataset_id: Schema.String,
  dataset_snapshot_id: Schema.String,
  schema_hash: Schema.String,
  parquet_digest: Schema.String,
  result_hash: Schema.String,
  result_artifact_hash: Schema.String,
  canonical_sql: Schema.String,
  selected_columns: Schema.Unknown,
  row_start: Schema.Union(Schema.Number, Schema.NumberFromString),
  row_end_exclusive: Schema.Union(Schema.Number, Schema.NumberFromString),
  created_at: DateToNumber,
})
const StoredHistoryRow = Schema.Struct({
  id: QueryResultSnapshotId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  request_hash: Schema.String,
  protocol_version: Schema.Literal('1'),
  engine_version: Schema.Literal(DATA_ENGINE_VERSION),
  engine_adapter_version: Schema.String,
  execution_policy_version: Schema.Union(Schema.Number, Schema.NumberFromString),
  engine_config_hash: Schema.String,
  canonical_sql: Schema.String,
  dataset_snapshots: Schema.Unknown,
  schema_hash: Schema.String,
  result_hash: Schema.String,
  result_artifact_hash: Schema.String,
  row_count: Schema.Union(Schema.Number, Schema.NumberFromString),
  truncated: Schema.Boolean,
  executed_at: DateToNumber,
  created_at: DateToNumber,
})

export class DatasetQueryEvidencePersistenceError
  extends Schema.TaggedError<DatasetQueryEvidencePersistenceError>()(
    'DatasetQueryEvidencePersistenceError',
    { operation: Schema.String, message: Schema.String },
  ) {
  constructor(args: {
    operation: string
    message?: string
    cause?: unknown
  }) {
    const operation = sanitizeDatasetQueryEvidenceOperation(args.operation)
    super({
      operation,
      message: datasetQueryEvidencePersistenceErrorMessage(operation),
    })
  }
}

export class DatasetQueryEvidenceScopeError
  extends Schema.TaggedError<DatasetQueryEvidenceScopeError>()(
    'DatasetQueryEvidenceScopeError',
    { entity: Schema.String, id: Schema.String, message: Schema.String },
  ) {
  constructor(args: {
    entity: string
    id: string
    message?: string
    cause?: unknown
  }) {
    const entity = sanitizeDatasetQueryEvidenceEntity(args.entity)
    const id = sanitizeDatasetQueryEvidenceId(
      args.id,
      entity === 'citation' ? 'unknown-citation-id' : 'unknown-result-id',
    )
    super({
      entity,
      id,
      message: datasetQueryEvidenceScopeErrorMessage(entity),
    })
  }
}

export class DatasetQueryEvidenceConflictError
  extends Schema.TaggedError<DatasetQueryEvidenceConflictError>()(
    'DatasetQueryEvidenceConflictError',
    { entity: Schema.String, message: Schema.String },
  ) {
  constructor(args: {
    entity: string
    message?: string
    cause?: unknown
  }) {
    const entity = sanitizeDatasetQueryEvidenceEntity(args.entity)
    super({
      entity,
      message: datasetQueryEvidenceConflictErrorMessage(entity),
    })
  }
}

export class DatasetCitationValidationError
  extends Schema.TaggedError<DatasetCitationValidationError>()(
    'DatasetCitationValidationError',
    { citationId: Schema.String, reason: Schema.String, message: Schema.String },
  ) {
  constructor(args: {
    citationId: string
    reason: string
    message?: string
    cause?: unknown
  }) {
    const citationId = sanitizeDatasetQueryEvidenceId(
      args.citationId,
      'unknown-citation-id',
    )
    const reason = sanitizeDatasetCitationValidationReason(args.reason)
    super({
      citationId,
      reason,
      message: datasetCitationValidationErrorMessage(reason),
    })
  }
}

export type DatasetQueryEvidenceError =
  | DatasetQueryEvidencePersistenceError
  | DatasetQueryEvidenceScopeError
  | DatasetQueryEvidenceConflictError
  | DatasetCitationValidationError

const failure = (operation: string) =>
  new DatasetQueryEvidencePersistenceError({ operation })

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed
  } catch {
    return value
  }
}

function decodeResult(row: unknown) {
  return Schema.decodeUnknown(StoredResultRow)(row).pipe(
    Effect.flatMap((stored) => Schema.decodeUnknown(QueryResultSnapshot)({
      id: stored.id,
      workspaceId: stored.workspace_id,
      projectId: stored.project_id,
      requestHash: stored.request_hash,
      protocolVersion: stored.protocol_version,
      engineVersion: stored.engine_version,
      engineAdapterVersion: stored.engine_adapter_version,
      executionPolicyVersion: stored.execution_policy_version,
      engineConfigHash: stored.engine_config_hash,
      canonicalSql: stored.canonical_sql,
      snapshots: jsonValue(stored.dataset_snapshots),
      schemaHash: stored.schema_hash,
      resultHash: stored.result_hash,
      resultArtifactHash: stored.result_artifact_hash,
      columns: jsonValue(stored.columns),
      rows: jsonValue(stored.rows),
      rowCount: stored.row_count,
      truncated: stored.truncated,
      executedAt: stored.executed_at,
      createdAt: stored.created_at,
    })),
    Effect.mapError(() => failure('result decode')),
  )
}

function decodeCitation(row: unknown) {
  return Schema.decodeUnknown(StoredCitationRow)(row).pipe(
    Effect.flatMap((stored) => Schema.decodeUnknown(DatasetCitation)({
      id: stored.id,
      queryResultSnapshotId: stored.query_result_snapshot_id,
      workspaceId: stored.workspace_id,
      projectId: stored.project_id,
      datasetId: stored.dataset_id,
      datasetSnapshotId: stored.dataset_snapshot_id,
      schemaHash: stored.schema_hash,
      parquetDigest: stored.parquet_digest,
      resultHash: stored.result_hash,
      resultArtifactHash: stored.result_artifact_hash,
      canonicalSql: stored.canonical_sql,
      selectedColumns: jsonValue(stored.selected_columns),
      rowStart: stored.row_start,
      rowEndExclusive: stored.row_end_exclusive,
      createdAt: stored.created_at,
    })),
    Effect.mapError(() => failure('citation decode')),
  )
}

function decodeHistory(row: unknown) {
  return Schema.decodeUnknown(StoredHistoryRow)(row).pipe(
    Effect.flatMap((stored) => Schema.decodeUnknown(DatasetQueryHistoryItem)({
      id: stored.id,
      workspaceId: stored.workspace_id,
      projectId: stored.project_id,
      requestHash: stored.request_hash,
      protocolVersion: stored.protocol_version,
      engineVersion: stored.engine_version,
      engineAdapterVersion: stored.engine_adapter_version,
      executionPolicyVersion: stored.execution_policy_version,
      engineConfigHash: stored.engine_config_hash,
      canonicalSql: stored.canonical_sql,
      snapshots: jsonValue(stored.dataset_snapshots),
      schemaHash: stored.schema_hash,
      resultHash: stored.result_hash,
      resultArtifactHash: stored.result_artifact_hash,
      rowCount: stored.row_count,
      truncated: stored.truncated,
      executedAt: stored.executed_at,
      createdAt: stored.created_at,
    })),
    Effect.mapError(() => failure('history decode')),
  )
}

function sameResult(
  left: typeof QueryResultSnapshot.Type,
  right: typeof QueryResultSnapshot.Type,
): boolean {
  return JSON.stringify({
    ...left,
    id: undefined,
    executedAt: undefined,
    createdAt: undefined,
  }) === JSON.stringify({
    ...right,
    id: undefined,
    executedAt: undefined,
    createdAt: undefined,
  })
}

async function selectResult(
  sql: import('../sql-client.js').SqlExecutorShape,
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
  predicate: string,
  value: string,
) {
  return sql.unsafe(
    `SELECT * FROM query_result_snapshots
     WHERE workspace_id = $1 AND project_id = $2 AND ${predicate} = $3`,
    [workspaceId, projectId, value],
  )
}

export class DatasetQueryEvidenceRepo
  extends Effect.Service<DatasetQueryEvidenceRepo>()(
    'DatasetQueryEvidenceRepo',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const sql = yield* SqlClient

        const record = Effect.fn('DatasetQueryEvidenceRepo.record')(
          function* (
            resultInput: typeof QueryResultSnapshot.Type,
            citationInputs: ReadonlyArray<typeof DatasetCitation.Type>,
          ) {
            const result = yield* Schema.decodeUnknown(
              Schema.typeSchema(QueryResultSnapshot),
            )(
              resultInput,
            ).pipe(Effect.mapError(() => failure('result validation')))
            const citations = yield* Effect.forEach(citationInputs, (citation) =>
              Schema.decodeUnknown(Schema.typeSchema(DatasetCitation))(
                citation,
              ).pipe(
                Effect.mapError(() => failure('citation validation')),
              ))
            const resultColumnNames = result.columns.map((column) => column.name)
            const resultSnapshotKeys = result.snapshots.map((snapshot) =>
              `${snapshot.datasetId}:${snapshot.snapshotId}`)
            const citedSnapshotKeys = new Set(citations.map((citation) =>
              `${citation.datasetId}:${citation.datasetSnapshotId}`))
            if (citations.some((citation) =>
              {
                const binding = result.snapshots.find((candidate) =>
                  candidate.datasetId === citation.datasetId
                  && candidate.snapshotId === citation.datasetSnapshotId)
                const selected = citation.selectedColumns.map((name) =>
                  result.columns.filter((column) => column.name === name))
                return citation.queryResultSnapshotId !== result.id
                  || citation.workspaceId !== result.workspaceId
                  || citation.projectId !== result.projectId
                  || citation.resultHash !== result.resultHash
                  || citation.resultArtifactHash !== result.resultArtifactHash
                  || citation.canonicalSql !== result.canonicalSql
                  || binding === undefined
                  || binding.schemaHash !== citation.schemaHash
                  || binding.parquetDigest !== citation.parquetDigest
                  || result.truncated
                  || citation.rowStart !== 0
                  || citation.rowEndExclusive !== result.rows.length
                  || citation.selectedColumns.length !== resultColumnNames.length
                  || citation.selectedColumns.some(
                    (name, index) => name !== resultColumnNames[index],
                  )
                  || selected.some((matches) => matches.length !== 1)
              }
            )
              || citations.length !== result.snapshots.length
              || citedSnapshotKeys.size !== result.snapshots.length
              || resultSnapshotKeys.some((key) => !citedSnapshotKeys.has(key))
            ) {
              return yield* new DatasetQueryEvidenceConflictError({
                entity: 'citation',
                message: 'Dataset citations do not match their immutable result',
              })
            }
            const stored = yield* Effect.tryPromise({
              try: () => sql.transaction(async (transaction) => {
                const inserted = await transaction.unsafe(
                  `INSERT INTO query_result_snapshots (
                     id, workspace_id, project_id, request_hash, protocol_version,
                     engine_version, engine_adapter_version,
                     execution_policy_version, engine_config_hash, canonical_sql,
                     dataset_snapshots, schema_hash, result_hash,
                     result_artifact_hash, columns, rows, row_count, truncated,
                     executed_at, created_at
                   ) VALUES (
                     $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12,
                     $13, $14, $15::jsonb, $16::jsonb, $17, $18,
                     to_timestamp($19 / 1000.0), to_timestamp($20 / 1000.0)
                   )
                   ON CONFLICT (workspace_id, project_id, request_hash)
                   DO NOTHING RETURNING *`,
                  [
                    result.id,
                    result.workspaceId,
                    result.projectId,
                    result.requestHash,
                    result.protocolVersion,
                    result.engineVersion,
                    result.engineAdapterVersion,
                    result.executionPolicyVersion,
                    result.engineConfigHash,
                    result.canonicalSql,
                    JSON.stringify(result.snapshots),
                    result.schemaHash,
                    result.resultHash,
                    result.resultArtifactHash,
                    JSON.stringify(result.columns),
                    JSON.stringify(result.rows),
                    result.rowCount,
                    result.truncated,
                    Number(result.executedAt),
                    Number(result.createdAt),
                  ],
                )
                const rows = inserted.length === 1
                  ? inserted
                  : await selectResult(
                    transaction,
                    result.workspaceId,
                    result.projectId,
                    'request_hash',
                    result.requestHash,
                  )
                if (rows.length !== 1) throw failure('result replay')
                const actualId = rows[0]?.['id']
                for (const citation of citations) {
                  await transaction.unsafe(
                    `INSERT INTO dataset_citations (
                       id, query_result_snapshot_id, workspace_id, project_id,
                       dataset_id, dataset_snapshot_id, schema_hash, result_hash,
                       parquet_digest, result_artifact_hash, canonical_sql,
                       selected_columns, row_start,
                       row_end_exclusive, created_at
                     ) VALUES (
                       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                       $12::jsonb, $13, $14, to_timestamp($15 / 1000.0)
                     )
                     ON CONFLICT (
                       query_result_snapshot_id, dataset_snapshot_id,
                       selected_columns, row_start, row_end_exclusive
                     ) DO NOTHING`,
                    [
                      citation.id,
                      actualId,
                      citation.workspaceId,
                      citation.projectId,
                      citation.datasetId,
                      citation.datasetSnapshotId,
                      citation.schemaHash,
                      citation.resultHash,
                      citation.parquetDigest,
                      citation.resultArtifactHash,
                      citation.canonicalSql,
                      JSON.stringify(citation.selectedColumns),
                      citation.rowStart,
                      citation.rowEndExclusive,
                      Number(citation.createdAt),
                    ],
                  )
                }
                const storedCitations = await transaction.unsafe(
                  `SELECT * FROM dataset_citations
                   WHERE query_result_snapshot_id = $1
                   ORDER BY row_start, row_end_exclusive, id`,
                  [actualId],
                )
                return { result: rows[0], citations: storedCitations }
              }),
              catch: (cause) =>
                cause instanceof DatasetQueryEvidencePersistenceError
                  ? cause
                  : failure('record'),
            })
            const decoded = yield* decodeResult(stored.result)
            if (!sameResult(decoded, result)) {
              return yield* new DatasetQueryEvidenceConflictError({
                entity: 'result',
                message: 'Query request replay does not match its stored result',
              })
            }
            const decodedCitations = yield* Effect.forEach(
              stored.citations,
              decodeCitation,
            )
            const requestedCitations = yield* Effect.forEach(
              citations,
              (requested) => {
                const match = decodedCitations.find((candidate) =>
                  candidate.workspaceId === requested.workspaceId
                  && candidate.projectId === requested.projectId
                  && candidate.datasetId === requested.datasetId
                  && candidate.datasetSnapshotId === requested.datasetSnapshotId
                  && candidate.schemaHash === requested.schemaHash
                  && candidate.parquetDigest === requested.parquetDigest
                  && candidate.resultHash === requested.resultHash
                  && candidate.resultArtifactHash
                    === requested.resultArtifactHash
                  && candidate.canonicalSql === requested.canonicalSql
                  && candidate.rowStart === requested.rowStart
                  && candidate.rowEndExclusive === requested.rowEndExclusive
                  && candidate.selectedColumns.length
                    === requested.selectedColumns.length
                  && candidate.selectedColumns.every(
                    (name, index) => name === requested.selectedColumns[index],
                  ))
                return match === undefined
                  ? Effect.fail(failure('citation replay'))
                  : Effect.succeed(match)
              },
            )
            return { result: decoded, citations: requestedCitations }
          },
        )

        const reopen = Effect.fn('DatasetQueryEvidenceRepo.reopen')(
          function* (
            workspaceId: typeof WorkspaceId.Type,
            projectId: typeof ProjectId.Type,
            citationId: typeof DatasetCitationId.Type,
          ) {
            const rows = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `SELECT citation.*, result.dataset_snapshots,
                        result.columns AS result_columns,
                        result.rows AS result_rows, result.request_hash,
                        result.protocol_version,
                        result.engine_version, result.engine_adapter_version,
                        result.execution_policy_version,
                        result.engine_config_hash,
                        result.schema_hash AS result_schema_hash,
                        result.result_hash AS stored_result_hash,
                        result.result_artifact_hash AS stored_result_artifact_hash,
                        result.row_count, result.truncated,
                        result.executed_at, result.created_at AS result_created_at
                 FROM dataset_citations citation
                 JOIN query_result_snapshots result
                   ON result.id = citation.query_result_snapshot_id
                  AND result.workspace_id = citation.workspace_id
                  AND result.project_id = citation.project_id
                 WHERE citation.id = $1 AND citation.workspace_id = $2
                   AND citation.project_id = $3`,
                [citationId, workspaceId, projectId],
              ),
              catch: () => failure('citation reopen'),
            })
            if (rows.length !== 1) {
              return yield* new DatasetQueryEvidenceScopeError({
                entity: 'citation',
                id: citationId,
                message: 'Dataset citation was not found in this scope',
              })
            }
            const row = rows[0]!
            const citation = yield* decodeCitation(row)
            const snapshot = yield* Schema.decodeUnknown(QueryResultSnapshot)({
              id: row['query_result_snapshot_id'],
              workspaceId: row['workspace_id'],
              projectId: row['project_id'],
              requestHash: row['request_hash'],
              protocolVersion: row['protocol_version'],
              engineVersion: row['engine_version'],
              engineAdapterVersion: row['engine_adapter_version'],
              executionPolicyVersion: row['execution_policy_version'],
              engineConfigHash: row['engine_config_hash'],
              canonicalSql: row['canonical_sql'],
              snapshots: jsonValue(row['dataset_snapshots']),
              schemaHash: row['result_schema_hash'],
              resultHash: row['stored_result_hash'],
              resultArtifactHash: row['stored_result_artifact_hash'],
              columns: jsonValue(row['result_columns']),
              rows: jsonValue(row['result_rows']),
              rowCount: row['row_count'],
              truncated: row['truncated'],
              executedAt: row['executed_at'] instanceof Date
                ? row['executed_at'].getTime()
                : row['executed_at'],
              createdAt: row['result_created_at'] instanceof Date
                ? row['result_created_at'].getTime()
                : row['result_created_at'],
            }).pipe(Effect.mapError(() => failure('citation result decode')))
            const snapshotRef = snapshot.snapshots.find((candidate) =>
              candidate.datasetId === citation.datasetId
              && candidate.snapshotId === citation.datasetSnapshotId)
            const selectedMatches = citation.selectedColumns.map((name) =>
              snapshot.columns.filter((column) => column.name === name))
            const selected = selectedMatches.map((matches) => matches[0])
            if (
              snapshotRef === undefined
              || snapshotRef.schemaHash !== citation.schemaHash
              || snapshotRef.parquetDigest !== citation.parquetDigest
              || snapshot.resultHash !== citation.resultHash
              || snapshot.resultArtifactHash !== citation.resultArtifactHash
              || snapshot.canonicalSql !== citation.canonicalSql
              || selectedMatches.some((matches) => matches.length !== 1)
              || citation.rowEndExclusive > snapshot.rows.length
              || snapshot.truncated
            ) {
              return yield* new DatasetCitationValidationError({
                citationId,
                reason: 'immutable-evidence-mismatch',
                message: 'Dataset citation no longer matches its immutable evidence',
              })
            }
            const columns = selected.filter(
              (column): column is NonNullable<typeof column> =>
                column !== undefined,
            )
            const rowsForCitation = snapshot.rows
              .slice(citation.rowStart, citation.rowEndExclusive)
              .map((row) => columns.map((column) => row[column.ordinal] ?? null))
            return yield* Schema.decodeUnknown(
              Schema.typeSchema(DatasetCitationEvidence),
            )({
              citation,
              snapshot,
              columns,
              rows: rowsForCitation,
            }).pipe(Effect.mapError(() =>
              new DatasetCitationValidationError({
                citationId,
                reason: 'invalid-evidence-range',
                message: 'Dataset citation evidence is invalid',
              })))
          },
        )

        const history = Effect.fn('DatasetQueryEvidenceRepo.history')(
          function* (
            workspaceId: typeof WorkspaceId.Type,
            projectId: typeof ProjectId.Type,
            limit: number,
          ) {
            if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
              return yield* failure('history validation')
            }
            const rows = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `SELECT id, workspace_id, project_id, request_hash,
                        protocol_version, engine_version,
                        engine_adapter_version, execution_policy_version,
                        engine_config_hash, canonical_sql, dataset_snapshots,
                        schema_hash, result_hash, result_artifact_hash, row_count,
                        truncated, executed_at, created_at
                 FROM query_result_snapshots
                 WHERE workspace_id = $1 AND project_id = $2
                 ORDER BY created_at DESC, id DESC LIMIT $3`,
                [workspaceId, projectId, limit],
              ),
              catch: () => failure('history'),
            })
            return yield* Effect.forEach(rows, decodeHistory)
          },
        )

        return { record, reopen, history }
      }),
    },
  ) {}
