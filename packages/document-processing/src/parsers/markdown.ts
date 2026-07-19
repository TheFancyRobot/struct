import { Effect } from 'effect'
import { DocumentProcessingError } from '../errors.js'
import { normalize, normalizeSourceDocument } from '../normalize-document.js'

const decoder = new TextDecoder('utf-8', { fatal: true })

interface MarkdownFragment {
  readonly text: string
  readonly section: string | null
  readonly paragraph: number
}

const markdownFragments = (source: string): ReadonlyArray<MarkdownFragment> => {
  const fragments: MarkdownFragment[] = []
  let section: string | null = null
  let paragraph = 0
  let lines: string[] = []
  let blockSection: string | null = null
  let fence: { readonly marker: '`' | '~'; readonly length: number } | null = null

  const flush = () => {
    const text = lines.join('\n').trim()
    lines = []
    if (!text) return
    fragments.push({ text, section: blockSection, paragraph: ++paragraph })
  }

  for (const line of source.split('\n')) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence !== null) {
      lines.push(line)
      if (
        fenceMatch?.[1]
        && fenceMatch[1][0] === fence.marker
        && fenceMatch[1].length >= fence.length
        && /^[ \t]*$/.test(line.slice(fenceMatch[0].length))
      ) {
        flush()
        fence = null
      }
      continue
    }
    if (fenceMatch?.[1]) {
      flush()
      blockSection = section
      fence = {
        marker: fenceMatch[1][0] === '`' ? '`' : '~',
        length: fenceMatch[1].length,
      }
      lines.push(line)
      continue
    }
    const heading = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line)
    if (heading) {
      flush()
      section = heading[1]?.trim() ?? null
      fragments.push({ text: line.trim(), section, paragraph: ++paragraph })
      blockSection = section
      continue
    }
    if (line.trim().length === 0) {
      flush()
      blockSection = section
      continue
    }
    if (lines.length === 0) blockSection = section
    lines.push(line)
  }
  flush()
  return fragments
}

export const parseMarkdown = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const source = decoder.decode(bytes)
      const normalizedSource = normalize(source)
      return normalizeSourceDocument('markdown', source, markdownFragments(normalizedSource))
    },
    catch: () => new DocumentProcessingError({ reason: 'invalid-utf8', message: 'Markdown document is not valid UTF-8' }),
  })
