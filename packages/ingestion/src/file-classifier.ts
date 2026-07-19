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
  readonly extension: '.txt' | '.md' | '.html' | '.htm' | '.pdf' | '.ts' | '.tsx' | '.js' | '.jsx' | '.json' | '.css' | '.py' | '.go' | '.rs'
  readonly mediaType: 'text/plain' | 'text/markdown' | 'text/html' | 'application/pdf' | 'application/json' | 'text/css' | 'application/javascript'
  readonly kind: Extract<SourceKind, 'document'>
}

const DEFAULT_MAX_TEXT_SOURCE_BYTES = 1_048_576

function extensionFor(name: string): TextSourceClassification['extension'] | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.txt')) return '.txt'
  if (lower.endsWith('.md')) return '.md'
  if (lower.endsWith('.html')) return '.html'
  if (lower.endsWith('.htm')) return '.htm'
  if (lower.endsWith('.pdf')) return '.pdf'
  for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.py', '.go', '.rs'] as const) if (lower.endsWith(extension)) return extension
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
      message: 'Source extension is not supported for deterministic document parsing',
      })
    }

    if (extension === '.txt' && input.mediaType === 'text/plain') {
      return { extension, mediaType: 'text/plain', kind: 'document' as const }
    }
    if (extension === '.md' && input.mediaType === 'text/markdown') {
      return { extension, mediaType: 'text/markdown', kind: 'document' as const }
    }
    if ((extension === '.html' || extension === '.htm') && input.mediaType === 'text/html') return { extension, mediaType: 'text/html', kind: 'document' as const }
    if (extension === '.pdf' && input.mediaType === 'application/pdf') return { extension, mediaType: 'application/pdf', kind: 'document' as const }
    if (extension === '.json' && input.mediaType === 'application/json') return { extension, mediaType: 'application/json', kind: 'document' as const }
    if (extension === '.css' && input.mediaType === 'text/css') return { extension, mediaType: 'text/css', kind: 'document' as const }
    if (['.js', '.jsx'].includes(extension) && input.mediaType === 'application/javascript') return { extension, mediaType: 'application/javascript', kind: 'document' as const }
    if (['.ts', '.tsx', '.py', '.go', '.rs'].includes(extension) && input.mediaType === 'text/plain') return { extension, mediaType: 'text/plain', kind: 'document' as const }

    return yield* new UnsupportedSourceTypeError({
      name: input.name,
      mediaType: input.mediaType,
      message: 'Text source media type does not match its extension',
    })
  })
