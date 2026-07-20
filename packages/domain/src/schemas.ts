import { Schema } from 'effect'
import * as Ids from './branded-ids.js'
import { DatasetCitation } from './dataset-query-evidence.js'
export { SourceVersion } from './source-version.js'

// --- Enums / Literals ---

export const SourceKind = Schema.Union(
  Schema.Literal('document'),
  Schema.Literal('dataset'),
  Schema.Literal('directory'),
  Schema.Literal('file'),
)
export type SourceKind = Schema.Schema.Type<typeof SourceKind>

export const IngestionStatus = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('in-progress'),
  Schema.Literal('completed'),
  Schema.Literal('failed'),
  Schema.Literal('cancelled'),
)
export type IngestionStatus = Schema.Schema.Type<typeof IngestionStatus>

export const JobStatus = IngestionStatus
export type JobStatus = Schema.Schema.Type<typeof JobStatus>

export const ResearchStatus = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('in-progress'),
  Schema.Literal('completed'),
  Schema.Literal('failed'),
  Schema.Literal('cancelled'),
  Schema.Literal('partial'),
)
export type ResearchStatus = Schema.Schema.Type<typeof ResearchStatus>

export const CitationStatus = Schema.Union(
  Schema.Literal('validated'),
  Schema.Literal('invalid'),
  Schema.Literal('stale'),
)
export type CitationStatus = Schema.Schema.Type<typeof CitationStatus>

// --- Domain Objects ---

export const Workspace = Schema.Struct({
  id: Ids.WorkspaceId,
  name: Schema.String,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const Project = Schema.Struct({
  id: Ids.ProjectId,
  workspaceId: Ids.WorkspaceId,
  name: Schema.String,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const Source = Schema.Struct({
  id: Ids.SourceId,
  projectId: Ids.ProjectId,
  name: Schema.String,
  kind: SourceKind,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const ResearchThread = Schema.Struct({
  id: Ids.ResearchThreadId,
  projectId: Ids.ProjectId,
  title: Schema.String,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const ResearchRun = Schema.Struct({
  id: Ids.ResearchRunId,
  threadId: Ids.ResearchThreadId,
  question: Schema.String,
  status: ResearchStatus,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const Citation = Schema.Struct({
  id: Ids.CitationId,
  runId: Ids.ResearchRunId,
  sourceVersionId: Ids.SourceVersionId,
  locator: Schema.String,
  status: CitationStatus,
  createdAt: Schema.BigIntFromNumber,
})

export const TextEvidence = Schema.Struct({
  sourceVersionId: Ids.SourceVersionId,
  locator: Schema.String,
  excerpt: Schema.String,
  rank: Schema.Number,
})
export type TextEvidence = Schema.Schema.Type<typeof TextEvidence>

export const ResearchCitation = Schema.Struct({
  sourceVersionId: Ids.SourceVersionId,
  locator: Schema.String,
})
export type ResearchCitation = Schema.Schema.Type<typeof ResearchCitation>

export const ResearchAnswer = Schema.Struct({
  answer: Schema.String.pipe(
    Schema.minLength(1),
    Schema.pattern(/\S/),
  ),
  citations: Schema.Array(ResearchCitation),
  datasetCitations: Schema.optional(
    Schema.Array(DatasetCitation).pipe(Schema.maxItems(80)),
  ),
})
export type ResearchAnswer = Schema.Schema.Type<typeof ResearchAnswer>

export const Finding = Schema.Struct({
  id: Ids.FindingId,
  projectId: Ids.ProjectId,
  title: Schema.String,
  content: Schema.String,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const Report = Schema.Struct({
  id: Ids.ReportId,
  projectId: Ids.ProjectId,
  title: Schema.String,
  content: Schema.String,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const JobQueue = Schema.Struct({
  id: Ids.JobQueueId,
  workspaceId: Ids.WorkspaceId,
  entityType: Schema.String,
  entityId: Ids.BrandedUUID,
  status: JobStatus,
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  attempts: Schema.Number,
  maxAttempts: Schema.Number,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})

export const EventJournal = Schema.Struct({
  id: Ids.EventJournalId,
  workspaceId: Ids.WorkspaceId,
  entityType: Schema.String,
  entityId: Ids.BrandedUUID,
  eventType: Schema.String,
  payload: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  cursor: Schema.BigIntFromNumber,
  createdAt: Schema.BigIntFromNumber,
})
