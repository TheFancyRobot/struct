import { Schema } from 'effect'
import {
  SourceActivityEvent,
  SourceCatalog,
  SourceImportResponse,
} from '@struct/domain'
import type * as type from '@struct/domain'
import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

async function responseJson(response: Response): Promise<unknown> {
  const body = await response.json()
  if (!response.ok) throw new Error(`Source request failed with status ${response.status}`)
  return body
}

export async function fetchSourceCatalog(
  projectId: type.ProjectId,
): Promise<typeof SourceCatalog.Type> {
  const response = await fetch(
    apiPath(`/projects/${projectId}/sources`, appBasePath),
    { signal: AbortSignal.timeout(10_000) },
  )
  return Schema.decodeUnknownPromise(SourceCatalog)(await responseJson(response))
}

export function sourceActivityUrl(
  projectId: type.ProjectId,
  cursor: string,
): string {
  const query = new URLSearchParams({ cursor })
  return `${apiPath(`/projects/${projectId}/source-activity`, appBasePath)}?${query}`
}

export function decodeSourceActivityEvent(input: unknown) {
  return Schema.decodeUnknownSync(SourceActivityEvent)(input)
}

export type BrowserSourceImportInput =
  | {
      readonly mode: 'files' | 'folder' | 'dataset'
      readonly files: ReadonlyArray<File>
    }
  | {
      readonly mode: 'paste'
      readonly name: string
      readonly content: string
    }

export async function importBrowserSources(
  projectId: type.ProjectId,
  clientBatchId: string,
  input: BrowserSourceImportInput,
): Promise<typeof SourceImportResponse.Type> {
  const form = new FormData()
  form.set('clientBatchId', clientBatchId)
  form.set('mode', input.mode)
  if (input.mode === 'paste') {
    form.set('name', input.name)
    form.set('content', input.content)
  } else {
    for (const file of input.files) form.append('files', file, file.name)
    if (input.mode === 'folder') {
      form.set('paths', JSON.stringify(input.files.map((file) => file.webkitRelativePath)))
    }
  }
  const response = await fetch(
    apiPath(`/projects/${projectId}/sources`, appBasePath),
    {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    },
  )
  const decoded = await Schema.decodeUnknownPromise(SourceImportResponse)(
    await responseJson(response),
  )
  if (decoded.clientBatchId !== clientBatchId) {
    throw new Error('Source import response batch ID does not match the request')
  }
  return decoded
}

export async function commandSourceJob(
  projectId: type.ProjectId,
  jobId: type.JobQueueId,
  command: 'cancel' | 'retry',
): Promise<void> {
  const response = await fetch(
    apiPath(`/projects/${projectId}/source-jobs/${jobId}/${command}`, appBasePath),
    { method: 'POST', signal: AbortSignal.timeout(10_000) },
  )
  if (!response.ok) throw new Error(`Source job ${command} failed`)
}
