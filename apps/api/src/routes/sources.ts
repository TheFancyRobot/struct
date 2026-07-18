import { Effect } from 'effect'
import {
  JobQueueId,
  SourceId,
  EventJournalId,
  ValidationError,
  AuthorizationError,
  type ProjectId,
  type WorkspaceId,
  type Source,
  type Project,
  type JobQueue,
  type EventJournal,
} from '@struct/domain'
import type { ArtifactStoreShape, StagedArtifactRef } from '@struct/source-storage'

export { ValidationError, AuthorizationError }

export interface RegisterTextSourceInput {
  readonly workspaceId: WorkspaceId
  readonly projectId: ProjectId
  readonly name: string
  readonly mediaType: string
  readonly bytes: Uint8Array
}

export interface RegisterTextSourceResult {
  readonly source: typeof Source.Type
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

export interface RegisterTextSourceDeps {
  readonly now: () => bigint
  readonly randomUuid: () => typeof SourceId.Type
  readonly randomJobQueueId: () => typeof JobQueueId.Type
  readonly randomEventJournalId: () => typeof EventJournalId.Type
  readonly maxBytes: number
  readonly projects: {
    readonly findById: (projectId: ProjectId) => Effect.Effect<typeof Project.Type, unknown, never>
  }
  readonly registration: {
    readonly create: (input: {
      readonly source: typeof Source.Type
      readonly job: typeof JobQueue.Type
      readonly event: typeof EventJournal.Type
    }) => Effect.Effect<RegisterTextSourceResult, unknown, never>
  }
  readonly storage: Pick<ArtifactStoreShape, 'stageObject'>
  readonly calls?: {
    readonly jobPayloads: unknown[]
    readonly events: unknown[]
  }
}

function isSafeUploadName(name: string): boolean {
  return name.length > 0
    && !name.includes('\0')
    && !name.includes('/')
    && !name.includes('\\')
    && name !== '.'
    && name !== '..'
}

function isSupportedTextUpload(name: string, mediaType: string): boolean {
  const lower = name.toLowerCase()
  return (lower.endsWith('.txt') && mediaType === 'text/plain') || (lower.endsWith('.md') && mediaType === 'text/markdown')
}

const mapUnknown = (operation: string) => (cause: unknown): ValidationError => {
  const tag = typeof cause === 'object' && cause !== null && '_tag' in cause ? String(cause._tag) : 'failed'
  return new ValidationError({ field: operation, reason: tag, message: `${operation} failed` })
}

export const registerTextSource = (
  input: RegisterTextSourceInput,
  deps: RegisterTextSourceDeps,
): Effect.Effect<RegisterTextSourceResult, ValidationError | AuthorizationError, never> =>
  Effect.gen(function* () {
    if (input.bytes.byteLength > deps.maxBytes) {
      return yield* new ValidationError({ field: 'bytes', reason: 'too-large', message: 'Text source exceeds MAX_TEXT_SOURCE_BYTES' })
    }
    if (!isSafeUploadName(input.name)) {
      return yield* new ValidationError({ field: 'name', reason: 'unsafe-name', message: 'Text source name must be a simple file name' })
    }
    if (!isSupportedTextUpload(input.name, input.mediaType)) {
      return yield* new ValidationError({ field: 'mediaType', reason: 'unsupported-source-type', message: 'Only .txt text/plain and .md text/markdown uploads are supported' })
    }

    const project = yield* deps.projects.findById(input.projectId).pipe(Effect.mapError(mapUnknown('project lookup')))
    if (project.workspaceId !== input.workspaceId) {
      return yield* new AuthorizationError({ detail: 'workspace-project-mismatch', message: 'Project does not belong to the supplied workspace' })
    }

    const staged = yield* deps.storage.stageObject(input.name, input.bytes, { mediaType: input.mediaType }).pipe(
      Effect.mapError(mapUnknown('stage upload')),
    )
    const now = deps.now()
    const sourceId = deps.randomUuid()
    const source: typeof Source.Type = {
      id: sourceId,
      projectId: input.projectId,
      name: input.name,
      kind: 'document',
      createdAt: now,
      updatedAt: now,
    }
    const payload = {
      stagedRef: staged.ref,
      name: input.name,
      mediaType: input.mediaType,
      byteLength: staged.byteLength,
      sourceId,
      projectId: input.projectId,
    } satisfies Record<string, unknown> & { stagedRef: StagedArtifactRef }
    const job: typeof JobQueue.Type = {
      id: deps.randomJobQueueId(),
      workspaceId: input.workspaceId,
      entityType: 'ingestion',
      entityId: sourceId,
      status: 'pending',
      payload,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    }
    const event: typeof EventJournal.Type = {
      id: deps.randomEventJournalId(),
      workspaceId: input.workspaceId,
      entityType: 'ingestion',
      entityId: sourceId,
      eventType: 'ingestion-requested',
      payload: {
        sourceId,
        jobId: job.id,
        stagedRef: staged.ref,
        mediaType: input.mediaType,
        byteLength: staged.byteLength,
      },
      cursor: 0n,
      createdAt: now,
    }
    return yield* deps.registration.create({ source, job, event }).pipe(
      Effect.mapError(mapUnknown('source registration')),
    )
  })
