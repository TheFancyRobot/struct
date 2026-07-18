import { Schema } from 'effect'

// --- Schema.TaggedError definitions ---

export class NotFoundError extends Schema.TaggedError<NotFoundError>()('NotFoundError', {
  entityType: Schema.String,
  entityId: Schema.String,
  message: Schema.String,
}) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()('ValidationError', {
  field: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}

export class AuthorizationError extends Schema.TaggedError<AuthorizationError>()('AuthorizationError', {
  detail: Schema.String,
  message: Schema.String,
}) {}

export class CitationValidationError extends Schema.TaggedError<CitationValidationError>()('CitationValidationError', {
  citationId: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}

export class SourceVersionError extends Schema.TaggedError<SourceVersionError>()('SourceVersionError', {
  sourceVersionId: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}
