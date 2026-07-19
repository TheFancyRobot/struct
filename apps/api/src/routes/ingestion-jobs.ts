import { Effect, Option } from 'effect'
import {
  DirectoryControlCommand as type,
  EventJournalId,
  JobQueueId,
  ProjectId,
  ValidationError,
  WorkspaceId,
  type DirectoryStatusProjection,
} from '@struct/domain'
import type {
  DirectoryControlRepositoryError,
  DirectoryControlResult,
} from '@struct/persistence'

export interface DirectoryJobScope {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly jobId: typeof JobQueueId.Type
}

export interface DirectoryJobRouteDeps {
  readonly findStatus: (
    workspaceId: typeof WorkspaceId.Type,
    projectId: typeof ProjectId.Type,
    jobId: typeof JobQueueId.Type,
  ) => Effect.Effect<
    Option.Option<DirectoryStatusProjection>,
    DirectoryControlRepositoryError,
    never
  >
  readonly command: (input: {
    readonly workspaceId: typeof WorkspaceId.Type
    readonly projectId: typeof ProjectId.Type
    readonly jobId: typeof JobQueueId.Type
    readonly command: typeof type.Type
    readonly idempotencyKey: string
    readonly eventId: typeof EventJournalId.Type
  }) => Effect.Effect<
    DirectoryControlResult,
    DirectoryControlRepositoryError,
    never
  >
  readonly randomEventId: () => typeof EventJournalId.Type
}

export const getDirectoryJobStatus = (
  scope: DirectoryJobScope,
  deps: Pick<DirectoryJobRouteDeps, 'findStatus'>,
) => deps.findStatus(scope.workspaceId, scope.projectId, scope.jobId)

export function controlDirectoryJob(
  scope: DirectoryJobScope,
  command: typeof type.Type,
  idempotencyKey: string,
  deps: Pick<DirectoryJobRouteDeps, 'command' | 'randomEventId'>,
): Effect.Effect<
  DirectoryControlResult,
  ValidationError | DirectoryControlRepositoryError,
  never
> {
  if (idempotencyKey.length === 0 || idempotencyKey.length > 512) {
    return Effect.fail(new ValidationError({
      field: 'Idempotency-Key',
      reason: 'invalid',
      message: 'Idempotency-Key must contain between 1 and 512 characters',
    }))
  }
  return deps.command({
    ...scope,
    command,
    idempotencyKey,
    eventId: deps.randomEventId(),
  })
}
