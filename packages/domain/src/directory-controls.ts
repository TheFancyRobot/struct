import { Schema } from 'effect'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  JobQueueId,
  ManifestEntryId,
  ProjectId,
  SourceId,
  WorkspaceId,
} from './branded-ids.js'
import { DirectoryIngestionJobStatus } from './ingestion-job.js'
import { DirectoryRelativePath } from './directory-manifest.js'

const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())

export const DirectoryControlCommand = Schema.Literal(
  'pause',
  'resume',
  'retry',
  'cancel',
)
export type DirectoryControlCommand =
  Schema.Schema.Type<typeof DirectoryControlCommand>

export const DirectoryProgressEventType = Schema.Literal(
  'directory-registered',
  'directory-entry-checkpointed',
  'directory-paused',
  'directory-resumed',
  'directory-retried',
  'directory-cancelled',
  'directory-completed',
)
export type DirectoryProgressEventType =
  Schema.Schema.Type<typeof DirectoryProgressEventType>

export const DirectoryEntryFailure = Schema.Struct({
  entryId: ManifestEntryId,
  relativePath: DirectoryRelativePath,
  errorTag: Schema.String.pipe(Schema.minLength(1)),
})
export type DirectoryEntryFailure =
  Schema.Schema.Type<typeof DirectoryEntryFailure>

export const DirectoryProgressCounts = Schema.Struct({
  total: NonNegativeInteger,
  processed: NonNegativeInteger,
  succeeded: NonNegativeInteger,
  failed: NonNegativeInteger,
  unsupported: NonNegativeInteger,
  pending: NonNegativeInteger,
}).pipe(
  Schema.filter((counts) => [
    counts.processed === counts.succeeded + counts.failed
      ? undefined
      : 'processed must equal succeeded plus failed',
    counts.total === counts.processed + counts.unsupported + counts.pending
      ? undefined
      : 'total must equal processed plus unsupported plus pending',
  ]),
)
export type DirectoryProgressCounts =
  Schema.Schema.Type<typeof DirectoryProgressCounts>

export const DirectoryStatusProjection = Schema.Struct({
  jobId: JobQueueId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sourceId: SourceId,
  directoryRootId: DirectoryRootId,
  snapshotId: DirectorySnapshotId,
  name: Schema.String.pipe(Schema.minLength(1)),
  status: DirectoryIngestionJobStatus,
  attempts: NonNegativeInteger,
  maxAttempts: PositiveInteger,
  counts: DirectoryProgressCounts,
  failures: Schema.Array(DirectoryEntryFailure),
  updatedAt: NonNegativeInteger,
})
export type DirectoryStatusProjection =
  Schema.Schema.Type<typeof DirectoryStatusProjection>

export const DirectoryProgressEvent = Schema.Struct({
  id: Schema.UUID,
  cursor: Schema.String.pipe(Schema.pattern(/^(0|[1-9]\d*)$/)),
  type: DirectoryProgressEventType,
  jobId: JobQueueId,
  createdAt: NonNegativeInteger,
  status: DirectoryStatusProjection,
})
export type DirectoryProgressEvent =
  Schema.Schema.Type<typeof DirectoryProgressEvent>
