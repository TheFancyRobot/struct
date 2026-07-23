import { createHash } from 'node:crypto'
import { Cause, Effect, Option, Schema } from 'effect'
import {
  ArchiveNoteRequest,
  CreateNoteRequest,
  Note,
  NoteId,
  ProjectId,
  UpdateNoteRequest,
  normalizeNoteText,
  type WorkspaceId,
} from '@struct/domain'
import {
  NoteConflictError,
  NoteNotFoundError,
  NoteProvenanceError,
} from '@struct/persistence'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type {
  CreateNoteInput,
  UpdateNoteInput,
} from '@struct/persistence'
/* eslint-enable no-unused-vars */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function failure(cause: Cause.Cause<unknown>): Response {
  const error = Option.getOrUndefined(Cause.failureOption(cause))
  const tag = typeof error === 'object' && error !== null && '_tag' in error
    ? String(error._tag)
    : ''
  return error instanceof NoteConflictError
    ? json({
        error: 'NoteConflict',
        currentRevision: error.currentRevision,
      }, 409)
    : error instanceof NoteNotFoundError
      ? json({ error: 'NoteNotFound' }, 404)
      : error instanceof NoteProvenanceError
        ? json({ error: 'InvalidNoteProvenance' }, 422)
        : tag === 'ParseError'
          ? json({ error: 'InvalidNoteRequest' }, 400)
          : json({ error: 'NoteServiceUnavailable' }, 503)
}

function hash(title: string, body: string): string {
  return `sha256:${createHash('sha256').update(`${title}\u0000${body}`).digest('hex')}`
}

function key(request: Request) {
  return Schema.decodeUnknown(Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(512),
  ))(request.headers.get('idempotency-key'))
}

function requestBody(request: Request) {
  return Effect.tryPromise({
    try: () => request.json(),
    catch: () => ({ _tag: 'ParseError' as const }),
  })
}

export interface NoteRouteIdentity {
  readonly workspaceId: typeof WorkspaceId.Type
}

export interface NoteRouteDeps {
  readonly create: (input: CreateNoteInput) => Effect.Effect<typeof Note.Type, unknown>
  readonly list: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    archived: boolean,
  ) => Effect.Effect<ReadonlyArray<typeof Note.Type>, unknown>
  readonly find: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    noteId: typeof NoteId.Type,
  ) => Effect.Effect<typeof Note.Type, unknown>
  readonly update: (input: UpdateNoteInput) => Effect.Effect<typeof Note.Type, unknown>
  readonly archive: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    noteId: typeof NoteId.Type,
    archived: boolean,
    expectedRevision: number,
    now: bigint,
  ) => Effect.Effect<typeof Note.Type, unknown>
  readonly randomNoteId: () => typeof NoteId.Type
  readonly now: () => bigint
}

export const noteRoute = Effect.fn('NoteRoute.route')(function* (
  request: Request,
  identity: NoteRouteIdentity,
  deps: NoteRouteDeps,
) {
  const url = new URL(request.url)
  const collection = /^\/api\/projects\/([^/]+)\/notes$/.exec(url.pathname)
  const detail = /^\/api\/projects\/([^/]+)\/notes\/([^/]+)$/.exec(url.pathname)
  const archive = /^\/api\/projects\/([^/]+)\/notes\/([^/]+)\/archive$/.exec(url.pathname)
  if (collection === null && detail === null && archive === null) return undefined

  const program = Effect.gen(function* () {
    const projectId = yield* Schema.decodeUnknown(ProjectId)(
      (collection ?? detail ?? archive)?.[1],
    )
    if (collection !== null && request.method === 'GET') {
      return {
        body: yield* Schema.encode(Schema.Array(Note))(
          yield* deps.list(
            identity.workspaceId,
            projectId,
            url.searchParams.get('archived') === 'true',
          ),
        ),
        status: 200,
      }
    }
    if (collection !== null && request.method === 'POST') {
      const idempotencyKey = yield* key(request)
      const raw = yield* requestBody(request)
      const decoded = yield* Schema.decodeUnknown(CreateNoteRequest)({
        ...(typeof raw === 'object' && raw !== null ? raw : {}),
        title: typeof (raw as { title?: unknown })?.title === 'string'
          ? normalizeNoteText((raw as { title: string }).title)
          : undefined,
        body: typeof (raw as { body?: unknown })?.body === 'string'
          ? normalizeNoteText((raw as { body: string }).body)
          : undefined,
      })
      const now = deps.now()
      const note = yield* deps.create({
        id: deps.randomNoteId(),
        workspaceId: identity.workspaceId,
        projectId,
        authorId: identity.workspaceId,
        origin: decoded.origin,
        title: decoded.title,
        body: decoded.body,
        contentHash: hash(decoded.title, decoded.body),
        idempotencyKey,
        now,
      })
      return { body: yield* Schema.encode(Note)(note), status: 201 }
    }
    const noteId = yield* Schema.decodeUnknown(NoteId)(
      (detail ?? archive)?.[2],
    )
    if (detail !== null && request.method === 'GET') {
      return {
        body: yield* Schema.encode(Note)(
          yield* deps.find(identity.workspaceId, projectId, noteId),
        ),
        status: 200,
      }
    }
    if (detail !== null && request.method === 'PATCH') {
      const raw = yield* requestBody(request)
      const decoded = yield* Schema.decodeUnknown(UpdateNoteRequest)({
        ...(typeof raw === 'object' && raw !== null ? raw : {}),
        title: typeof (raw as { title?: unknown })?.title === 'string'
          ? normalizeNoteText((raw as { title: string }).title)
          : undefined,
        body: typeof (raw as { body?: unknown })?.body === 'string'
          ? normalizeNoteText((raw as { body: string }).body)
          : undefined,
      })
      const note = yield* deps.update({
        workspaceId: identity.workspaceId,
        projectId,
        noteId,
        authorId: identity.workspaceId,
        expectedRevision: decoded.expectedRevision,
        title: decoded.title,
        body: decoded.body,
        contentHash: hash(decoded.title, decoded.body),
        now: deps.now(),
      })
      return { body: yield* Schema.encode(Note)(note), status: 200 }
    }
    if (archive !== null && request.method === 'POST') {
      const decoded = yield* Schema.decodeUnknown(ArchiveNoteRequest)(
        yield* requestBody(request),
      )
      const note = yield* deps.archive(
        identity.workspaceId,
        projectId,
        noteId,
        decoded.archived,
        decoded.expectedRevision,
        deps.now(),
      )
      return { body: yield* Schema.encode(Note)(note), status: 200 }
    }
    return { body: { error: 'MethodNotAllowed' }, status: 405 }
  })

  return yield* Effect.matchCause(program, {
    onFailure: failure,
    onSuccess: ({ body, status }) => json(body, status),
  })
})
