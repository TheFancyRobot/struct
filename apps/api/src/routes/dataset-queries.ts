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
  DatasetQueryEvidenceStore,
  DatasetQueryToolPersistenceError,
} from '@struct/data-engine'
import {
  DatasetQueryEvidenceRepo,
} from '@struct/persistence'
import { Cause, Effect, Layer, Option, Schema } from 'effect'

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

export const datasetQueryHistoryResponse = Effect.fn(
  'datasetQueryHistoryResponse',
)(function* (
  url: URL,
  rawProjectId: string,
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
    const limit = rawLimit === null ? 25 : Number(rawLimit)
    const history = yield* list(workspaceId, projectId, limit)
    return yield* Schema.encode(Schema.Array(DatasetQueryHistoryItem))(history)
  })
  return yield* Effect.matchCause(program, {
    onFailure: (cause) => {
      const failure = failureTag(cause)
      return failure.tag === 'DatasetQueryEvidenceScopeError'
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
    url: URL,
    rawProjectId: string,
    rawCitationId: string,
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
      const evidence = yield* reopen(workspaceId, projectId, citationId)
      return yield* Schema.encode(DatasetCitationEvidence)(evidence)
    })
    return yield* Effect.matchCause(program, {
      onFailure: (cause) => {
        const failure = failureTag(cause)
        return failure.tag === 'DatasetQueryEvidenceScopeError'
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
        url,
        history[1] ?? '',
        dependencies.list,
      )
    }
    const citation =
      /^\/api\/projects\/([^/]+)\/dataset-citations\/([^/]+)$/
        .exec(url.pathname)
    if (citation !== null) {
      return yield* datasetCitationResponse(
        url,
        citation[1] ?? '',
        citation[2] ?? '',
        dependencies.reopen,
      )
    }
    return undefined
  },
)
