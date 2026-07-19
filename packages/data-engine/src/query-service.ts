import {
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  WorkspaceId,
} from '@struct/domain'
import { Context, Effect, Schema } from 'effect'
import {
  DataEngineClient,
  DataEngineOperationError,
  DataEngineProtocolError,
  DataEngineTransportError,
} from './client.js'
import {
  DATA_ENGINE_PROTOCOL_VERSION,
  QueryRequest,
  type QueryResult,
  type QuerySnapshotBinding,
} from './protocol.js'

const Credential = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(4_096),
)
const QueryAlias = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,62}$/),
)
const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())

const CredentialInput = Schema.Struct({ credential: Credential })

export const ScopedDatasetQuery = Schema.Struct({
  credential: Credential,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sql: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32_768)),
  snapshots: Schema.Array(Schema.Struct({
    alias: QueryAlias,
    datasetId: DatasetId,
    snapshotId: DatasetSnapshotId,
  })).pipe(Schema.minItems(1), Schema.maxItems(8)),
  limits: Schema.Struct({
    maxRows: PositiveInteger,
    maxOutputBytes: PositiveInteger,
    maxMemoryMb: PositiveInteger,
    timeoutMs: PositiveInteger,
  }),
}).pipe(
  Schema.filter((request) => {
    const aliases = new Set(request.snapshots.map((snapshot) => snapshot.alias))
    const snapshots = new Set(
      request.snapshots.map((snapshot) => snapshot.snapshotId),
    )
    return aliases.size === request.snapshots.length
      && snapshots.size === request.snapshots.length
  }),
)
export type ScopedDatasetQuery = Schema.Schema.Type<typeof ScopedDatasetQuery>

export class DatasetQueryAuthenticationError
  extends Schema.TaggedError<DatasetQueryAuthenticationError>()(
    'DatasetQueryAuthenticationError',
    { message: Schema.String },
  ) {}

export class DatasetQueryAuthorizationError
  extends Schema.TaggedError<DatasetQueryAuthorizationError>()(
    'DatasetQueryAuthorizationError',
    { message: Schema.String },
  ) {}

export class DatasetQueryCatalogError
  extends Schema.TaggedError<DatasetQueryCatalogError>()(
    'DatasetQueryCatalogError',
    { message: Schema.String },
  ) {}

export class DatasetQueryRequestError
  extends Schema.TaggedError<DatasetQueryRequestError>()(
    'DatasetQueryRequestError',
    { message: Schema.String },
  ) {}

export interface DatasetQueryPrincipal {
  readonly userId: string
}

export interface DatasetQueryAuthorizationShape {
  readonly authenticate: (
    credential: string,
  ) => Effect.Effect<DatasetQueryPrincipal, DatasetQueryAuthenticationError>
  readonly authorize: (
    principal: DatasetQueryPrincipal,
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
  ) => Effect.Effect<void, DatasetQueryAuthorizationError>
}

export class DatasetQueryAuthorization
  // eslint-disable-next-line no-restricted-syntax -- Runtime-injected user-auth infrastructure boundary.
  extends Context.Tag('DatasetQueryAuthorization')<
    DatasetQueryAuthorization,
    DatasetQueryAuthorizationShape
  >() {}

export interface DatasetQueryCatalogShape {
  readonly resolve: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    snapshots: ScopedDatasetQuery['snapshots'],
  ) => Effect.Effect<
    ReadonlyArray<QuerySnapshotBinding>,
    DatasetQueryCatalogError
  >
}

export class DatasetQueryCatalog
  // eslint-disable-next-line no-restricted-syntax -- Runtime-injected catalog infrastructure boundary.
  extends Context.Tag('DatasetQueryCatalog')<
    DatasetQueryCatalog,
    DatasetQueryCatalogShape
  >() {}

export interface ReadOnlySqlServiceShape {
  readonly execute: (
    input: unknown,
  ) => Effect.Effect<
    QueryResult,
    | DatasetQueryAuthenticationError
    | DatasetQueryAuthorizationError
    | DatasetQueryCatalogError
    | DatasetQueryRequestError
    | DataEngineOperationError
    | DataEngineProtocolError
    | DataEngineTransportError
  >
}

interface DatasetQueryClientShape {
  readonly query: (
    request: typeof QueryRequest.Type,
  ) => Effect.Effect<
    QueryResult,
    | DataEngineOperationError
    | DataEngineProtocolError
    | DataEngineTransportError
  >
}

export function makeReadOnlySqlService(dependencies: {
  readonly authorization: DatasetQueryAuthorizationShape
  readonly catalog: DatasetQueryCatalogShape
  readonly client: DatasetQueryClientShape
}): ReadOnlySqlServiceShape {
  const execute = Effect.fn('ReadOnlySqlService.execute')(
    function* (input: unknown) {
      const credential = yield* Schema.decodeUnknown(CredentialInput)(input)
        .pipe(Effect.mapError(() =>
          new DatasetQueryAuthenticationError({
            message: 'User authentication is required',
          })))
      const principal = yield* dependencies.authorization.authenticate(
        credential.credential,
      )
      const request = yield* Schema.decodeUnknown(ScopedDatasetQuery)(input)
        .pipe(Effect.mapError(() =>
          new DatasetQueryRequestError({
            message: 'Dataset query request is invalid',
          })))
      yield* dependencies.authorization.authorize(
        principal,
        request.workspaceId,
        request.projectId,
      )
      const snapshots = yield* dependencies.catalog.resolve(
        request.workspaceId,
        request.projectId,
        request.snapshots,
      )
      if (
        snapshots.length !== request.snapshots.length
        || snapshots.some((snapshot, index) => {
          const expected = request.snapshots[index]
          return expected === undefined
            || snapshot.alias !== expected.alias
            || snapshot.datasetId !== expected.datasetId
            || snapshot.snapshotId !== expected.snapshotId
        })
      ) {
        return yield* new DataEngineProtocolError({
          message: 'Resolved query snapshots do not match the requested scope',
        })
      }
      const sidecarRequest = yield* Schema.decodeUnknown(QueryRequest)({
        protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
        operation: 'query',
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        sql: request.sql,
        snapshots,
        limits: request.limits,
      }).pipe(Effect.mapError(() =>
        new DataEngineProtocolError({
          message: 'Resolved data-engine query request is invalid',
        })))
      return yield* dependencies.client.query(sidecarRequest)
    },
  )
  return { execute }
}

export class ReadOnlySqlService extends Effect.Service<ReadOnlySqlService>()(
  'ReadOnlySqlService',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const authorization = yield* DatasetQueryAuthorization
      const catalog = yield* DatasetQueryCatalog
      const client = yield* DataEngineClient
      return makeReadOnlySqlService({ authorization, catalog, client })
    }),
  },
) {}
