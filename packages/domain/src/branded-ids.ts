import { Schema } from 'effect'

/**
 * Branded UUID type for domain entities.
 * Each entity type gets its own branded ID to prevent accidental mixing.
 */
export const BrandedUUID = Schema.UUID.pipe(
  Schema.brand('BrandedUUID'),
)

/** WorkspaceId — identity of a workspace. */
export const WorkspaceId = BrandedUUID.pipe(Schema.brand('WorkspaceId'))
export type WorkspaceId = Schema.Schema.Type<typeof WorkspaceId>

/** ProjectId — identity of a research project. */
export const ProjectId = BrandedUUID.pipe(Schema.brand('ProjectId'))
export type ProjectId = Schema.Schema.Type<typeof ProjectId>

/** SourceId — identity of a logical source. */
export const SourceId = BrandedUUID.pipe(Schema.brand('SourceId'))
export type SourceId = Schema.Schema.Type<typeof SourceId>

/** SourceVersionId — identity of an immutable source version. */
export const SourceVersionId = BrandedUUID.pipe(Schema.brand('SourceVersionId'))
export type SourceVersionId = Schema.Schema.Type<typeof SourceVersionId>

/** DirectoryRootId — identity of one registered, workspace-scoped directory root. */
export const DirectoryRootId = BrandedUUID.pipe(Schema.brand('DirectoryRootId'))
export type DirectoryRootId = Schema.Schema.Type<typeof DirectoryRootId>

/** DirectorySnapshotId — identity of one immutable directory inventory. */
export const DirectorySnapshotId = BrandedUUID.pipe(Schema.brand('DirectorySnapshotId'))
export type DirectorySnapshotId = Schema.Schema.Type<typeof DirectorySnapshotId>

/** ManifestEntryId — identity of one immutable entry within a directory snapshot. */
export const ManifestEntryId = BrandedUUID.pipe(Schema.brand('ManifestEntryId'))
export type ManifestEntryId = Schema.Schema.Type<typeof ManifestEntryId>

/** DocumentId — identity of normalized content for one immutable source version. */
export const DocumentId = BrandedUUID.pipe(Schema.brand('DocumentId'))
export type DocumentId = Schema.Schema.Type<typeof DocumentId>

/** DocumentChunkId — identity of one immutable, versioned retrieval unit. */
export const DocumentChunkId = BrandedUUID.pipe(Schema.brand('DocumentChunkId'))
export type DocumentChunkId = Schema.Schema.Type<typeof DocumentChunkId>

/** ResearchThreadId — identity of a research conversation thread. */
export const ResearchThreadId = BrandedUUID.pipe(Schema.brand('ResearchThreadId'))
export type ResearchThreadId = Schema.Schema.Type<typeof ResearchThreadId>

/** ResearchRunId — identity of a single research run. */
export const ResearchRunId = BrandedUUID.pipe(Schema.brand('ResearchRunId'))
export type ResearchRunId = Schema.Schema.Type<typeof ResearchRunId>

/** CitationId — identity of a citation. */
export const CitationId = BrandedUUID.pipe(Schema.brand('CitationId'))
export type CitationId = Schema.Schema.Type<typeof CitationId>

/** FindingId — identity of a saved finding. */
export const FindingId = BrandedUUID.pipe(Schema.brand('FindingId'))
export type FindingId = Schema.Schema.Type<typeof FindingId>

/** ReportId — identity of a research report. */
export const ReportId = BrandedUUID.pipe(Schema.brand('ReportId'))
export type ReportId = Schema.Schema.Type<typeof ReportId>

/** DatasetId — identity of a dataset. */
export const DatasetId = BrandedUUID.pipe(Schema.brand('DatasetId'))
export type DatasetId = Schema.Schema.Type<typeof DatasetId>

/** DatasetSnapshotId — identity of an immutable dataset snapshot. */
export const DatasetSnapshotId = BrandedUUID.pipe(Schema.brand('DatasetSnapshotId'))
export type DatasetSnapshotId = Schema.Schema.Type<typeof DatasetSnapshotId>

/** QueryResultSnapshotId — identity of an immutable query result snapshot. */
export const QueryResultSnapshotId = BrandedUUID.pipe(Schema.brand('QueryResultSnapshotId'))
export type QueryResultSnapshotId = Schema.Schema.Type<typeof QueryResultSnapshotId>

/** EventJournalId — identity of a journal entry. */
export const EventJournalId = BrandedUUID.pipe(Schema.brand('EventJournalId'))
export type EventJournalId = Schema.Schema.Type<typeof EventJournalId>

/** JobQueueId — identity of a durable worker job. */
export const JobQueueId = BrandedUUID.pipe(Schema.brand('JobQueueId'))
export type JobQueueId = Schema.Schema.Type<typeof JobQueueId>
