import { Schema } from 'effect'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import {
  Note,
  NoteId,
  type NoteOrigin,
  type ProjectId,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

export class NoteConflictError extends Error {
  readonly currentRevision: number

  constructor(_currentRevision: number) {
    super('This note changed. Reload the latest revision before saving again.')
    this.currentRevision = _currentRevision
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(apiPath(path, appBasePath), {
    ...init,
    signal: AbortSignal.timeout(10_000),
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const error = typeof body === 'object' && body !== null
      && 'error' in body ? String(body.error) : ''
    if (response.status === 409 && error === 'NoteConflict') {
      throw new NoteConflictError(
        typeof body === 'object' && body !== null
          && 'currentRevision' in body
          && typeof body.currentRevision === 'number'
          ? body.currentRevision
          : 0,
      )
    }
    throw new Error(response.status === 404
      ? 'This note is no longer available.'
      : response.status === 422
        ? 'The answer evidence is no longer eligible for a trusted note.'
        : 'The note could not be saved. Try again.')
  }
  return body
}

function decode(body: unknown) {
  return Schema.decodeUnknownPromise(Note)(body)
}

export async function fetchNotes(projectId: ProjectId) {
  const body = await request(`/projects/${projectId}/notes`)
  return Schema.decodeUnknownPromise(Schema.Array(Note))(body)
}

export async function fetchNote(projectId: ProjectId, noteId: NoteId) {
  return decode(await request(`/projects/${projectId}/notes/${noteId}`))
}

export async function createNote(input: {
  readonly projectId: ProjectId
  readonly title: string
  readonly body: string
  readonly origin: NoteOrigin
  readonly idempotencyKey: string
}) {
  return decode(await request(`/projects/${input.projectId}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      origin: input.origin,
    }),
  }))
}

export async function updateNote(input: {
  readonly projectId: ProjectId
  readonly noteId: NoteId
  readonly title: string
  readonly body: string
  readonly expectedRevision: number
}) {
  return decode(await request(`/projects/${input.projectId}/notes/${input.noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      expectedRevision: input.expectedRevision,
    }),
  }))
}
