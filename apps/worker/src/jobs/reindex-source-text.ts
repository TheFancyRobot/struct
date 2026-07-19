import { createHash } from 'node:crypto'
import { Effect, Option, Schema } from 'effect'
import {
  SourceTextReindexOwnershipLostError,
  type PersistenceError,
  type SourceTextReindexJob,
} from '@struct/persistence'
import {
  type ArtifactRef,
  type ArtifactStoreShape,
} from '@struct/source-storage'
import type { RetrievalQueryError } from '@struct/domain'

const ReindexArtifactErrorCode = Schema.Literal(
  'manifest-ref-invalid',
  'manifest-invalid',
  'normalized-hash-mismatch',
  'normalized-invalid-utf8',
)

class ReindexArtifactError
  extends Schema.TaggedError<ReindexArtifactError>()('ReindexArtifactError', {
    code: ReindexArtifactErrorCode,
    message: Schema.String,
  }) {}

class SourceTextReindexLeaseHeartbeatError
  extends Schema.TaggedError<SourceTextReindexLeaseHeartbeatError>()(
    'SourceTextReindexLeaseHeartbeatError',
    {
      cause: Schema.Unknown,
      message: Schema.String,
    },
  ) {}

export interface SourceTextReindexWorkerDeps {
  readonly staleAfterMs: number
  readonly heartbeatIntervalMs: number
  readonly jobs: {
    readonly recoverStale: (staleAfterMs: number) => Effect.Effect<void, PersistenceError, never>
    readonly claimNext: () => Effect.Effect<Option.Option<SourceTextReindexJob>, PersistenceError, never>
    readonly renewLease: (
      job: SourceTextReindexJob,
    ) => Effect.Effect<void, PersistenceError, never>
    readonly recordFailure: (
      job: SourceTextReindexJob,
      errorCode: string,
    ) => Effect.Effect<void, PersistenceError, never>
  }
  readonly store: Pick<ArtifactStoreShape, 'readObject'>
  readonly textIndex: {
    readonly indexText: (input: {
      readonly workspaceId: SourceTextReindexJob['workspaceId']
      readonly projectId: SourceTextReindexJob['projectId']
      readonly sourceVersionId: SourceTextReindexJob['sourceVersionId']
      readonly content: string
      readonly reindexAttempt: number
    }) => Effect.Effect<void, RetrievalQueryError | SourceTextReindexOwnershipLostError, never>
  }
}

interface StoredManifest {
  readonly kind: 'text-source-manifest'
  readonly version: 1 | 2
  readonly normalizedRef: ArtifactRef
  readonly contentHash: string
}

type ArtifactReadError =
  ReturnType<ArtifactStoreShape['readObject']> extends Effect.Effect<unknown, infer Error, never>
    ? Error
    : never

const decoder = new TextDecoder('utf-8', { fatal: true })

function artifactRef(value: unknown): value is ArtifactRef {
  return typeof value === 'string' && /^artifact:\/\/sha256\/[a-f0-9]{64}$/.test(value)
}

function decodeManifest(bytes: Uint8Array, job: SourceTextReindexJob): StoredManifest {
  let value: unknown
  try {
    value = JSON.parse(decoder.decode(bytes))
  } catch {
    throw new ReindexArtifactError({ code: 'manifest-invalid', message: 'Stored source manifest is invalid' })
  }
  if (typeof value !== 'object' || value === null) {
    throw new ReindexArtifactError({ code: 'manifest-invalid', message: 'Stored source manifest is invalid' })
  }
  const record = value as Record<string, unknown>
  if (
    record['kind'] !== 'text-source-manifest'
    || (record['version'] !== 1 && record['version'] !== 2)
    || !artifactRef(record['normalizedRef'])
    || record['contentHash'] !== job.contentHash
  ) {
    throw new ReindexArtifactError({ code: 'manifest-invalid', message: 'Stored source manifest is invalid' })
  }
  return {
    kind: 'text-source-manifest',
    version: record['version'],
    normalizedRef: record['normalizedRef'],
    contentHash: record['contentHash'],
  }
}

function decodeNormalized(bytes: Uint8Array, expectedHash: string): string {
  const actualHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  if (actualHash !== expectedHash) {
    throw new ReindexArtifactError({ code: 'normalized-hash-mismatch', message: 'Normalized source hash did not match its manifest' })
  }
  try {
    return decoder.decode(bytes)
  } catch {
    throw new ReindexArtifactError({ code: 'normalized-invalid-utf8', message: 'Normalized source is not valid UTF-8' })
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

function isOwnershipLost(error: unknown): boolean {
  return error instanceof SourceTextReindexOwnershipLostError
    || (
      typeof error === 'object'
      && error !== null
      && '_tag' in error
      && error._tag === 'SourceTextReindexOwnershipLostError'
    )
}

function processClaimed(
  deps: SourceTextReindexWorkerDeps,
  job: SourceTextReindexJob,
): Effect.Effect<
  void,
  | ReindexArtifactError
  | ArtifactReadError
  | RetrievalQueryError
  | SourceTextReindexOwnershipLostError,
  never
> {
  return Effect.gen(function* () {
    if (!artifactRef(job.artifactRef)) {
      return yield* Effect.fail(new ReindexArtifactError({
        code: 'manifest-ref-invalid',
        message: 'Stored source manifest reference is invalid',
      }))
    }
    const manifestObject = yield* deps.store.readObject(job.artifactRef)
    const manifest = yield* Effect.try({
      try: () => decodeManifest(manifestObject.bytes, job),
      catch: (error) =>
        error instanceof ReindexArtifactError
          ? error
          : new ReindexArtifactError({
              code: 'manifest-invalid',
              message: 'Stored source manifest is invalid',
            }),
    })
    const normalizedObject = yield* deps.store.readObject(manifest.normalizedRef)
    const content = yield* Effect.try({
      try: () => decodeNormalized(normalizedObject.bytes, manifest.contentHash),
      catch: (error) =>
        error instanceof ReindexArtifactError
          ? error
          : new ReindexArtifactError({
              code: 'normalized-invalid-utf8',
              message: 'Normalized source is not valid UTF-8',
            }),
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
    yield* deps.jobs.recoverStale(deps.staleAfterMs)
    const claimed = yield* deps.jobs.claimNext()
    if (Option.isNone(claimed)) return { processed: false }
    const job = claimed.value
    const executeClaimed = processClaimed(deps, job).pipe(
      Effect.catchTag('SourceTextReindexOwnershipLostError', () => Effect.void),
      Effect.catchTags({
        ReindexArtifactError: (error) =>
          deps.jobs.recordFailure(job, failureCode(error)).pipe(
            Effect.catchTag('SourceTextReindexOwnershipLostError', () => Effect.void),
          ),
        StoragePathError: (error) =>
          deps.jobs.recordFailure(job, failureCode(error)).pipe(
            Effect.catchTag('SourceTextReindexOwnershipLostError', () => Effect.void),
          ),
        StorageReadError: (error) =>
          deps.jobs.recordFailure(job, failureCode(error)).pipe(
            Effect.catchTag('SourceTextReindexOwnershipLostError', () => Effect.void),
          ),
        RetrievalQueryError: (error) =>
          deps.jobs.recordFailure(job, failureCode(error)).pipe(
            Effect.catchTag('SourceTextReindexOwnershipLostError', () => Effect.void),
          ),
      }),
    )
    const renewLease = Effect.gen(function* () {
      while (true) {
        yield* deps.jobs.renewLease(job)
        yield* Effect.sleep(`${deps.heartbeatIntervalMs} millis`)
      }
    }).pipe(
      Effect.mapError((cause) =>
        new SourceTextReindexLeaseHeartbeatError({
          cause,
          message: 'Source text reindex lease heartbeat failed',
        }),
      ),
    )
    const executed = yield* Effect.raceFirst(executeClaimed, renewLease).pipe(
      Effect.either,
    )
    if (executed._tag === 'Left') {
      if (executed.left instanceof SourceTextReindexLeaseHeartbeatError) {
        if (isOwnershipLost(executed.left.cause)) {
          return { processed: true, sourceVersionId: job.sourceVersionId }
        }
        return yield* Effect.fail(executed.left.cause)
      }
      if (isOwnershipLost(executed.left)) {
        return { processed: true, sourceVersionId: job.sourceVersionId }
      }
      return yield* Effect.fail(executed.left)
    }
    return { processed: true, sourceVersionId: job.sourceVersionId }
  })
