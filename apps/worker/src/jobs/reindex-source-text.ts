import { createHash } from 'node:crypto'
import { Effect, Option } from 'effect'
import type { SourceTextReindexJob } from '@struct/persistence'
import type { ArtifactRef, ArtifactStoreShape } from '@struct/source-storage'

class ReindexArtifactError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export interface SourceTextReindexWorkerDeps {
  readonly staleBeforeMs: number
  readonly jobs: {
    readonly recoverStale: (staleBeforeMs: number) => Effect.Effect<void, unknown, never>
    readonly claimNext: () => Effect.Effect<Option.Option<SourceTextReindexJob>, unknown, never>
    readonly recordFailure: (
      job: SourceTextReindexJob,
      errorCode: string,
    ) => Effect.Effect<void, unknown, never>
  }
  readonly store: Pick<ArtifactStoreShape, 'readObject'>
  readonly textIndex: {
    readonly indexText: (input: {
      readonly workspaceId: SourceTextReindexJob['workspaceId']
      readonly projectId: SourceTextReindexJob['projectId']
      readonly sourceVersionId: SourceTextReindexJob['sourceVersionId']
      readonly content: string
      readonly reindexAttempt: number
    }) => Effect.Effect<void, unknown, never>
  }
}

interface StoredManifest {
  readonly kind: 'text-source-manifest'
  readonly version: 1
  readonly normalizedRef: ArtifactRef
  readonly contentHash: string
}

const decoder = new TextDecoder('utf-8', { fatal: true })

function artifactRef(value: unknown): value is ArtifactRef {
  return typeof value === 'string' && /^artifact:\/\/sha256\/[a-f0-9]{64}$/.test(value)
}

function decodeManifest(bytes: Uint8Array, job: SourceTextReindexJob): StoredManifest {
  let value: unknown
  try {
    value = JSON.parse(decoder.decode(bytes))
  } catch {
    throw new ReindexArtifactError('manifest-invalid')
  }
  if (typeof value !== 'object' || value === null) {
    throw new ReindexArtifactError('manifest-invalid')
  }
  const record = value as Record<string, unknown>
  if (
    record['kind'] !== 'text-source-manifest'
    || record['version'] !== 1
    || !artifactRef(record['normalizedRef'])
    || record['contentHash'] !== job.contentHash
  ) {
    throw new ReindexArtifactError('manifest-invalid')
  }
  return {
    kind: 'text-source-manifest',
    version: 1,
    normalizedRef: record['normalizedRef'],
    contentHash: record['contentHash'],
  }
}

function decodeNormalized(bytes: Uint8Array, expectedHash: string): string {
  const actualHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  if (actualHash !== expectedHash) {
    throw new ReindexArtifactError('normalized-hash-mismatch')
  }
  try {
    return decoder.decode(bytes)
  } catch {
    throw new ReindexArtifactError('normalized-invalid-utf8')
  }
}

function failureCode(error: unknown): string {
  if (error instanceof ReindexArtifactError) return error.code
  if (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error._tag === 'StorageReadError' || error._tag === 'StoragePathError')
  ) {
    return 'artifact-unavailable'
  }
  return 'reindex-failed'
}

function processClaimed(
  deps: SourceTextReindexWorkerDeps,
  job: SourceTextReindexJob,
): Effect.Effect<void, unknown, never> {
  return Effect.gen(function* () {
    if (!artifactRef(job.artifactRef)) {
      return yield* Effect.fail(new ReindexArtifactError('manifest-ref-invalid'))
    }
    const manifestObject = yield* deps.store.readObject(job.artifactRef)
    const manifest = yield* Effect.try({
      try: () => decodeManifest(manifestObject.bytes, job),
      catch: (error) => error,
    })
    const normalizedObject = yield* deps.store.readObject(manifest.normalizedRef)
    const content = yield* Effect.try({
      try: () => decodeNormalized(normalizedObject.bytes, manifest.contentHash),
      catch: (error) => error,
    })
    yield* deps.textIndex.indexText({
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      sourceVersionId: job.sourceVersionId,
      content,
      reindexAttempt: job.attempts,
    })
  })
}

export const processOneSourceTextReindex = (
  deps: SourceTextReindexWorkerDeps,
): Effect.Effect<{ readonly processed: boolean; readonly sourceVersionId?: string }, unknown, never> =>
  Effect.gen(function* () {
    yield* deps.jobs.recoverStale(deps.staleBeforeMs)
    const claimed = yield* deps.jobs.claimNext()
    if (Option.isNone(claimed)) return { processed: false }
    const job = claimed.value
    yield* processClaimed(deps, job).pipe(
      Effect.catchAll((error) =>
        deps.jobs.recordFailure(job, failureCode(error)),
      ),
    )
    return { processed: true, sourceVersionId: job.sourceVersionId }
  })
