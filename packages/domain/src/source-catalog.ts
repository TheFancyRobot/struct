import { Schema } from 'effect'
import { EventJournalId, JobQueueId, SourceId, SourceVersionId } from './branded-ids.js'
import { JobStatus, SourceKind } from './schemas.js'

const Timestamp = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const Cursor = Schema.String.pipe(Schema.pattern(/^(0|[1-9]\d*)$/))

export const SourceCatalogJob = Schema.Struct({
  id: JobQueueId,
  status: JobStatus,
  attempts: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxAttempts: Schema.Number.pipe(Schema.int(), Schema.positive()),
  updatedAt: Timestamp,
})
export type SourceCatalogJob = Schema.Schema.Type<typeof SourceCatalogJob>

export const SourceReadiness = Schema.Literal(
  'pending',
  'processing',
  'ready',
  'failed',
  'cancelled',
)
export type SourceReadiness = Schema.Schema.Type<typeof SourceReadiness>

export const SourceCatalogItem = Schema.Struct({
  sourceId: SourceId,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
  kind: SourceKind,
  mediaType: Schema.NullOr(Schema.String),
  latestVersionId: Schema.NullOr(SourceVersionId),
  latestVersion: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive())),
  readiness: SourceReadiness,
  updatedAt: Timestamp,
  job: Schema.NullOr(SourceCatalogJob),
})
export type SourceCatalogItem = Schema.Schema.Type<typeof SourceCatalogItem>

export const SourceCatalog = Schema.Struct({
  items: Schema.Array(SourceCatalogItem),
  cursor: Cursor,
})
export type SourceCatalog = Schema.Schema.Type<typeof SourceCatalog>

export const SourceActivityEvent = Schema.Struct({
  id: EventJournalId,
  cursor: Cursor,
  sourceId: SourceId,
  type: Schema.String,
  createdAt: Timestamp,
})
export type SourceActivityEvent = Schema.Schema.Type<typeof SourceActivityEvent>

export const SourceImportAcceptedItem = Schema.Struct({
  sourceId: SourceId,
  jobId: JobQueueId,
  name: Schema.String,
})

export const SourceImportRejectedItem = Schema.Struct({
  name: Schema.String,
  reason: Schema.String,
})

export const SourceImportResponse = Schema.Struct({
  accepted: Schema.Array(SourceImportAcceptedItem),
  rejected: Schema.Array(SourceImportRejectedItem),
})
export type SourceImportResponse = Schema.Schema.Type<typeof SourceImportResponse>
