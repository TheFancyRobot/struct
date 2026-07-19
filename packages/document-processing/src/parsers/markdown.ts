import { Effect } from 'effect'
import { DocumentProcessingError } from '../errors.js'
import { normalizeSourceDocument } from '../normalize-document.js'

const decoder = new TextDecoder('utf-8', { fatal: true })

export const parseMarkdown = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const source = decoder.decode(bytes)
      let section: string | null = null
      let paragraph = 0
      const fragments = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n{2,}/).map((text) => {
        const heading = /^#{1,6}\s+(.+)$/m.exec(text)
        if (heading) section = heading[1]?.trim() ?? null
        paragraph += 1
        return { text, section, paragraph }
      })
      return normalizeSourceDocument('markdown', source, fragments)
    },
    catch: () => new DocumentProcessingError({ reason: 'invalid-utf8', message: 'Markdown document is not valid UTF-8' }),
  })
