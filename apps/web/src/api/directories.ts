import { Schema } from 'effect'
import {
  DirectoryStatusProjection,
} from '@struct/domain'
import type * as type from '@struct/domain'

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Directory request failed with status ${response.status}`)
  }
  return response.json()
}

export async function registerDirectory(input: {
  readonly workspaceId: type.WorkspaceId
  readonly projectId: type.ProjectId
  readonly name: string
}): Promise<DirectoryStatusProjection> {
  const response = await fetch(`/api/projects/${input.projectId}/directories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return Schema.decodeUnknownPromise(DirectoryStatusProjection)(
    await responseJson(response),
  )
}

export async function fetchDirectoryStatus(input: {
  readonly workspaceId: type.WorkspaceId
  readonly projectId: type.ProjectId
  readonly jobId: type.JobQueueId
}): Promise<DirectoryStatusProjection> {
  const query = new URLSearchParams({ workspaceId: input.workspaceId })
  const response = await fetch(
    `/api/projects/${input.projectId}/directory-jobs/${input.jobId}?${query}`,
  )
  return Schema.decodeUnknownPromise(DirectoryStatusProjection)(
    await responseJson(response),
  )
}

export async function commandDirectory(input: {
  readonly workspaceId: type.WorkspaceId
  readonly projectId: type.ProjectId
  readonly jobId: type.JobQueueId
  readonly command: type.DirectoryControlCommand
  readonly idempotencyKey: string
}): Promise<DirectoryStatusProjection> {
  const response = await fetch(
    `/api/projects/${input.projectId}/directory-jobs/${input.jobId}/${input.command}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ workspaceId: input.workspaceId }),
    },
  )
  const decoded = await Schema.decodeUnknownPromise(
    Schema.Struct({
      status: DirectoryStatusProjection,
      replayed: Schema.Boolean,
    }),
  )(await responseJson(response))
  return decoded.status
}
