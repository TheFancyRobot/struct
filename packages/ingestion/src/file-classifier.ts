import { Effect } from 'effect'
import {
  SourceTooLargeError,
  UnsupportedSourceTypeError,
  type SourceKind,
} from '@struct/domain'

export { SourceTooLargeError, UnsupportedSourceTypeError }

export interface TextSourceClassificationInput {
  readonly name: string
  readonly mediaType: string
  readonly byteLength: number
  readonly maxBytes?: number
}

export interface TextSourceClassification {
  readonly extension: '.txt' | '.md'
  readonly mediaType: 'text/plain' | 'text/markdown'
  readonly kind: Extract<SourceKind, 'document'>
}

const DEFAULT_MAX_TEXT_SOURCE_BYTES = 1_048_576

function extensionFor(name: string): '.txt' | '.md' | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.txt')) return '.txt'
  if (lower.endsWith('.md')) return '.md'
  return null
}

export const classifyTextSource = (
  input: TextSourceClassificationInput,
): Effect.Effect<TextSourceClassification, UnsupportedSourceTypeError | SourceTooLargeError, never> =>
  Effect.gen(function* () {
    const maxBytes = input.maxBytes ?? DEFAULT_MAX_TEXT_SOURCE_BYTES
    if (input.byteLength > maxBytes) {
      return yield* new SourceTooLargeError({
        name: input.name,
        byteLength: input.byteLength,
        maxBytes,
        message: 'Text source exceeds the configured byte cap',
      })
    }

    const extension = extensionFor(input.name)
    if (!extension) {
      return yield* new UnsupportedSourceTypeError({
        name: input.name,
        mediaType: input.mediaType,
        message: 'Only .txt text/plain and .md text/markdown sources are supported in this slice',
      })
    }

    if (extension === '.txt' && input.mediaType === 'text/plain') {
      return { extension, mediaType: 'text/plain', kind: 'document' as const }
    }
    if (extension === '.md' && input.mediaType === 'text/markdown') {
      return { extension, mediaType: 'text/markdown', kind: 'document' as const }
    }

    return yield* new UnsupportedSourceTypeError({
      name: input.name,
      mediaType: input.mediaType,
      message: 'Text source media type does not match its extension',
    })
  })
