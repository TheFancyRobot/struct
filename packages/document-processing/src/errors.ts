import { Schema } from 'effect'

export class DocumentProcessingError extends Schema.TaggedError<DocumentProcessingError>()(
  'DocumentProcessingError',
  { reason: Schema.String, message: Schema.String },
) {}
