import { Schema } from 'effect'

export class DocumentProcessingError extends Schema.TaggedError<DocumentProcessingError>()(
  'DocumentProcessingError',
  { reason: Schema.String, message: Schema.String },
) {}

export class DocumentChunkingError extends Schema.TaggedError<DocumentChunkingError>()(
  'DocumentChunkingError',
  {
    reason: Schema.Literal(
      'empty-document',
      'invalid-locator',
      'invalid-max-characters',
    ),
    fragment: Schema.optional(Schema.Number),
    message: Schema.String,
  },
) {}
