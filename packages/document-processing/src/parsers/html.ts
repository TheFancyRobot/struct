import { Effect } from 'effect'
import { parse } from 'parse5'
import { DocumentProcessingError } from '../errors.js'
import { normalizeDocument } from '../normalize-document.js'

const decoder = new TextDecoder('utf-8', { fatal: true })
const MAX_HTML_DEPTH = 256
const blockTags = new Set(['p', 'li', 'pre', 'blockquote', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const ignoredTags = new Set(['script', 'style', 'noscript'])

interface HtmlNode { readonly nodeName?: string; readonly tagName?: string; readonly value?: string; readonly childNodes?: ReadonlyArray<HtmlNode> }
const assertSupportedDepth = (depth: number): void => {
  if (depth > MAX_HTML_DEPTH) throw new Error('HTML nesting exceeds the supported depth')
}
const nodeText = (node: HtmlNode, depth = 0): string => {
  assertSupportedDepth(depth)
  return node.tagName !== undefined && ignoredTags.has(node.tagName.toLowerCase())
    ? ''
    : node.tagName?.toLowerCase() === 'br'
      ? '\n'
    : node.value ?? (node.childNodes ?? []).map((child) => nodeText(child, depth + 1)).join('')
}
const containsBlock = (node: HtmlNode, depth = 0): boolean => {
  assertSupportedDepth(depth)
  const tag = node.tagName?.toLowerCase()
  if (tag && ignoredTags.has(tag)) return false
  if (tag && blockTags.has(tag)) return true
  return (node.childNodes ?? []).some((child) => containsBlock(child, depth + 1))
}

export const parseHtml = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const document = parse(decoder.decode(bytes)) as HtmlNode
      const fragments: Array<{ text: string; section: string | null; paragraph: number }> = []
      let section: string | null = null
      let paragraph = 0
      const visit = (node: HtmlNode, depth = 0): void => {
        assertSupportedDepth(depth)
        const tag = node.tagName?.toLowerCase()
        if (tag && ignoredTags.has(tag)) return
        if (tag && blockTags.has(tag)) {
          if (tag !== 'pre' && (node.childNodes ?? []).some((child) => containsBlock(child, depth + 1))) {
            for (const child of node.childNodes ?? []) visit(child, depth + 1)
            return
          }
          const text = tag === 'pre'
            ? nodeText(node, depth).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
            : nodeText(node, depth).replace(/\s+/g, ' ').trim()
          if (/^h[1-6]$/.test(tag)) section = text || null
          if (text) fragments.push({ text, section, paragraph: ++paragraph })
          return
        }
        if ((tag || node.value !== undefined) && !containsBlock(node, depth)) {
          const text = nodeText(node, depth).replace(/\s+/g, ' ').trim()
          if (text) fragments.push({ text, section, paragraph: ++paragraph })
          return
        }
        for (const child of node.childNodes ?? []) visit(child, depth + 1)
      }
      visit(document)
      return normalizeDocument('html', fragments)
    },
    catch: () => new DocumentProcessingError({ reason: 'invalid-html', message: 'HTML document could not be parsed' }),
  })
