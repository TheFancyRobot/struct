import { Effect } from 'effect'
import { parse } from 'parse5'
import { DocumentProcessingError } from '../errors.js'
import { normalizeDocument } from '../normalize-document.js'

const decoder = new TextDecoder('utf-8', { fatal: true })
const blockTags = new Set(['p', 'li', 'pre', 'blockquote', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const ignoredTags = new Set(['script', 'style', 'noscript'])

interface HtmlNode { readonly nodeName?: string; readonly tagName?: string; readonly value?: string; readonly childNodes?: ReadonlyArray<HtmlNode> }
const nodeText = (node: HtmlNode): string =>
  node.tagName !== undefined && ignoredTags.has(node.tagName.toLowerCase())
    ? ''
    : node.value ?? (node.childNodes ?? []).map(nodeText).join('')

export const parseHtml = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const document = parse(decoder.decode(bytes)) as HtmlNode
      const fragments: Array<{ text: string; section: string | null; paragraph: number }> = []
      let section: string | null = null
      let paragraph = 0
      const visit = (node: HtmlNode): void => {
        const tag = node.tagName?.toLowerCase()
        if (tag && ignoredTags.has(tag)) return
        if (tag && blockTags.has(tag)) {
          const text = nodeText(node).replace(/\s+/g, ' ').trim()
          if (/^h[1-6]$/.test(tag)) section = text || null
          if (text) fragments.push({ text, section, paragraph: ++paragraph })
          return
        }
        for (const child of node.childNodes ?? []) visit(child)
      }
      visit(document)
      return normalizeDocument('html', fragments)
    },
    catch: () => new DocumentProcessingError({ reason: 'invalid-html', message: 'HTML document could not be parsed' }),
  })
