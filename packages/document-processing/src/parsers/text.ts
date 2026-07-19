import { Effect } from 'effect'
import { DocumentProcessingError } from '../errors.js'
import { normalize, normalizeSourceDocument } from '../normalize-document.js'

const decoder = new TextDecoder('utf-8', { fatal: true })

export const parseText = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const source = decoder.decode(bytes)
      const fragments = normalize(source)
        .split(/\n{2,}/)
        .filter((text) => text.trim().length > 0)
        .map((text, index) => ({ text, paragraph: index + 1 }))
      return normalizeSourceDocument('text', source, fragments)
    },
    catch: () => new DocumentProcessingError({ reason: 'invalid-utf8', message: 'Text document is not valid UTF-8' }),
  })
