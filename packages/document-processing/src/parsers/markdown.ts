import { Effect } from 'effect'
import { DocumentProcessingError } from '../errors.js'
import { normalize, normalizeSourceDocument } from '../normalize-document.js'

const decoder = new TextDecoder('utf-8', { fatal: true })

export const parseMarkdown = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const source = decoder.decode(bytes)
      const normalizedSource = normalize(source)
      let section: string | null = null
      let paragraph = 0
      const fragments = normalizedSource.split(/\n{2,}/).filter((text) => text.trim().length > 0).map((text) => {
        const heading = /^#{1,6}\s+(.+)$/m.exec(text)
        if (heading) section = heading[1]?.trim() ?? null
        paragraph += 1
        return { text, section, paragraph }
      })
      return normalizeSourceDocument('markdown', source, fragments)
    },
    catch: () => new DocumentProcessingError({ reason: 'invalid-utf8', message: 'Markdown document is not valid UTF-8' }),
  })
