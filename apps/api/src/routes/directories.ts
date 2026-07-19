import { Effect } from 'effect'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  EventJournalId,
  JobQueueId,
  ProjectId,
  SourceId,
  ValidationError,
  WorkspaceId,
  type DirectoryStatusProjection,
} from '@struct/domain'
import type { DirectoryControlRepositoryError } from '@struct/persistence'

export interface RegisterDirectoryInput {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly name: string
}

export interface RegisterDirectoryDeps {
  readonly randomSourceId: () => typeof SourceId.Type
  readonly randomDirectoryRootId: () => typeof DirectoryRootId.Type
  readonly randomSnapshotId: () => typeof DirectorySnapshotId.Type
  readonly randomJobId: () => typeof JobQueueId.Type
  readonly randomEventId: () => typeof EventJournalId.Type
  readonly register: (input: {
    readonly workspaceId: typeof WorkspaceId.Type
    readonly projectId: typeof ProjectId.Type
    readonly name: string
    readonly sourceId: typeof SourceId.Type
    readonly directoryRootId: typeof DirectoryRootId.Type
    readonly snapshotId: typeof DirectorySnapshotId.Type
    readonly jobId: typeof JobQueueId.Type
    readonly eventId: typeof EventJournalId.Type
    readonly maxAttempts: number
  }) => Effect.Effect<
    DirectoryStatusProjection,
    DirectoryControlRepositoryError,
    never
  >
}

export function registerDirectory(
  input: RegisterDirectoryInput,
  deps: RegisterDirectoryDeps,
): Effect.Effect<
  DirectoryStatusProjection,
  ValidationError | DirectoryControlRepositoryError,
  never
> {
  const name = input.name.trim()
  if (name.length === 0 || name.length > 255 || /[/\\\0]/.test(name)) {
    return Effect.fail(new ValidationError({
      field: 'name',
      reason: 'invalid-directory-name',
      message: 'Directory name must be a simple name of at most 255 characters',
    }))
  }
  return deps.register({
    ...input,
    name,
    sourceId: deps.randomSourceId(),
    directoryRootId: deps.randomDirectoryRootId(),
    snapshotId: deps.randomSnapshotId(),
    jobId: deps.randomJobId(),
    eventId: deps.randomEventId(),
    maxAttempts: 3,
  })
}

export function decodeDirectoryRegistrationScope(input: {
  readonly workspaceId?: unknown
  readonly projectId?: unknown
  readonly name?: unknown
}): Effect.Effect<RegisterDirectoryInput, ValidationError> {
  return Effect.try({
    try: () => {
      if (
        typeof input.workspaceId !== 'string'
        || typeof input.projectId !== 'string'
        || typeof input.name !== 'string'
      ) {
        throw new Error('invalid')
      }
      return {
        workspaceId: WorkspaceId.make(input.workspaceId),
        projectId: ProjectId.make(input.projectId),
        name: input.name,
      }
    },
    catch: () => new ValidationError({
      field: 'directory',
      reason: 'invalid-payload',
      message: 'Directory registration payload is invalid',
    }),
  })
}
