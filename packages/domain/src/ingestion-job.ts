import { Effect, Schema } from 'effect'
import {
  DirectorySnapshotId,
  JobQueueId,
  ManifestEntryId,
  WorkspaceId,
} from './branded-ids.js'

export const DirectoryIngestionJobStatus = Schema.Literal(
  'ready',
  'running',
  'paused',
  'completed',
  'cancelled',
  'exhausted',
)
export type DirectoryIngestionJobStatus =
  Schema.Schema.Type<typeof DirectoryIngestionJobStatus>

export const DirectoryIngestionJobTransition = Schema.Literal(
  'claim',
  'pause',
  'resume',
  'retry',
  'cancel',
  'complete',
  'exhaust',
)
export type DirectoryIngestionJobTransition =
  Schema.Schema.Type<typeof DirectoryIngestionJobTransition>

export const DirectoryIngestionLeaseToken = Schema.UUID.pipe(
  Schema.brand('DirectoryIngestionLeaseToken'),
)
export type DirectoryIngestionLeaseToken =
  Schema.Schema.Type<typeof DirectoryIngestionLeaseToken>

export const StableContentKey = Schema.String.pipe(
  Schema.pattern(/^artifact:\/\/sha256\/[0-9a-f]{64}$/),
  Schema.brand('StableContentKey'),
)
export type StableContentKey = Schema.Schema.Type<typeof StableContentKey>

export const DirectoryIngestionEntryOutcome = Schema.Literal(
  'completed',
  'unresolved',
)
export type DirectoryIngestionEntryOutcome =
  Schema.Schema.Type<typeof DirectoryIngestionEntryOutcome>

export const DirectoryIngestionResult = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type DirectoryIngestionResult =
  Schema.Schema.Type<typeof DirectoryIngestionResult>

export const DirectoryIngestionJob = Schema.Struct({
  jobId: JobQueueId,
  workspaceId: WorkspaceId,
  snapshotId: DirectorySnapshotId,
  status: DirectoryIngestionJobStatus,
  attempt: Schema.Number.pipe(Schema.int(), Schema.positive()),
  maxAttempts: Schema.Number.pipe(Schema.int(), Schema.positive()),
  leaseToken: DirectoryIngestionLeaseToken,
  leaseExpiresAt: Schema.BigIntFromNumber,
  nextCheckpointSequence: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type DirectoryIngestionJob =
  Schema.Schema.Type<typeof DirectoryIngestionJob>

export const DirectoryIngestionEntryCommit = Schema.Struct({
  jobId: JobQueueId,
  workspaceId: WorkspaceId,
  entryId: ManifestEntryId,
  idempotencyKey: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512)),
  attempt: Schema.Number.pipe(Schema.int(), Schema.positive()),
  leaseToken: DirectoryIngestionLeaseToken,
  outcome: DirectoryIngestionEntryOutcome,
  contentKey: Schema.NullOr(StableContentKey),
  result: DirectoryIngestionResult,
}).pipe(
  Schema.filter((commit) => [
    commit.outcome === 'completed' && commit.contentKey === null
      ? 'completed entry commits require a stable content key'
      : undefined,
    commit.outcome === 'unresolved' && commit.contentKey !== null
      ? 'unresolved entry commits cannot carry a content key'
      : undefined,
  ]),
)
export type DirectoryIngestionEntryCommit =
  Schema.Schema.Type<typeof DirectoryIngestionEntryCommit>

export class InvalidDirectoryIngestionTransitionError
  extends Schema.TaggedError<InvalidDirectoryIngestionTransitionError>()(
    'InvalidDirectoryIngestionTransitionError',
    {
      current: DirectoryIngestionJobStatus,
      transition: DirectoryIngestionJobTransition,
      message: Schema.String,
    },
  ) {}

const transitions: Readonly<
  Record<
    DirectoryIngestionJobStatus,
    Partial<Record<DirectoryIngestionJobTransition, DirectoryIngestionJobStatus>>
  >
> = {
  ready: { claim: 'running', cancel: 'cancelled' },
  running: {
    pause: 'paused',
    cancel: 'cancelled',
    complete: 'completed',
    exhaust: 'exhausted',
  },
  paused: { resume: 'ready', cancel: 'cancelled' },
  completed: {},
  cancelled: { retry: 'ready' },
  exhausted: { retry: 'ready' },
}

export function transitionDirectoryIngestionJob(
  current: DirectoryIngestionJobStatus,
  transition: DirectoryIngestionJobTransition,
): Effect.Effect<
  DirectoryIngestionJobStatus,
  InvalidDirectoryIngestionTransitionError
> {
  const next = nextDirectoryIngestionJobStatus(current, transition)
  return next === undefined
    ? Effect.fail(new InvalidDirectoryIngestionTransitionError({
        current,
        transition,
        message: `Cannot ${transition} a directory ingestion job in ${current}`,
      }))
    : Effect.succeed(next)
}

export function nextDirectoryIngestionJobStatus(
  current: DirectoryIngestionJobStatus,
  transition: DirectoryIngestionJobTransition,
): DirectoryIngestionJobStatus | undefined {
  return transitions[current][transition]
}
