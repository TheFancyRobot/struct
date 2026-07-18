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
  // Repository Effect.Services
  WorkspaceRepo,
  ProjectRepo,
  SourceRepo,
  SourceVersionRepo,
  ResearchThreadRepo,
  ResearchRunRepo,
  CitationRepo,
  // Persistence errors
  QueryError,
  EntityNotFoundError,
  UniqueConstraintError,
  // SQL Client
  SqlClient,
  SqlClientLive,
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
} from './repositories/interfaces.js'
