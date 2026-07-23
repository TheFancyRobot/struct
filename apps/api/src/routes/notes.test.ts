import { describe, expect, it } from 'bun:test'
import { Effect, Schema } from 'effect'
import {
  Note,
  NoteId,
  ProjectId,
  WorkspaceId,
} from '@struct/domain'
import { NoteConflictError } from '@struct/persistence'
import { noteRoute, type NoteRouteDeps } from './notes'

const workspaceId = WorkspaceId.make('570e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('570e8400-e29b-41d4-a716-446655440010')
const noteId = NoteId.make('570e8400-e29b-41d4-a716-446655440020')
const origin = {
  threadId: '570e8400-e29b-41d4-a716-446655440030',
  runId: '570e8400-e29b-41d4-a716-446655440040',
  citations: [{
    kind: 'document' as const,
    id: '570e8400-e29b-41d4-a716-446655440050',
    sourceVersionId: '570e8400-e29b-41d4-a716-446655440060',
    locator: 'line:1',
  }],
}
const note = Schema.decodeUnknownSync(Note)({
  id: noteId,
  workspaceId,
  projectId,
  authorId: workspaceId,
  origin,
  current: {
    revision: 1,
    title: 'Résumé',
    body: 'Supported answer',
    authorId: workspaceId,
    contentHash: `sha256:${'a'.repeat(64)}`,
    createdAt: 1,
  },
  archived: false,
  createdAt: 1,
  updatedAt: 1,
})

function deps(overrides: Partial<NoteRouteDeps> = {}): NoteRouteDeps {
  return {
    create: () => Effect.succeed(note),
    list: () => Effect.succeed([]),
    find: () => Effect.succeed(note),
    update: () => Effect.succeed(note),
    archive: () => Effect.succeed(note),
    randomNoteId: () => noteId,
    now: () => 1n,
    ...overrides,
  }
}

describe('note route', () => {
  it('derives author scope and normalizes note text', async () => {
    let received: Parameters<NoteRouteDeps['create']>[0] | undefined
    const response = await Effect.runPromise(noteRoute(
      new Request(`http://localhost/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'save-run',
        },
        body: JSON.stringify({
          title: '  Re\u0301sume\u0301  ',
          body: '  Supported answer  ',
          origin,
        }),
      }),
      { workspaceId },
      deps({
        create: (input) => {
          received = input
          return Effect.succeed(note)
        },
      }),
    ))

    expect(response?.status).toBe(201)
    expect(received).toMatchObject({
      workspaceId,
      projectId,
      authorId: workspaceId,
      title: 'Résumé',
      body: 'Supported answer',
      idempotencyKey: 'save-run',
      origin,
    })
    expect(received?.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('returns bounded validation and conflict errors', async () => {
    const invalid = await Effect.runPromise(noteRoute(
      new Request(`http://localhost/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'save-run',
        },
        body: JSON.stringify({ title: '', body: 'answer', origin }),
      }),
      { workspaceId },
      deps(),
    ))
    const conflict = await Effect.runPromise(noteRoute(
      new Request(`http://localhost/api/projects/${projectId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Title',
          body: 'Body',
          expectedRevision: 1,
        }),
      }),
      { workspaceId },
      deps({
        update: () => Effect.fail(new NoteConflictError({
          currentRevision: 2,
          message: 'stale',
        })),
      }),
    ))

    expect(invalid?.status).toBe(400)
    expect(conflict?.status).toBe(409)
    expect(await conflict?.json()).toEqual({
      error: 'NoteConflict',
      currentRevision: 2,
    })
  })
})
