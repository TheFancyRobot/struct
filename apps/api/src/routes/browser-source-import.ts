import {
  datasetUploadForName,
  normalizeBrowserRelativePath,
  sourceUploadMediaTypeForName,
  type StructuredSourceFormat,
} from '@struct/domain'

export const MAX_BROWSER_SOURCE_FILES = 20

export interface BrowserSourceImportItem {
  readonly name: string
  readonly mediaType: string
  readonly bytes: Uint8Array
  readonly kind: 'document' | 'dataset'
  readonly format?: StructuredSourceFormat
}

export interface BrowserSourceImport {
  readonly clientBatchId: string
  readonly formProjectId: string | null
  readonly attachToProject: boolean
  readonly items: ReadonlyArray<BrowserSourceImportItem>
  readonly rejected: ReadonlyArray<{ readonly name: string; readonly reason: string }>
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function stringField(form: FormData, name: string): string | null {
  const value = form.get(name)
  return typeof value === 'string' ? value : null
}

function decodePaths(form: FormData): ReadonlyArray<unknown> {
  const value = stringField(form, 'paths')
  if (value === null) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function boundedFormData(
  request: Request,
  maxBytes: number,
): Promise<FormData> {
  if (request.body === null) throw new Error('missing-browser-source-body')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    byteLength += chunk.value.byteLength
    if (byteLength > maxBytes) {
      await reader.cancel()
      throw new Error('browser-source-batch-too-large')
    }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Response(bytes, {
    headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
  }).formData()
}

export async function decodeBrowserSourceImport(
  request: Request,
  maxFileBytes: number,
): Promise<BrowserSourceImport> {
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxFileBytes * MAX_BROWSER_SOURCE_FILES + 65_536) {
    throw new Error('browser-source-batch-too-large')
  }

  // ponytail: native FormData buffers only after a backpressured bounded read;
  // add a streaming multipart parser if the configured 20-file ceiling grows.
  const form = await boundedFormData(
    request,
    maxFileBytes * MAX_BROWSER_SOURCE_FILES + 65_536,
  )
  const clientBatchId = stringField(form, 'clientBatchId')
  if (clientBatchId === null || !uuidPattern.test(clientBatchId)) {
    throw new Error('invalid-client-batch-id')
  }
  const formProjectId = stringField(form, 'projectId')
  const attachToProject = stringField(form, 'attachToProject') !== 'false'
  const mode = stringField(form, 'mode')
  if (mode === 'paste') {
    const name = normalizeBrowserRelativePath(stringField(form, 'name'))
    const content = stringField(form, 'content')
    if (name === null || content === null) throw new Error('invalid-paste-source')
    const bytes = new TextEncoder().encode(content)
    const mediaType = sourceUploadMediaTypeForName(name)
    if (bytes.byteLength === 0 || bytes.byteLength > maxFileBytes || mediaType === null) {
      return {
        clientBatchId,
        formProjectId,
        attachToProject,
        items: [],
        rejected: [{ name, reason: bytes.byteLength === 0 ? 'empty' : mediaType === null ? 'unsupported-type' : 'too-large' }],
      }
    }
    return {
      clientBatchId,
      formProjectId,
      attachToProject,
      items: [{ name, mediaType, bytes, kind: 'document' }],
      rejected: [],
    }
  }
  if (mode !== 'files' && mode !== 'folder' && mode !== 'dataset') {
    throw new Error('invalid-source-import-mode')
  }

  const files = form.getAll('files').filter((value): value is File => value instanceof File)
  if (files.length === 0 || files.length > MAX_BROWSER_SOURCE_FILES) {
    throw new Error('invalid-source-file-count')
  }
  const paths = decodePaths(form)
  if (mode === 'folder' && paths.length !== files.length) {
    throw new Error('invalid-folder-paths')
  }

  const seen = new Set<string>()
  const items: BrowserSourceImportItem[] = []
  const rejected: Array<{ name: string; reason: string }> = []
  let aggregateBytes = 0
  for (const [index, file] of files.entries()) {
    const candidate = mode === 'folder' ? paths[index] : file.name
    const name = normalizeBrowserRelativePath(candidate)
    const fallbackName = typeof candidate === 'string' ? candidate : file.name
    if (name === null || seen.has(name)) {
      rejected.push({ name: fallbackName, reason: name === null ? 'unsafe-path' : 'duplicate' })
      continue
    }
    seen.add(name)
    const dataset = mode === 'dataset' ? datasetUploadForName(name) : null
    const mediaType = mode === 'dataset'
      ? dataset?.mediaType ?? null
      : sourceUploadMediaTypeForName(name)
    if (file.size === 0 || file.size > maxFileBytes || mediaType === null) {
      rejected.push({
        name,
        reason: file.size === 0 ? 'empty' : mediaType === null ? 'unsupported-type' : 'too-large',
      })
      continue
    }
    aggregateBytes += file.size
    if (aggregateBytes > maxFileBytes * MAX_BROWSER_SOURCE_FILES) {
      rejected.push({ name, reason: 'batch-too-large' })
      continue
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength !== file.size) {
      rejected.push({ name, reason: 'size-mismatch' })
      continue
    }
    items.push({
      name,
      mediaType,
      bytes,
      kind: mode === 'dataset' ? 'dataset' : 'document',
      ...(dataset === null ? {} : { format: dataset.format }),
    })
  }
  return { clientBatchId, formProjectId, attachToProject, items, rejected }
}

export function hashBrowserSourceImport(
  input: BrowserSourceImport,
): `sha256:${string}` {
  const items = input.items.map((item) => ({
    name: item.name,
    mediaType: item.mediaType,
    kind: item.kind,
    format: item.format ?? null,
    contentHash: new Bun.CryptoHasher('sha256').update(item.bytes).digest('hex'),
  }))
  const canonical = JSON.stringify({
    projectId: input.formProjectId,
    attachToProject: input.attachToProject,
    items,
    rejected: input.rejected,
  })
  return `sha256:${new Bun.CryptoHasher('sha256').update(canonical).digest('hex')}`
}
