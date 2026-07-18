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

export class StorageConfigurationError extends Schema.TaggedError<StorageConfigurationError>()('StorageConfigurationError', {
  reason: Schema.String,
  message: Schema.String,
}) {}

export class StoragePathError extends Schema.TaggedError<StoragePathError>()('StoragePathError', {
  ref: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}

export class StorageReadError extends Schema.TaggedError<StorageReadError>()('StorageReadError', {
  ref: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}

export class StorageWriteError extends Schema.TaggedError<StorageWriteError>()('StorageWriteError', {
  operation: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}

export class UnsupportedSourceTypeError extends Schema.TaggedError<UnsupportedSourceTypeError>()('UnsupportedSourceTypeError', {
  name: Schema.String,
  mediaType: Schema.String,
  message: Schema.String,
}) {}

export class SourceTooLargeError extends Schema.TaggedError<SourceTooLargeError>()('SourceTooLargeError', {
  name: Schema.String,
  byteLength: Schema.Number,
  maxBytes: Schema.Number,
  message: Schema.String,
}) {}

export class IngestionFailureError extends Schema.TaggedError<IngestionFailureError>()('IngestionFailureError', {
  reason: Schema.String,
  message: Schema.String,
}) {}

export class JobClaimError extends Schema.TaggedError<JobClaimError>()('JobClaimError', {
  operation: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}
