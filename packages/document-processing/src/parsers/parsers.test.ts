import { describe, expect, it } from 'bun:test'
import { Cause, Effect, Exit } from 'effect'
import { parseHtml } from './html.js'
import { parseMarkdown } from './markdown.js'
import { parseText } from './text.js'
import { extractPdfPageParagraphs, isOcrHeavyPdf, parsePdf } from './pdf.js'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

function pdfFixture(text: string): Uint8Array {
  const stream = text.length === 0
    ? ''
    : `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return encode(body)
}

describe('document parsers', () => {
  it('preserves deterministic Markdown section, paragraph, character, and byte provenance', async () => {
    const document = await Effect.runPromise(parseMarkdown(encode('# Intro\r\n\r\nHello café')))
    expect(document).toMatchObject({ format: 'markdown', text: '# Intro\n\nHello café' })
    expect(document.fragments).toMatchObject([
      { section: 'Intro', paragraph: 1, charStart: 0, byteStart: 0, charEnd: 7, byteEnd: 7 },
      { section: 'Intro', paragraph: 2, charStart: 9, byteStart: 9, charEnd: 19, byteEnd: 20 },
    ])
  })

  it('preserves source whitespace and round-trips multibyte locator slices', async () => {
    const document = await Effect.runPromise(parseText(encode('  indented café\n')))
    expect(document.text).toBe('  indented café\n')
    const [fragment] = document.fragments
    expect(fragment).toBeDefined()
    if (fragment === undefined) return
    expect(document.text.slice(fragment.charStart, fragment.charEnd)).toBe(fragment.text)
    expect(encode(document.text.slice(0, fragment.charStart)).byteLength).toBe(fragment.byteStart)
    expect(encode(document.text.slice(0, fragment.charEnd)).byteLength).toBe(fragment.byteEnd)
  })

  it('numbers only non-empty Markdown and text paragraphs', async () => {
    const markdown = await Effect.runPromise(parseMarkdown(encode('\n\n# Intro\n\nBody\n\n')))
    const text = await Effect.runPromise(parseText(encode('\n\nFirst\n\nSecond\n\n')))
    expect(markdown.fragments.map((fragment) => fragment.paragraph)).toEqual([1, 2])
    expect(text.fragments.map((fragment) => fragment.paragraph)).toEqual([1, 2])
  })

  it('splits Markdown headings at block boundaries and ignores headings inside fences', async () => {
    const document = await Effect.runPromise(parseMarkdown(encode('Intro\n# Details\nBody\n```\n# not a heading\n```')))
    expect(document.fragments).toMatchObject([
      { text: 'Intro', section: null, paragraph: 1 },
      { text: '# Details', section: 'Details', paragraph: 2 },
      { text: 'Body', section: 'Details', paragraph: 3 },
      { text: '```\n# not a heading\n```', section: 'Details', paragraph: 4 },
    ])
  })

  it('keeps shorter and code-suffixed fence markers inside a longer fenced block', async () => {
    const document = await Effect.runPromise(parseMarkdown(encode('````ts\n``` code\n# hidden\n````\n# Visible\nBody')))
    expect(document.fragments).toMatchObject([
      { text: '````ts\n``` code\n# hidden\n````', section: null, paragraph: 1 },
      { text: '# Visible', section: 'Visible', paragraph: 2 },
      { text: 'Body', section: 'Visible', paragraph: 3 },
    ])
  })

  it('extracts HTML blocks while excluding nested script content', async () => {
    const document = await Effect.runPromise(parseHtml(encode('<h1>Guide</h1><p>Safe<br><script>secret()</script>text</p><p>More</p>')))
    expect(document.text).toBe('Guide\n\nSafe text\n\nMore')
    expect(document.fragments).toEqual(expect.arrayContaining([expect.objectContaining({ section: 'Guide', paragraph: 2, text: 'Safe text' })]))
    expect(document.text).not.toContain('secret')
  })

  it('extracts loose inline HTML text without splitting word boundaries', async () => {
    const document = await Effect.runPromise(parseHtml(encode('<div>loose <span>inline</span> text</div>')))
    expect(document.text).toBe('loose inline text')
    expect(document.fragments).toMatchObject([{ paragraph: 1, text: 'loose inline text' }])
  })

  it('rejects adversarial HTML nesting through the typed parser error', async () => {
    const nested = `${'<div>'.repeat(300)}text${'</div>'.repeat(300)}`
    const result = await Effect.runPromiseExit(parseHtml(encode(nested)))
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') expect(failure.value).toMatchObject({ reason: 'invalid-html' })
    }
  })

  it('rejects malformed UTF-8 rather than replacing invalid bytes', async () => {
    const result = await Effect.runPromiseExit(parseText(new Uint8Array([0xff])))
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') expect(failure.value).toMatchObject({ _tag: 'DocumentProcessingError', reason: 'invalid-utf8' })
    }
  })

  it('marks a majority of pages without embedded text as OCR-heavy', () => {
    expect(isOcrHeavyPdf(['Hi', ''])).toBe(false)
    expect(isOcrHeavyPdf(['Hi', '', ''])).toBe(true)
    expect(isOcrHeavyPdf(['Hi'])).toBe(false)
  })

  it('preserves PDF paragraph boundaries inferred from page layout', () => {
    expect(extractPdfPageParagraphs([
      { str: 'First line', hasEOL: true, height: 12, transform: [1, 0, 0, 12, 72, 720] },
      { str: 'continues', hasEOL: true, height: 12, transform: [1, 0, 0, 12, 72, 706] },
      { str: 'Second paragraph', height: 12, transform: [1, 0, 0, 12, 72, 670] },
    ])).toEqual(['First line continues', 'Second paragraph'])
  })

  it('extracts a real embedded-text PDF through pdfjs with page provenance', async () => {
    const document = await Effect.runPromise(parsePdf(pdfFixture('Embedded launch text')))
    expect(document).toMatchObject({
      format: 'pdf',
      text: 'Embedded launch text',
      fragments: [{ page: 1, text: 'Embedded launch text' }],
    })
  })

  it('rejects a real PDF without embedded text as OCR-heavy', async () => {
    const result = await Effect.runPromiseExit(parsePdf(pdfFixture('')))
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') expect(failure.value).toMatchObject({ reason: 'ocr-heavy-pdf' })
    }
  })
})
