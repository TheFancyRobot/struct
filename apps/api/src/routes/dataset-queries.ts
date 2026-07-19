import {
  DatasetCitationEvidence,
  DatasetCitationId,
  DatasetQueryHistoryItem,
  ProjectId,
  WorkspaceId,
} from '@struct/domain'
import {
  DeterministicDatasetQueryInput,
  DeterministicDatasetQueryOutput,
  DatasetQueryAuthenticationError,
  DatasetQueryAuthorizationError,
  DatasetQueryEvidenceStore,
  DatasetQueryToolPersistenceError,
} from '@struct/data-engine'
import {
  DatasetQueryEvidenceRepo,
} from '@struct/persistence'
import { Cause, Effect, Layer, Option, Schema } from 'effect'

const DatasetQueryHistoryLimit = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.between(1, 100),
)

export const runDatasetQuery = Effect.fn('runDatasetQuery')(
  function* (
    input: unknown,
    execute: import('@struct/data-engine').DeterministicDatasetQueryExecute,
  ) {
    const decoded = yield* Schema.decodeUnknown(
      DeterministicDatasetQueryInput,
    )(input)
    return yield* execute(decoded).pipe(
      Effect.flatMap(Schema.decodeUnknown(
        Schema.typeSchema(DeterministicDatasetQueryOutput),
      )),
    )
  },
)

export const reopenDatasetCitation = Effect.fn('reopenDatasetCitation')(
  function* (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    citationId: typeof DatasetCitationId.Type,
  ) {
    return yield* DatasetQueryEvidenceRepo.reopen(
      workspaceId,
      projectId,
      citationId,
    ).pipe(Effect.flatMap(Schema.decodeUnknown(
      Schema.typeSchema(DatasetCitationEvidence),
    )))
  },
)

export const listDatasetQueryHistory = Effect.fn('listDatasetQueryHistory')(
  function* (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    limit = 25,
  ) {
    return yield* DatasetQueryEvidenceRepo.history(
      workspaceId,
      projectId,
      limit,
    ).pipe(
      Effect.flatMap(Schema.decodeUnknown(
        Schema.Array(Schema.typeSchema(DatasetQueryHistoryItem)),
      )),
    )
  },
)

function mapStoreError(
  _error: import('@struct/persistence').DatasetQueryEvidenceError,
): DatasetQueryToolPersistenceError {
  return new DatasetQueryToolPersistenceError({
    message: 'Dataset query evidence could not be persisted',
  })
}

export const datasetQueryEvidenceStoreLayer = Layer.effect(
  DatasetQueryEvidenceStore,
  Effect.gen(function* () {
    const repo = yield* DatasetQueryEvidenceRepo
    return {
      record: (result, citations) =>
        repo.record(result, citations).pipe(Effect.mapError(mapStoreError)),
    }
  }),
)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function failureTag(cause: Cause.Cause<unknown>): {
  readonly tag: string
  readonly operation: string
} {
  const failure = Option.getOrUndefined(Cause.failureOption(cause))
  if (typeof failure !== 'object' || failure === null) {
    return { tag: '', operation: '' }
  }
  return {
    tag: '_tag' in failure ? String(failure._tag) : '',
    operation: 'operation' in failure ? String(failure.operation) : '',
  }
}

function bearerCredential(request: Request) {
  const authorization = request.headers.get('authorization')
  if (
    authorization === null
    || !authorization.startsWith('Bearer ')
    || authorization.length <= 'Bearer '.length
  ) {
    return Effect.fail(new DatasetQueryAuthenticationError({
      message: 'A bearer credential is required',
    }))
  }
  return Effect.succeed(authorization.slice('Bearer '.length))
}

export const datasetQueryHistoryResponse = Effect.fn(
  'datasetQueryHistoryResponse',
)(function* (
  request: Request,
  url: URL,
  rawProjectId: string,
  authorize: DatasetQueryReadRouteDependencies['authorize'],
  list: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    limit: number,
  ) => Effect.Effect<
    ReadonlyArray<typeof DatasetQueryHistoryItem.Type>,
    unknown
  >,
) {
  const program = Effect.gen(function* () {
    const workspaceId = yield* Schema.decodeUnknown(WorkspaceId)(
      url.searchParams.get('workspaceId'),
    )
    const projectId = yield* Schema.decodeUnknown(ProjectId)(rawProjectId)
    const rawLimit = url.searchParams.get('limit')
    const limit = rawLimit === null
      ? 25
      : yield* Schema.decodeUnknown(DatasetQueryHistoryLimit)(rawLimit)
    const credential = yield* bearerCredential(request)
    yield* authorize(credential, workspaceId, projectId)
    const history = yield* list(workspaceId, projectId, limit)
    return yield* Schema.encode(Schema.Array(DatasetQueryHistoryItem))(history)
  })
  return yield* Effect.matchCause(program, {
    onFailure: (cause) => {
      const failure = failureTag(cause)
      return failure.tag === 'DatasetQueryAuthenticationError'
        ? json({ error: 'DatasetQueryAuthenticationRequired' }, 401)
        : failure.tag === 'DatasetQueryAuthorizationError'
          ? json({ error: 'DatasetQueryScopeForbidden' }, 403)
          : failure.tag === 'DatasetQueryEvidenceScopeError'
        ? json({ error: 'DatasetQueryHistoryNotFound' }, 404)
        : failure.tag === 'ParseError'
          || (
            failure.tag === 'DatasetQueryEvidencePersistenceError'
            && failure.operation === 'history validation'
          )
          ? json({ error: 'InvalidDatasetQueryHistoryRequest' }, 400)
          : json({ error: 'DatasetQueryHistoryUnavailable' }, 503)
    },
    onSuccess: (history) => json(history),
  })
})

export const datasetCitationResponse = Effect.fn('datasetCitationResponse')(
  function* (
    request: Request,
    url: URL,
    rawProjectId: string,
    rawCitationId: string,
    authorize: DatasetQueryReadRouteDependencies['authorize'],
    reopen: (
      workspaceId: typeof WorkspaceId.Type,
      projectId: typeof ProjectId.Type,
      citationId: typeof DatasetCitationId.Type,
    ) => Effect.Effect<
      typeof DatasetCitationEvidence.Type,
      unknown
    >,
  ) {
    const program = Effect.gen(function* () {
      const workspaceId = yield* Schema.decodeUnknown(WorkspaceId)(
        url.searchParams.get('workspaceId'),
      )
      const projectId = yield* Schema.decodeUnknown(ProjectId)(rawProjectId)
      const citationId = yield* Schema.decodeUnknown(DatasetCitationId)(
        rawCitationId,
      )
      const credential = yield* bearerCredential(request)
      yield* authorize(credential, workspaceId, projectId)
      const evidence = yield* reopen(workspaceId, projectId, citationId)
      return yield* Schema.encode(DatasetCitationEvidence)(evidence)
    })
    return yield* Effect.matchCause(program, {
      onFailure: (cause) => {
        const failure = failureTag(cause)
        return failure.tag === 'DatasetQueryAuthenticationError'
          ? json({ error: 'DatasetQueryAuthenticationRequired' }, 401)
          : failure.tag === 'DatasetQueryAuthorizationError'
            ? json({ error: 'DatasetQueryScopeForbidden' }, 403)
            : failure.tag === 'DatasetQueryEvidenceScopeError'
          ? json({ error: 'DatasetCitationNotFound' }, 404)
          : failure.tag === 'ParseError'
            ? json({ error: 'InvalidDatasetCitationRequest' }, 400)
            : failure.tag === 'DatasetCitationValidationError'
              ? json({ error: 'DatasetCitationInvalid' }, 409)
              : json({ error: 'DatasetCitationUnavailable' }, 503)
      },
      onSuccess: (evidence) => json(evidence),
    })
  },
)

export interface DatasetQueryReadRouteDependencies {
  readonly authorize: (
    credential: string,
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
  ) => Effect.Effect<
    void,
    DatasetQueryAuthenticationError | DatasetQueryAuthorizationError
  >
  readonly list: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    limit: number,
  ) => Effect.Effect<
    ReadonlyArray<typeof DatasetQueryHistoryItem.Type>,
    unknown
  >
  readonly reopen: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    citationId: typeof DatasetCitationId.Type,
  ) => Effect.Effect<typeof DatasetCitationEvidence.Type, unknown>
}

export const datasetQueryReadRoute = Effect.fn('datasetQueryReadRoute')(
  function* (
    request: Request,
    dependencies: DatasetQueryReadRouteDependencies,
  ) {
    if (request.method !== 'GET') return undefined
    const url = new URL(request.url)
    const history =
      /^\/api\/projects\/([^/]+)\/dataset-queries$/.exec(url.pathname)
    if (history !== null) {
      return yield* datasetQueryHistoryResponse(
        request,
        url,
        history[1] ?? '',
        dependencies.authorize,
        dependencies.list,
      )
    }
    const citation =
      /^\/api\/projects\/([^/]+)\/dataset-citations\/([^/]+)$/
        .exec(url.pathname)
    if (citation !== null) {
      return yield* datasetCitationResponse(
        request,
        url,
        citation[1] ?? '',
        citation[2] ?? '',
        dependencies.authorize,
        dependencies.reopen,
      )
    }
    return undefined
  },
)
