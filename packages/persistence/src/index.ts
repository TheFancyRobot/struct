/**
 * @struct/persistence — Repository services, migrations, and persistence errors.
 *
 * Layer 1 package. May import @struct/domain only.
 *
 * Migration executor uniqueness: only apps/api may run migrations.
 * This package defines the migration runner contract; apps/api owns the pool.
 */

// Migration runner — applies/reverts SQL migrations.
export { runMigrationsUp, runMigrationsDown } from './migrations/runner.js'
export type { SqlExecutor, SqlExecutorWithTransactions, MigrationError } from './migrations/runner.js'
export { migrations } from './migrations/manifest.js'
export type { Migration } from './migrations/manifest.js'

// Repository services and decode functions.
export {
  // DecodeError
  DecodeError,
  // Decode functions
  decodeWorkspaceRow,
  decodeProjectRow,
  decodeSourceRow,
  decodeSourceVersionRow,
  decodeResearchThreadRow,
  decodeResearchRunRow,
  decodeCitationRow,
  decodeJobQueueRow,
  decodeEventJournalRow,
  // Repository Effect.Services
  WorkspaceRepo,
  ProjectRepo,
  ProjectConflictError,
  SourceRepo,
  SourceVersionRepo,
  ResearchThreadRepo,
  ResearchRunRepo,
  CitationRepo,
  JobQueueRepo,
  EventJournalReader,
  SourceRegistrationRepo,
  SourceCatalogRepo,
  SourceCatalogPersistenceError,
  ResearchExecutionRepo,
  ResearchProjectionRepo,
  SourceTextReindexRepo,
  DocumentChunkRepo,
  DirectoryIngestionJobRepo,
  DirectorySourceVersionRepo,
  DirectoryControlRepo,
  DirectoryControlConflictError,
  DatasetCatalogRepo,
  DatasetCatalogScopeError,
  DatasetCatalogConflictError,
  DatasetCatalogDecodeError,
  DatasetCatalogQueryError,
  DatasetMaterializationRepo,
  DatasetMaterialization,
  DatasetMaterializationEnqueueInput,
  DatasetMaterializationPersistenceError,
  DatasetMaterializationOwnershipLostError,
  DatasetMaterializationScopeError,
  DatasetMaterializationConflictError,
  DatasetQueryEvidenceRepo,
  DatasetQueryEvidencePersistenceError,
  DatasetQueryEvidenceScopeError,
  DatasetQueryEvidenceConflictError,
  DatasetCitationValidationError,
  ProvenanceGraphRepo,
  ProvenanceGraphPersistenceError,
  ProvenanceGraphScopeError,
  ProvenanceGraphConflictError,
  ProvenanceGraphDecodeError,
  ProvenanceDocumentScopeError,
  DurableArtifactsRepo,
  DurableArtifactPersistenceError,
  DurableArtifactScopeError,
  DurableArtifactConflictError,
  DurableArtifactStaleWriteError,
  DurableArtifactDecodeError,
  NoteRepo,
  NoteConflictError,
  NoteNotFoundError,
  NoteProvenanceError,
  // Persistence errors
  QueryError,
  EntityNotFoundError,
  UniqueConstraintError,
  ResearchJobOwnershipLostError,
  IngestionJobOwnershipLostError,
  IngestionEventValidationError,
  DocumentChunkValidationError,
  SourceTextReindexOwnershipLostError,
  // SQL Client
  SqlClient,
  SqlClientLive,
  SqlClientTest,
} from './repositories/index.js'

// Repository row types (for implementation consumers).
export type {
  WorkspaceRow,
  ProjectRow,
  SourceRow,
  SourceVersionRow,
  ResearchThreadRow,
  ResearchRunRow,
  CitationRow,
  JobQueueRow,
  EventJournalRow,
} from './repositories/decode.js'

// Repository interface types (for consumers).
export type {
  WorkspaceRepository,
  ProjectListOptions,
  ProjectListPageResult,
  ProjectRepository,
  SourceRepository,
  SourceVersionRepository,
  ResearchThreadRepository,
  ResearchRunRepository,
  CitationRepository,
  JobQueueRepository,
  EventJournalReadRepository,
} from './repositories/interfaces.js'

export type { PersistenceError } from './errors.js'

export type {
  SourceRegistrationInput,
  SourceRegistrationJobPayload,
  SourceRegistrationEventPayload,
  SourceRegistrationResult,
  SourceRegistrationRepository,
  SourceRegistrationError,
} from './repositories/source-registration.js'

export type {
  CancelResearchInput,
  CancelResearchResult,
  CompleteResearchInput,
  DurableResearchState,
  FailResearchInput,
  PersistResearchCheckpointInput,
  PersistResearchPlanInput,
  PersistResearchPlanningFailureInput,
  ResearchExecutionError,
  ResearchRegistrationInput,
  ResearchRegistrationResult,
} from './repositories/research-execution.js'

export type {
  CreateNoteInput,
  UpdateNoteInput,
} from './repositories/notes.js'

export type {
  CompletedResearchProjection,
  CitationSourceProjection,
} from './repositories/research-projections.js'

export type { SourceTextReindexJob } from './repositories/source-text-reindex.js'

export type {
  CommitDirectoryRefreshInput,
  CommitDirectoryRefreshResult,
  DirectoryRefreshResult,
  PreparedChunkEmbedding,
  PreparedDirectorySourceVersion,
} from './repositories/source-versions.js'

export type {
  ControlDirectoryIngestionInput,
  DirectoryControlRepositoryError,
  DirectoryControlResult,
  DirectoryJournalEvent,
  RegisterDirectoryInput,
} from './repositories/directory-controls.js'

export type {
  CatalogWriteResult,
  DatasetCatalogError,
} from './repositories/dataset-catalog.js'

export type {
  DatasetMaterializationJob,
  DatasetQuerySnapshotRequest,
  ResolvedDatasetQuerySnapshot,
} from './repositories/dataset-materializations.js'

export type {
  DatasetQueryEvidenceError,
} from './repositories/dataset-query-evidence.js'

export type {
  ProvenanceDocumentEvidenceProjection,
  ProvenanceGraphRepositoryError,
} from './repositories/provenance-graph.js'
