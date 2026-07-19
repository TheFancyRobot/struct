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
  SourceRepo,
  SourceVersionRepo,
  ResearchThreadRepo,
  ResearchRunRepo,
  CitationRepo,
  JobQueueRepo,
  EventJournalReader,
  SourceRegistrationRepo,
  ResearchExecutionRepo,
  ResearchProjectionRepo,
  SourceTextReindexRepo,
  // Persistence errors
  QueryError,
  EntityNotFoundError,
  UniqueConstraintError,
  ResearchJobOwnershipLostError,
  IngestionJobOwnershipLostError,
  IngestionEventValidationError,
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
  ResearchRegistrationInput,
  ResearchRegistrationResult,
  CompleteResearchInput,
  FailResearchInput,
  ResearchExecutionError,
} from './repositories/research-execution.js'

export type {
  CompletedResearchProjection,
  CitationSourceProjection,
} from './repositories/research-projections.js'

export type { SourceTextReindexJob } from './repositories/source-text-reindex.js'
