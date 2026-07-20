import { Effect, Option, ParseResult, Schema } from 'effect'
import {
  DatasetAsset,
  DatasetFieldSchema,
  DatasetId,
  DatasetSchemaFamily,
  DatasetSchemaFamilyId,
  DatasetSnapshot,
  DatasetSnapshotId,
  ProjectId,
  ResearchSourceScope,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClient } from '../sql-client.js'

const DateToNumber = Schema.transformOrFail(Schema.DateFromSelf, Schema.Number, {
  decode: (date) => ParseResult.succeed(date.getTime()),
  encode: (milliseconds) => ParseResult.succeed(new Date(milliseconds)),
})
const NonNegativeInteger = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.nonNegative(),
)
const PositiveInteger = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.positive(),
)

const DatasetAssetRow = Schema.Struct({
  id: DatasetId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  name: Schema.String,
  lifecycle_status: Schema.Literal('active', 'archived'),
  created_at: DateToNumber,
})
const DatasetSchemaFamilyRow = Schema.Struct({
  id: DatasetSchemaFamilyId,
  dataset_id: DatasetId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  schema_hash: Sha256Digest,
  created_at: DateToNumber,
})
const DatasetFieldRow = Schema.Struct({
  ordinal: NonNegativeInteger,
  name: Schema.String,
  source_type: Schema.String,
  logical_type: Schema.Literal(
    'boolean',
    'integer',
    'decimal',
    'string',
    'date',
    'timestamp',
    'json',
  ),
  nullable: Schema.Boolean,
})
const DatasetSnapshotRow = Schema.Struct({
  id: DatasetSnapshotId,
  dataset_id: DatasetId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  version: PositiveInteger,
  schema_family_id: DatasetSchemaFamilyId,
  previous_snapshot_id: Schema.NullOr(DatasetSnapshotId),
  content_hash: Sha256Digest,
  created_at: DateToNumber,
})
const DatasetSnapshotSourceRow = Schema.Struct({
  ordinal: NonNegativeInteger,
  source_id: SourceId,
  source_version_id: SourceVersionId,
  content_hash: Sha256Digest,
})
const ResearchScopeSourceRow = Schema.Struct({
  source_version_id: SourceVersionId,
  kind: Schema.Literal('document', 'dataset', 'directory', 'file'),
  ordinal: PositiveInteger,
})
const ResearchDatasetScopeRow = Schema.Struct({
  dataset_id: DatasetId,
  dataset_snapshot_id: DatasetSnapshotId,
  source_version_ids: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
})

export class DatasetCatalogScopeError
  extends Schema.TaggedError<DatasetCatalogScopeError>()('DatasetCatalogScopeError', {
    entity: Schema.Literal('dataset', 'schema-family', 'snapshot', 'source-version'),
    id: Schema.String,
    message: Schema.String,
  }) {}

export class DatasetCatalogConflictError
  extends Schema.TaggedError<DatasetCatalogConflictError>()('DatasetCatalogConflictError', {
    entity: Schema.Literal('dataset', 'schema-family', 'snapshot'),
    field: Schema.String,
    message: Schema.String,
  }) {}

export class DatasetCatalogDecodeError
  extends Schema.TaggedError<DatasetCatalogDecodeError>()('DatasetCatalogDecodeError', {
    entity: Schema.Literal('dataset', 'schema-family', 'snapshot'),
    message: Schema.String,
  }) {}

export class DatasetCatalogQueryError
  extends Schema.TaggedError<DatasetCatalogQueryError>()('DatasetCatalogQueryError', {
    operation: Schema.String,
    message: Schema.String,
  }) {}

export type DatasetCatalogError =
  | DatasetCatalogScopeError
  | DatasetCatalogConflictError
  | DatasetCatalogDecodeError
  | DatasetCatalogQueryError

export interface CatalogWriteResult<A> {
  readonly value: A
  readonly replayed: boolean
}

function queryError(operation: string): DatasetCatalogQueryError {
  return new DatasetCatalogQueryError({
    operation,
    message: `Dataset catalog ${operation} failed`,
  })
}

function decodeError(
  entity: 'dataset' | 'schema-family' | 'snapshot',
): DatasetCatalogDecodeError {
  return new DatasetCatalogDecodeError({
    entity,
    message: `Stored ${entity} did not match its catalog contract`,
  })
}

function decodeDataset(row: unknown) {
  return Schema.decodeUnknown(DatasetAssetRow)(row).pipe(
    Effect.flatMap((decoded) => Schema.decodeUnknown(DatasetAsset)({
      id: decoded.id,
      workspaceId: decoded.workspace_id,
      projectId: decoded.project_id,
      name: decoded.name,
      lifecycleStatus: decoded.lifecycle_status,
      createdAt: decoded.created_at,
    })),
    Effect.mapError(() => decodeError('dataset')),
  )
}

function decodeFamily(
  row: unknown,
  fieldRows: ReadonlyArray<unknown>,
) {
  return Effect.gen(function* () {
    const family = yield* Schema.decodeUnknown(DatasetSchemaFamilyRow)(row)
      .pipe(Effect.mapError(() => decodeError('schema-family')))
    const fields = yield* Effect.forEach(fieldRows, (fieldRow) =>
      Schema.decodeUnknown(DatasetFieldRow)(fieldRow).pipe(
        Effect.flatMap((field) => Schema.decodeUnknown(DatasetFieldSchema)({
          ordinal: field.ordinal,
          name: field.name,
          sourceType: field.source_type,
          logicalType: field.logical_type,
          nullable: field.nullable,
        })),
        Effect.mapError(() => decodeError('schema-family')),
      ))
    return yield* Schema.decodeUnknown(DatasetSchemaFamily)({
      id: family.id,
      datasetId: family.dataset_id,
      workspaceId: family.workspace_id,
      projectId: family.project_id,
      schemaHash: family.schema_hash,
      fields,
      createdAt: family.created_at,
    }).pipe(Effect.mapError(() => decodeError('schema-family')))
  })
}

function decodeSnapshot(
  row: unknown,
  sourceRows: ReadonlyArray<unknown>,
) {
  return Effect.gen(function* () {
    const snapshot = yield* Schema.decodeUnknown(DatasetSnapshotRow)(row)
      .pipe(Effect.mapError(() => decodeError('snapshot')))
    const sources = yield* Effect.forEach(sourceRows, (sourceRow) =>
      Schema.decodeUnknown(DatasetSnapshotSourceRow)(sourceRow).pipe(
        Effect.map((source) => ({
          ordinal: source.ordinal,
          sourceId: source.source_id,
          sourceVersionId: source.source_version_id,
          contentHash: source.content_hash,
        })),
        Effect.mapError(() => decodeError('snapshot')),
      ))
    return yield* Schema.decodeUnknown(DatasetSnapshot)({
      id: snapshot.id,
      datasetId: snapshot.dataset_id,
      workspaceId: snapshot.workspace_id,
      projectId: snapshot.project_id,
      version: snapshot.version,
      schemaFamilyId: snapshot.schema_family_id,
      previousSnapshotId: snapshot.previous_snapshot_id,
      contentHash: snapshot.content_hash,
      sources,
      createdAt: snapshot.created_at,
    }).pipe(Effect.mapError(() => decodeError('snapshot')))
  })
}

function sameDataset(
  left: typeof DatasetAsset.Type,
  right: typeof DatasetAsset.Type,
): boolean {
  return left.id === right.id
    && left.workspaceId === right.workspaceId
    && left.projectId === right.projectId
    && left.name === right.name
    && left.lifecycleStatus === right.lifecycleStatus
    && left.createdAt === right.createdAt
}

function sameFamily(
  left: typeof DatasetSchemaFamily.Type,
  right: typeof DatasetSchemaFamily.Type,
): boolean {
  return left.id === right.id
    && left.datasetId === right.datasetId
    && left.workspaceId === right.workspaceId
    && left.projectId === right.projectId
    && left.schemaHash === right.schemaHash
    && left.createdAt === right.createdAt
    && left.fields.length === right.fields.length
    && left.fields.every((field, index) => {
      const candidate = right.fields[index]
      return candidate !== undefined
        && field.ordinal === candidate.ordinal
        && field.name === candidate.name
        && field.sourceType === candidate.sourceType
        && field.logicalType === candidate.logicalType
        && field.nullable === candidate.nullable
    })
}

function sameSnapshot(
  left: typeof DatasetSnapshot.Type,
  right: typeof DatasetSnapshot.Type,
): boolean {
  return left.id === right.id
    && left.datasetId === right.datasetId
    && left.workspaceId === right.workspaceId
    && left.projectId === right.projectId
    && left.version === right.version
    && left.schemaFamilyId === right.schemaFamilyId
    && Option.getOrNull(left.previousSnapshotId) === Option.getOrNull(right.previousSnapshotId)
    && left.contentHash === right.contentHash
    && left.createdAt === right.createdAt
    && left.sources.length === right.sources.length
    && left.sources.every((source, index) => {
      const candidate = right.sources[index]
      return candidate !== undefined
        && source.ordinal === candidate.ordinal
        && source.sourceId === candidate.sourceId
        && source.sourceVersionId === candidate.sourceVersionId
        && source.contentHash === candidate.contentHash
    })
}

async function loadFamily(
  sql: import('../sql-client.js').SqlExecutorShape,
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
  datasetId: typeof DatasetId.Type,
  familyId: typeof DatasetSchemaFamilyId.Type,
): Promise<readonly [Record<string, unknown>, ReadonlyArray<Record<string, unknown>>] | undefined> {
  const rows = await sql.unsafe(
    `SELECT * FROM dataset_schema_families
     WHERE id = $1 AND dataset_id = $2 AND workspace_id = $3 AND project_id = $4`,
    [familyId, datasetId, workspaceId, projectId],
  )
  if (rows.length !== 1 || rows[0] === undefined) return undefined
  const fields = await sql.unsafe(
    `SELECT ordinal, name, source_type, logical_type, nullable
     FROM dataset_field_schemas WHERE schema_family_id = $1 ORDER BY ordinal`,
    [familyId],
  )
  return [rows[0], fields]
}

async function loadSnapshot(
  sql: import('../sql-client.js').SqlExecutorShape,
  workspaceId: typeof WorkspaceId.Type,
  projectId: typeof ProjectId.Type,
  datasetId: typeof DatasetId.Type,
  snapshotId: typeof DatasetSnapshotId.Type,
): Promise<readonly [Record<string, unknown>, ReadonlyArray<Record<string, unknown>>] | undefined> {
  const rows = await sql.unsafe(
    `SELECT * FROM dataset_snapshots
     WHERE id = $1 AND dataset_id = $2 AND workspace_id = $3 AND project_id = $4`,
    [snapshotId, datasetId, workspaceId, projectId],
  )
  if (rows.length !== 1 || rows[0] === undefined) return undefined
  const sources = await sql.unsafe(
    `SELECT ordinal, source_id, source_version_id, content_hash
     FROM dataset_snapshot_sources WHERE snapshot_id = $1 ORDER BY ordinal`,
    [snapshotId],
  )
  return [rows[0], sources]
}

export class DatasetCatalogRepo extends Effect.Service<DatasetCatalogRepo>()(
  'DatasetCatalogRepo',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const createDataset = Effect.fn('DatasetCatalogRepo.createDataset')(
        function* (dataset: typeof DatasetAsset.Type) {
          const result = yield* Effect.tryPromise({
            try: () => sql.transaction(async (transaction) => {
              const inserted = await transaction.unsafe(
                `INSERT INTO dataset_assets (
                   id, workspace_id, project_id, name, lifecycle_status, created_at
                 )
                 SELECT $1, $2, $3, $4, $5, to_timestamp($6 / 1000.0)
                 FROM projects WHERE id = $3 AND workspace_id = $2
                 ON CONFLICT DO NOTHING RETURNING *`,
                [
                  dataset.id,
                  dataset.workspaceId,
                  dataset.projectId,
                  dataset.name,
                  dataset.lifecycleStatus,
                  Number(dataset.createdAt),
                ],
              )
              if (inserted.length === 1) return { rows: inserted, replayed: false }
              const existing = await transaction.unsafe(
                `SELECT * FROM dataset_assets
                 WHERE workspace_id = $2 AND project_id = $3
                   AND (id = $1 OR name = $4)
                 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
                 LIMIT 1`,
                [dataset.id, dataset.workspaceId, dataset.projectId, dataset.name],
              )
              return { rows: existing, replayed: true }
            }),
            catch: () => queryError('dataset creation'),
          })
          const rows = result.rows
          if (rows.length === 0) {
            return yield* new DatasetCatalogScopeError({
              entity: 'dataset',
              id: dataset.id,
              message: 'Dataset project was not found in this workspace',
            })
          }
          const stored = yield* decodeDataset(rows[0])
          if (!sameDataset(stored, dataset)) {
            return yield* new DatasetCatalogConflictError({
              entity: 'dataset',
              field: 'identity',
              message: 'Dataset identity already exists with different immutable metadata',
            })
          }
          return { value: stored, replayed: result.replayed }
        },
      )

      const createSchemaFamily = Effect.fn('DatasetCatalogRepo.createSchemaFamily')(
        function* (family: typeof DatasetSchemaFamily.Type) {
          const result = yield* Effect.tryPromise({
            try: () => sql.transaction(async (transaction) => {
              const inserted = await transaction.unsafe(
                `INSERT INTO dataset_schema_families (
                   id, dataset_id, workspace_id, project_id, schema_hash, created_at
                 )
                 SELECT $1, $2, $3, $4, $5, to_timestamp($6 / 1000.0)
                 FROM dataset_assets
                 WHERE id = $2 AND workspace_id = $3 AND project_id = $4
                 ON CONFLICT DO NOTHING RETURNING *`,
                [
                  family.id,
                  family.datasetId,
                  family.workspaceId,
                  family.projectId,
                  family.schemaHash,
                  Number(family.createdAt),
                ],
              )
              if (inserted.length === 1) {
                for (const field of family.fields) {
                  await transaction.unsafe(
                    `INSERT INTO dataset_field_schemas (
                       schema_family_id, ordinal, name, source_type, logical_type, nullable
                     ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                      family.id,
                      field.ordinal,
                      field.name,
                      field.sourceType,
                      field.logicalType,
                      field.nullable,
                    ],
                  )
                }
                return {
                  storedRows: await loadFamily(
                    transaction,
                    family.workspaceId,
                    family.projectId,
                    family.datasetId,
                    family.id,
                  ),
                  replayed: false,
                }
              }
              const existing = await transaction.unsafe(
                `SELECT id FROM dataset_schema_families
                 WHERE dataset_id = $1 AND workspace_id = $2
                   AND project_id = $3
                   AND (id = $4 OR schema_hash = $5)
                 ORDER BY CASE WHEN id = $4 THEN 0 ELSE 1 END
                 LIMIT 1`,
                [
                  family.datasetId,
                  family.workspaceId,
                  family.projectId,
                  family.id,
                  family.schemaHash,
                ],
              )
              const existingId = yieldId(existing)
              return {
                storedRows: existingId === undefined
                  ? undefined
                  : await loadFamily(
                      transaction,
                      family.workspaceId,
                      family.projectId,
                      family.datasetId,
                      DatasetSchemaFamilyId.make(existingId),
                    ),
                replayed: true,
              }
            }),
            catch: () => queryError('schema-family creation'),
          })
          const storedRows = result.storedRows
          if (storedRows === undefined) {
            return yield* new DatasetCatalogScopeError({
              entity: 'schema-family',
              id: family.id,
              message: 'Dataset was not found in this workspace and project',
            })
          }
          const stored = yield* decodeFamily(storedRows[0], storedRows[1])
          if (!sameFamily(stored, family)) {
            return yield* new DatasetCatalogConflictError({
              entity: 'schema-family',
              field: 'schemaHash',
              message: 'Schema hash already exists with different immutable fields',
            })
          }
          return { value: stored, replayed: result.replayed }
        },
      )

      const createSnapshot = Effect.fn('DatasetCatalogRepo.createSnapshot')(
        function* (snapshot: typeof DatasetSnapshot.Type) {
          const result = yield* Effect.tryPromise({
            try: () => sql.transaction(async (transaction) => {
              if (Option.isSome(snapshot.previousSnapshotId)) {
                const previous = await transaction.unsafe(
                  `SELECT id FROM dataset_snapshots
                   WHERE id = $1 AND dataset_id = $2
                     AND workspace_id = $3 AND project_id = $4
                     AND version = $5`,
                  [
                    snapshot.previousSnapshotId.value,
                    snapshot.datasetId,
                    snapshot.workspaceId,
                    snapshot.projectId,
                    snapshot.version - 1,
                  ],
                )
                if (previous.length !== 1) {
                  throw new DatasetCatalogScopeError({
                    entity: 'snapshot',
                    id: snapshot.previousSnapshotId.value,
                    message: 'Previous snapshot was not found at the preceding version in this scope',
                  })
                }
              }
              const inserted = await transaction.unsafe(
                `INSERT INTO dataset_snapshots (
                   id, dataset_id, workspace_id, project_id, version,
                   schema_family_id, previous_snapshot_id, content_hash, created_at
                 )
                 SELECT $1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0)
                 FROM dataset_schema_families family
                 WHERE family.id = $6 AND family.dataset_id = $2
                   AND family.workspace_id = $3 AND family.project_id = $4
                 ON CONFLICT DO NOTHING RETURNING *`,
                [
                  snapshot.id,
                  snapshot.datasetId,
                  snapshot.workspaceId,
                  snapshot.projectId,
                  snapshot.version,
                  snapshot.schemaFamilyId,
                  Option.getOrNull(snapshot.previousSnapshotId),
                  snapshot.contentHash,
                  Number(snapshot.createdAt),
                ],
              )
              if (inserted.length === 1) {
                for (const source of snapshot.sources) {
                  const lineage = await transaction.unsafe(
                    `INSERT INTO dataset_snapshot_sources (
                       snapshot_id, dataset_id, workspace_id, project_id,
                       ordinal, source_id, source_version_id, content_hash
                     )
                     SELECT $1, $2, $3, $4, $5, version.source_id, version.id,
                            version.content_hash
                     FROM source_versions version
                     JOIN sources source ON source.id = version.source_id
                     JOIN projects project ON project.id = source.project_id
                     WHERE version.id = $6
                       AND version.source_id = $7
                       AND version.content_hash = $8
                       AND source.project_id = $4
                       AND project.workspace_id = $3
                     RETURNING snapshot_id`,
                    [
                      snapshot.id,
                      snapshot.datasetId,
                      snapshot.workspaceId,
                      snapshot.projectId,
                      source.ordinal,
                      source.sourceVersionId,
                      source.sourceId,
                      source.contentHash,
                    ],
                  )
                  if (lineage.length !== 1) {
                    throw new DatasetCatalogScopeError({
                      entity: 'source-version',
                      id: source.sourceVersionId,
                      message: 'Source version lineage was not found in this workspace and project',
                    })
                  }
                }
                return {
                  storedRows: await loadSnapshot(
                    transaction,
                    snapshot.workspaceId,
                    snapshot.projectId,
                    snapshot.datasetId,
                    snapshot.id,
                  ),
                  replayed: false,
                }
              }
              const existing = await transaction.unsafe(
                `SELECT id FROM dataset_snapshots
                 WHERE dataset_id = $1 AND workspace_id = $2
                   AND project_id = $3
                   AND (id = $4 OR version = $5 OR content_hash = $6)
                 ORDER BY CASE
                   WHEN id = $4 THEN 0
                   WHEN version = $5 THEN 1
                   ELSE 2
                 END
                 LIMIT 1`,
                [
                  snapshot.datasetId,
                  snapshot.workspaceId,
                  snapshot.projectId,
                  snapshot.id,
                  snapshot.version,
                  snapshot.contentHash,
                ],
              )
              const existingId = yieldId(existing)
              return {
                storedRows: existingId === undefined
                  ? undefined
                  : await loadSnapshot(
                      transaction,
                      snapshot.workspaceId,
                      snapshot.projectId,
                      snapshot.datasetId,
                      DatasetSnapshotId.make(existingId),
                    ),
                replayed: true,
              }
            }),
            catch: (cause) =>
              cause instanceof DatasetCatalogScopeError
                ? cause
                : queryError('snapshot creation'),
          })
          const storedRows = result.storedRows
          if (storedRows === undefined) {
            return yield* new DatasetCatalogScopeError({
              entity: 'snapshot',
              id: snapshot.id,
              message: 'Dataset or schema family was not found in this workspace and project',
            })
          }
          const stored = yield* decodeSnapshot(storedRows[0], storedRows[1])
          if (!sameSnapshot(stored, snapshot)) {
            return yield* new DatasetCatalogConflictError({
              entity: 'snapshot',
              field: 'version',
              message: 'Dataset version already exists with different immutable metadata',
            })
          }
          return { value: stored, replayed: result.replayed }
        },
      )

      const getSchemaFamily = Effect.fn('DatasetCatalogRepo.getSchemaFamily')(
        function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          datasetId: typeof DatasetId.Type,
          familyId: typeof DatasetSchemaFamilyId.Type,
        ) {
          const loaded = yield* Effect.tryPromise({
            try: () => loadFamily(sql, workspaceId, projectId, datasetId, familyId),
            catch: () => queryError('schema-family lookup'),
          })
          if (loaded === undefined) return Option.none<typeof DatasetSchemaFamily.Type>()
          return Option.some(yield* decodeFamily(loaded[0], loaded[1]))
        },
      )

      const listSnapshots = Effect.fn('DatasetCatalogRepo.listSnapshots')(
        function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          datasetId: typeof DatasetId.Type,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT * FROM dataset_snapshots
               WHERE dataset_id = $1 AND workspace_id = $2 AND project_id = $3
               ORDER BY version`,
              [datasetId, workspaceId, projectId],
            ),
            catch: () => queryError('snapshot listing'),
          })
          return yield* Effect.forEach(rows, (row) =>
            Effect.gen(function* () {
              const decoded = yield* Schema.decodeUnknown(DatasetSnapshotRow)(row)
                .pipe(Effect.mapError(() => decodeError('snapshot')))
              const loaded = yield* Effect.tryPromise({
                try: () => loadSnapshot(
                  sql,
                  workspaceId,
                  projectId,
                  datasetId,
                  decoded.id,
                ),
                catch: () => queryError('snapshot lineage listing'),
              })
              if (loaded === undefined) return yield* decodeError('snapshot')
              return yield* decodeSnapshot(loaded[0], loaded[1])
            }))
        },
      )

      const resolveResearchSourceScopes = Effect.fn(
        'DatasetCatalogRepo.resolveResearchSourceScopes',
      )(function* (
        workspaceId: typeof WorkspaceId.Type,
        projectId: typeof ProjectId.Type,
        sourceVersionIds: ReadonlyArray<typeof SourceVersionId.Type>,
      ) {
        const loaded = yield* Effect.tryPromise({
          try: () => sql.transaction(async (transaction) => {
            const sources = await transaction.unsafe(
              `SELECT selected.id AS source_version_id,
                      source.kind,
                      selected.ordinality::int AS ordinal
               FROM unnest($3::uuid[]) WITH ORDINALITY selected(id, ordinality)
               JOIN source_versions version ON version.id = selected.id
               JOIN sources source ON source.id = version.source_id
               JOIN projects project ON project.id = source.project_id
               WHERE source.project_id = $2
                 AND project.workspace_id = $1
               ORDER BY selected.ordinality`,
              [workspaceId, projectId, sourceVersionIds],
            )
            const datasets = await transaction.unsafe(
              `WITH fully_covered AS (
                 SELECT snapshot.id,
                        snapshot.dataset_id,
                        snapshot.version
                 FROM dataset_snapshots snapshot
                 JOIN dataset_snapshot_sources selected_source
                   ON selected_source.snapshot_id = snapshot.id
                  AND selected_source.source_version_id = ANY($3::uuid[])
                 WHERE snapshot.workspace_id = $1
                   AND snapshot.project_id = $2
                 GROUP BY snapshot.id, snapshot.dataset_id, snapshot.version
                 HAVING COUNT(*) = (
                   SELECT COUNT(*)
                   FROM dataset_snapshot_sources all_source
                   WHERE all_source.snapshot_id = snapshot.id
                 )
               ),
               latest AS (
                 SELECT DISTINCT ON (dataset_id)
                        id,
                        dataset_id
                 FROM fully_covered
                 ORDER BY dataset_id, version DESC, id DESC
               )
               SELECT latest.dataset_id,
                      latest.id AS dataset_snapshot_id,
                      array_agg(lineage.source_version_id ORDER BY lineage.ordinal)
                        AS source_version_ids
               FROM latest
               JOIN dataset_snapshot_sources lineage
                 ON lineage.snapshot_id = latest.id
               GROUP BY latest.dataset_id, latest.id
               ORDER BY MIN(array_position($3::uuid[], lineage.source_version_id)),
                        latest.dataset_id`,
              [workspaceId, projectId, sourceVersionIds],
            )
            return { sources, datasets }
          }),
          catch: () => queryError('research source-scope resolution'),
        })
        const sourceRows = yield* Effect.forEach(loaded.sources, (row) =>
          Schema.decodeUnknown(ResearchScopeSourceRow)(row).pipe(
            Effect.mapError(() => decodeError('snapshot')),
          ))
        if (sourceRows.length !== sourceVersionIds.length) {
          return yield* new DatasetCatalogScopeError({
            entity: 'source-version',
            id: sourceVersionIds.find((id) =>
              !sourceRows.some((row) => row.source_version_id === id)
            ) ?? 'unknown',
            message: 'Research source version was not found in this workspace and project',
          })
        }
        const datasetRows = yield* Effect.forEach(loaded.datasets, (row) =>
          Schema.decodeUnknown(ResearchDatasetScopeRow)(row).pipe(
            Effect.mapError(() => decodeError('snapshot')),
          ))
        const coveredDatasetVersions = new Set(
          datasetRows.flatMap((row) => row.source_version_ids),
        )
        const unresolvedDataset = sourceRows.find(
          (row) =>
            row.kind === 'dataset'
            && !coveredDatasetVersions.has(row.source_version_id),
        )
        if (unresolvedDataset !== undefined) {
          return yield* new DatasetCatalogScopeError({
            entity: 'source-version',
            id: unresolvedDataset.source_version_id,
            message: 'Dataset source version has no fully materialized snapshot',
          })
        }
        return yield* Effect.forEach([
          ...sourceRows.flatMap((row) =>
            row.kind === 'dataset'
              ? []
              : [{
                  kind: 'document' as const,
                  sourceVersionId: row.source_version_id,
                }]
          ),
          ...datasetRows.map((row) => ({
            kind: 'dataset' as const,
            datasetId: row.dataset_id,
            datasetSnapshotId: row.dataset_snapshot_id,
            sourceVersionIds: row.source_version_ids,
          })),
        ], (scope) =>
          Schema.decodeUnknown(ResearchSourceScope)(scope).pipe(
            Effect.mapError(() => decodeError('snapshot')),
          ))
      })

      return {
        createDataset,
        createSchemaFamily,
        createSnapshot,
        getSchemaFamily,
        listSnapshots,
        resolveResearchSourceScopes,
      }
    }),
  },
) {}

function yieldId(rows: ReadonlyArray<Record<string, unknown>>): string | undefined {
  const value = rows[0]?.['id']
  return typeof value === 'string' ? value : undefined
}
