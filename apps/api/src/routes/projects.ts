import { Cause, Effect, Option, Schema } from 'effect'
import {
  CreateProjectRequest,
  DEFAULT_PROJECT_PAGE_SIZE,
  MAX_PROJECT_PAGE_SIZE,
  ProjectId,
  ProjectListCursor,
  ProjectListPage,
  ProjectSummary,
  WorkspaceId,
} from '@struct/domain'
import {
  EntityNotFoundError,
  ProjectConflictError,
} from '@struct/persistence'

const ProjectListLimit = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.between(1, MAX_PROJECT_PAGE_SIZE),
)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function idempotencyKey(request: Request) {
  return Schema.decodeUnknown(Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(512),
  ))(request.headers.get('idempotency-key'))
}

function summarize(project: {
  readonly id: typeof ProjectId.Type
  readonly name: string
  readonly createdAt: bigint
  readonly updatedAt: bigint
}) {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  } satisfies typeof ProjectSummary.Type
}

export interface ProjectRouteIdentity {
  readonly workspaceId: typeof WorkspaceId.Type
}

export interface ProjectRouteDeps {
  readonly listByWorkspaceId: (
    workspaceId: typeof WorkspaceId.Type,
    options: { readonly limit: number, readonly cursor?: typeof ProjectListCursor.Type | null },
  ) => Effect.Effect<{
    readonly items: ReadonlyArray<{
      readonly id: typeof ProjectId.Type
      readonly workspaceId: typeof WorkspaceId.Type
      readonly name: string
      readonly createdAt: bigint
      readonly updatedAt: bigint
    }>
    readonly nextCursor: typeof ProjectListCursor.Type | null
  }, unknown>
  readonly createWithIdempotency: (input: {
    readonly project: {
      readonly id: typeof ProjectId.Type
      readonly workspaceId: typeof WorkspaceId.Type
      readonly name: string
      readonly createdAt: bigint
      readonly updatedAt: bigint
    }
    readonly idempotencyKey: string
  }) => Effect.Effect<{
    readonly id: typeof ProjectId.Type
    readonly workspaceId: typeof WorkspaceId.Type
    readonly name: string
    readonly createdAt: bigint
    readonly updatedAt: bigint
  }, unknown>
  readonly findById: (projectId: typeof ProjectId.Type) => Effect.Effect<{
    readonly id: typeof ProjectId.Type
    readonly workspaceId: typeof WorkspaceId.Type
    readonly name: string
    readonly createdAt: bigint
    readonly updatedAt: bigint
  }, unknown>
  readonly randomProjectId: () => typeof ProjectId.Type
  readonly now: () => bigint
}

function failureTag(cause: Cause.Cause<unknown>): string {
  const failure = Option.getOrUndefined(Cause.failureOption(cause))
  return typeof failure === 'object' && failure !== null && '_tag' in failure
    ? String(failure._tag)
    : ''
}

export const projectRoute = Effect.fn('ProjectRoute.route')(function* (
  request: Request,
  identity: ProjectRouteIdentity,
  deps: ProjectRouteDeps,
) {
  const url = new URL(request.url)

  if (request.method === 'GET' && url.pathname === '/api/projects') {
    const program = Effect.gen(function* () {
      const rawLimit = url.searchParams.get('limit')
      const limit = rawLimit === null
        ? DEFAULT_PROJECT_PAGE_SIZE
        : yield* Schema.decodeUnknown(ProjectListLimit)(rawLimit)
      const rawCursor = url.searchParams.get('cursor')
      const cursor = rawCursor === null
        ? null
        : yield* Schema.decodeUnknown(ProjectListCursor)(rawCursor)
      const page = yield* deps.listByWorkspaceId(identity.workspaceId, {
        limit,
        cursor,
      })
      return yield* Schema.encode(ProjectListPage)({
        items: page.items.map(summarize),
        nextCursor: page.nextCursor,
      })
    })
    return yield* Effect.matchCause(program, {
      onFailure: (cause) => {
        const tag = failureTag(cause)
        return tag === 'ParseError'
          ? json({ error: 'InvalidProjectListRequest' }, 400)
          : json({ error: 'ProjectListUnavailable' }, 503)
      },
      onSuccess: (body) => json(body),
    })
  }

  if (request.method === 'POST' && url.pathname === '/api/projects') {
    const program = Effect.gen(function* () {
      const key = yield* idempotencyKey(request)
      const body = yield* Effect.tryPromise({
        try: () => request.json() as Promise<unknown>,
        catch: () => new Error('Invalid JSON body'),
      })
      const input = yield* Schema.decodeUnknown(CreateProjectRequest)(body)
      const now = deps.now()
      const project = yield* deps.createWithIdempotency({
        project: {
          id: deps.randomProjectId(),
          workspaceId: identity.workspaceId,
          name: input.name,
          createdAt: now,
          updatedAt: now,
        },
        idempotencyKey: key,
      })
      return yield* Schema.encode(ProjectSummary)(summarize(project))
    })
    return yield* Effect.matchCause(program, {
      onFailure: (cause) => {
        const failure = Option.getOrUndefined(Cause.failureOption(cause))
        const tag = failureTag(cause)
        return failure instanceof ProjectConflictError
          ? json({ error: 'ProjectNameAlreadyExists' }, 409)
          : tag === 'ParseError'
            ? json({ error: 'InvalidProjectCreateRequest' }, 400)
            : json({ error: 'ProjectCreateUnavailable' }, 503)
      },
      onSuccess: (body) => json(body, 201),
    })
  }

  const detailRoute = /^\/api\/projects\/([^/]+)$/.exec(url.pathname)
  if (request.method === 'GET' && detailRoute !== null) {
    const program = Effect.gen(function* () {
      const projectId = yield* Schema.decodeUnknown(ProjectId)(detailRoute[1])
      const project = yield* deps.findById(projectId)
      if (project.workspaceId !== identity.workspaceId) {
        return yield* Effect.fail(new EntityNotFoundError({
          entity: 'Project',
          id: projectId,
          message: 'Project not found',
        }))
      }
      return yield* Schema.encode(ProjectSummary)(summarize(project))
    })
    return yield* Effect.matchCause(program, {
      onFailure: (cause) => {
        const failure = Option.getOrUndefined(Cause.failureOption(cause))
        const tag = failureTag(cause)
        return failure instanceof EntityNotFoundError || tag === 'ParseError'
          ? json({ error: 'ProjectNotFound' }, 404)
          : json({ error: 'ProjectReadUnavailable' }, 503)
      },
      onSuccess: (body) => json(body),
    })
  }

  return undefined
})
