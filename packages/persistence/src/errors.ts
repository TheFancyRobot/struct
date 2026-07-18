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
 * Union of all persistence errors.
 */
export type PersistenceError = QueryError | EntityNotFoundError | UniqueConstraintError
