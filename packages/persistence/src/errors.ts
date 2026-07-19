/**
 * Typed persistence errors for repository operations.
 *
 * These errors are specific and serializable (Schema.TaggedError),
 * enabling proper error handling at the app boundary.
 */

import { Schema } from 'effect'

/**
 * Error when a database query fails.
 */
export class QueryError extends Schema.TaggedError<QueryError>()('QueryError', {
  operation: Schema.String,
  entity: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

/**
 * Error when a requested entity is not found.
 */
export class EntityNotFoundError extends Schema.TaggedError<EntityNotFoundError>()('EntityNotFoundError', {
  entity: Schema.String,
  id: Schema.String,
  message: Schema.String,
}) {}

/**
 * Error when a unique constraint is violated (e.g., duplicate insert).
 */
export class UniqueConstraintError extends Schema.TaggedError<UniqueConstraintError>()('UniqueConstraintError', {
  entity: Schema.String,
  field: Schema.String,
  message: Schema.String,
}) {}

/**
 * Expected lease-loss outcome when a stale research worker no longer owns the
 * in-progress job row needed for an event or terminal transition.
 */
export class ResearchJobOwnershipLostError
  extends Schema.TaggedError<ResearchJobOwnershipLostError>()('ResearchJobOwnershipLostError', {
    transition: Schema.Literal('renew-lease', 'append-event', 'complete', 'fail'),
    message: Schema.String,
  }) {}

/**
 * Expected lease-loss outcome when an ingestion worker's claimed attempt no
 * longer owns the in-progress job row.
 */
export class IngestionJobOwnershipLostError
  extends Schema.TaggedError<IngestionJobOwnershipLostError>()('IngestionJobOwnershipLostError', {
    jobId: Schema.String,
    attempt: Schema.Number,
    transition: Schema.Literal(
      'renew-lease',
      'create-version',
      'append-event',
      'complete',
      'pending',
      'fail',
    ),
    message: Schema.String,
  }) {}

/**
 * A caller supplied an ingestion journal event that does not match the exact
 * contract for the requested transition.
 */
export class IngestionEventValidationError
  extends Schema.TaggedError<IngestionEventValidationError>()('IngestionEventValidationError', {
    transition: Schema.Literal('append-event', 'complete', 'pending', 'fail'),
    field: Schema.String,
    message: Schema.String,
  }) {}

/**
 * Expected lease-loss outcome when a source-text reindex worker's claimed
 * attempt no longer owns the in-progress reindex row.
 */
export class SourceTextReindexOwnershipLostError
  extends Schema.TaggedError<SourceTextReindexOwnershipLostError>()('SourceTextReindexOwnershipLostError', {
    sourceVersionId: Schema.String,
    attempt: Schema.Number,
    transition: Schema.Literal('renew-lease', 'index-text', 'record-failure'),
    message: Schema.String,
  }) {}

/**
 * Union of all persistence errors.
 */
export type PersistenceError =
  | QueryError
  | EntityNotFoundError
  | UniqueConstraintError
  | ResearchJobOwnershipLostError
  | IngestionJobOwnershipLostError
  | IngestionEventValidationError
  | SourceTextReindexOwnershipLostError
