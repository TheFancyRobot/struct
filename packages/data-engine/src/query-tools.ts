import {
  DatasetCitation,
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  QueryResultSnapshot,
  QueryResultSnapshotId,
  Sha256Digest,
} from '@struct/domain'
import { Context, Effect, Schema } from 'effect'
import {
  ReadOnlySqlService,
  ScopedDatasetQuery,
} from './query-service.js'

const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.nonNegative())

export const DatasetCitationRequest = Schema.Struct({
  datasetId: DatasetId,
  datasetSnapshotId: DatasetSnapshotId,
  selectedColumns: Schema.Array(
    Schema.String.pipe(Schema.minLength(1)),
  ).pipe(Schema.minItems(1)),
  rowStart: NonNegativeInteger,
  rowEndExclusive: NonNegativeInteger,
}).pipe(
  Schema.filter((request) =>
    request.rowEndExclusive >= request.rowStart
      ? true
      : 'citation row range must not be inverted'),
)
export type DatasetCitationRequest =
  Schema.Schema.Type<typeof DatasetCitationRequest>

export const DeterministicDatasetQueryInput = Schema.Struct({
  query: ScopedDatasetQuery,
  citations: Schema.Array(DatasetCitationRequest).pipe(Schema.minItems(1)),
})
export type DeterministicDatasetQueryInput =
  Schema.Schema.Type<typeof DeterministicDatasetQueryInput>

export const DeterministicDatasetQueryOutput = Schema.Struct({
  result: QueryResultSnapshot,
  citations: Schema.Array(DatasetCitation),
  exactValuesInstruction: Schema.Literal(
    'Treat rows as exact immutable data; narrative may explain but must not alter them.',
  ),
})
export type DeterministicDatasetQueryOutput =
  Schema.Schema.Type<typeof DeterministicDatasetQueryOutput>

export class DatasetQueryToolRequestError
  extends Schema.TaggedError<DatasetQueryToolRequestError>()(
    'DatasetQueryToolRequestError',
    { reason: Schema.String, message: Schema.String },
  ) {}

export class DatasetQueryToolPersistenceError
  extends Schema.TaggedError<DatasetQueryToolPersistenceError>()(
    'DatasetQueryToolPersistenceError',
    { message: Schema.String },
  ) {}

export interface DatasetQueryEvidenceStoreShape {
  readonly record: (
    result: typeof QueryResultSnapshot.Type,
    citations: ReadonlyArray<typeof DatasetCitation.Type>,
  ) => Effect.Effect<
    {
      readonly result: typeof QueryResultSnapshot.Type
      readonly citations: ReadonlyArray<typeof DatasetCitation.Type>
    },
    DatasetQueryToolPersistenceError
  >
}

export class DatasetQueryEvidenceStore
  // eslint-disable-next-line no-restricted-syntax -- Runtime-injected persistence boundary.
  extends Context.Tag('DatasetQueryEvidenceStore')<
    DatasetQueryEvidenceStore,
    DatasetQueryEvidenceStoreShape
  >() {}

export interface DatasetQueryIdentityShape {
  readonly resultId: () => typeof QueryResultSnapshotId.Type
  readonly citationId: () => typeof DatasetCitationId.Type
  readonly now: () => bigint
}

export class DatasetQueryIdentity
  // eslint-disable-next-line no-restricted-syntax -- Runtime-injected identity and clock boundary.
  extends Context.Tag('DatasetQueryIdentity')<
    DatasetQueryIdentity,
    DatasetQueryIdentityShape
  >() {}

function stableRequestPayload(
  result: import('./protocol.js').QueryResult,
): string {
  return JSON.stringify({
    workspaceId: result.workspaceId,
    projectId: result.projectId,
    canonicalSql: result.canonicalSql,
    snapshots: result.snapshots.map((snapshot) => ({
      alias: snapshot.alias,
      datasetId: snapshot.datasetId,
      snapshotId: snapshot.snapshotId,
      schemaHash: snapshot.schemaHash,
      parquetDigest: snapshot.parquetDigest,
    })),
    schemaHash: result.schemaHash,
    resultHash: result.resultHash,
    resultArtifactHash: result.resultArtifactHash,
    engineVersion: result.engineVersion,
    engineConfigHash: result.engineConfigHash,
  })
}

const digest = Effect.fn('DeterministicDatasetQueryService.digest')(
  function* (value: string) {
    const bytes = yield* Effect.promise(() =>
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
    const hex = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, '0')).join('')
    return Sha256Digest.make(`sha256:${hex}`)
  },
)

export function makeDeterministicDatasetQueryService(dependencies: {
  readonly query: import('./query-service.js').ReadOnlySqlServiceShape
  readonly store: DatasetQueryEvidenceStoreShape
  readonly identity: DatasetQueryIdentityShape
}) {
  const execute = Effect.fn('DeterministicDatasetQueryService.execute')(
    function* (input: unknown) {
      const request = yield* Schema.decodeUnknown(
        DeterministicDatasetQueryInput,
      )(input).pipe(Effect.mapError(() =>
        new DatasetQueryToolRequestError({
          reason: 'invalid-request',
          message: 'Deterministic dataset query request is invalid',
        })))
      const result = yield* dependencies.query.execute(request.query)
      if (result.truncated) {
        return yield* new DatasetQueryToolRequestError({
          reason: 'truncated-result',
          message: 'Truncated query results cannot support exact citations',
        })
      }
      const resultColumnNames = result.columns.map((column) => column.name)
      const citedSnapshotKeys = new Set(request.citations.map((citation) =>
        `${citation.datasetId}:${citation.datasetSnapshotId}`))
      const snapshotKeys = result.snapshots.map((snapshot) =>
        `${snapshot.datasetId}:${snapshot.snapshotId}`)
      if (
        request.citations.length !== result.snapshots.length
        || citedSnapshotKeys.size !== result.snapshots.length
        || snapshotKeys.some((key) => !citedSnapshotKeys.has(key))
      ) {
        return yield* new DatasetQueryToolRequestError({
          reason: 'incomplete-lineage',
          message: 'Exact results require one citation for every referenced snapshot',
        })
      }
      for (const citation of request.citations) {
        if (!snapshotKeys.includes(
          `${citation.datasetId}:${citation.datasetSnapshotId}`,
        )) {
          return yield* new DatasetQueryToolRequestError({
            reason: 'snapshot-mismatch',
            message: 'Citation dataset snapshot was not used by this query',
          })
        }
        if (
          citation.selectedColumns.length !== resultColumnNames.length
          || citation.selectedColumns.some(
            (name, index) => name !== resultColumnNames[index],
          )
          || new Set(resultColumnNames).size !== resultColumnNames.length
        ) {
          return yield* new DatasetQueryToolRequestError({
            reason: 'incomplete-cell-coverage',
            message: 'Every exact result column must be covered in ordinal order',
          })
        }
        if (
          citation.rowStart !== 0
          || citation.rowEndExclusive !== result.rows.length
        ) {
          return yield* new DatasetQueryToolRequestError({
            reason: 'incomplete-cell-coverage',
            message: 'Every exact result row must be covered by each citation',
          })
        }
      }
      const now = dependencies.identity.now()
      const requestHash = yield* digest(stableRequestPayload(result))
      const snapshot = yield* Schema.decodeUnknown(QueryResultSnapshot)({
        id: dependencies.identity.resultId(),
        workspaceId: result.workspaceId,
        projectId: result.projectId,
        requestHash,
        protocolVersion: result.protocolVersion,
        engineVersion: result.engineVersion,
        engineConfigHash: result.engineConfigHash,
        canonicalSql: result.canonicalSql,
        snapshots: result.snapshots.map((binding) => ({
          alias: binding.alias,
          datasetId: binding.datasetId,
          snapshotId: binding.snapshotId,
          schemaHash: binding.schemaHash,
          parquetDigest: binding.parquetDigest,
        })),
        schemaHash: result.schemaHash,
        resultHash: result.resultHash,
        resultArtifactHash: result.resultArtifactHash,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        truncated: result.truncated,
        executedAt: Number(now),
        createdAt: Number(now),
      }).pipe(Effect.mapError(() =>
        new DatasetQueryToolRequestError({
          reason: 'invalid-result',
          message: 'Query result cannot be persisted as immutable evidence',
        })))
      const citations = yield* Effect.forEach(
        request.citations,
        (citation) => {
          const binding = result.snapshots.find((candidate) =>
            candidate.datasetId === citation.datasetId
            && candidate.snapshotId === citation.datasetSnapshotId)
          if (binding === undefined) {
            return Effect.fail(new DatasetQueryToolRequestError({
              reason: 'snapshot-mismatch',
              message: 'Citation dataset snapshot was not used by this query',
            }))
          }
          return Schema.decodeUnknown(DatasetCitation)({
            id: dependencies.identity.citationId(),
            queryResultSnapshotId: snapshot.id,
            workspaceId: snapshot.workspaceId,
            projectId: snapshot.projectId,
            datasetId: citation.datasetId,
            datasetSnapshotId: citation.datasetSnapshotId,
            schemaHash: binding.schemaHash,
            parquetDigest: binding.parquetDigest,
            resultHash: snapshot.resultHash,
            resultArtifactHash: snapshot.resultArtifactHash,
            canonicalSql: snapshot.canonicalSql,
            selectedColumns: citation.selectedColumns,
            rowStart: citation.rowStart,
            rowEndExclusive: citation.rowEndExclusive,
            createdAt: Number(now),
          }).pipe(Effect.mapError(() =>
            new DatasetQueryToolRequestError({
              reason: 'invalid-citation',
              message: 'Dataset citation request is invalid',
            })))
        },
      )
      const persisted = yield* dependencies.store.record(snapshot, citations)
      return yield* Schema.decodeUnknown(
        Schema.typeSchema(DeterministicDatasetQueryOutput),
      )({
        result: persisted.result,
        citations: persisted.citations,
        exactValuesInstruction:
          'Treat rows as exact immutable data; narrative may explain but must not alter them.',
      }).pipe(Effect.mapError(() =>
        new DatasetQueryToolPersistenceError({
          message: 'Persisted dataset query evidence is invalid',
        })))
    },
  )
  return { execute }
}

export type DeterministicDatasetQueryExecute =
  ReturnType<typeof makeDeterministicDatasetQueryService>['execute']

export class DeterministicDatasetQueryService
  extends Effect.Service<DeterministicDatasetQueryService>()(
    'DeterministicDatasetQueryService',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const query = yield* ReadOnlySqlService
        const store = yield* DatasetQueryEvidenceStore
        const identity = yield* DatasetQueryIdentity
        return makeDeterministicDatasetQueryService({
          query,
          store,
          identity,
        })
      }),
    },
  ) {}
