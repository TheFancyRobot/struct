import { Effect } from 'effect'
import { DocumentProcessingError } from '../errors.js'
import { normalizeDocument } from '../normalize-document.js'

const MAX_PDF_PAGES = 1_000
const MAX_EXTRACTED_CHARACTERS = 5_000_000

export const isOcrHeavyPdf = (pageText: ReadonlyArray<string>): boolean =>
  pageText.length === 0
  || pageText.filter((text) => text.length === 0).length
    > pageText.length / 2

export interface PdfTextItem {
  readonly str?: string
  readonly hasEOL?: boolean
  readonly height?: number
  readonly transform?: ReadonlyArray<number>
}
interface PdfPage { getTextContent(): Promise<{ readonly items: ReadonlyArray<PdfTextItem> }> }
interface PdfDocument { readonly numPages: number; getPage(pageNumber: number): Promise<PdfPage>; destroy(): Promise<void> }
interface PdfLoadingTask { readonly promise: Promise<PdfDocument>; destroy(): Promise<void> }
interface PdfJs { getDocument(input: { readonly data: Uint8Array; readonly useWorkerFetch: false; readonly isEvalSupported: false; readonly standardFontDataUrl: string; readonly useSystemFonts: true }): PdfLoadingTask }

interface PdfLine {
  readonly text: string
  readonly y: number | undefined
  readonly height: number
}

export const extractPdfPageParagraphs = (items: ReadonlyArray<PdfTextItem>): ReadonlyArray<string> => {
  const lines: PdfLine[] = []
  let words: string[] = []
  let lineY: number | undefined
  let lineHeight = 0

  const flushLine = () => {
    const text = words.join(' ').replace(/\s+/g, ' ').trim()
    words = []
    if (text) lines.push({ text, y: lineY, height: lineHeight })
    lineY = undefined
    lineHeight = 0
  }

  for (const item of items) {
    const itemY = item.transform?.[5]
    const itemHeight = item.height ?? Math.abs(item.transform?.[3] ?? 0)
    if (
      words.length > 0
      && lineY !== undefined
      && itemY !== undefined
      && Math.abs(itemY - lineY) > Math.max(1, itemHeight * 0.5)
    ) flushLine()
    const text = item.str?.replace(/\s+/g, ' ').trim()
    if (text) words.push(text)
    lineY ??= itemY
    lineHeight = Math.max(lineHeight, itemHeight)
    if (item.hasEOL) flushLine()
  }
  flushLine()

  const paragraphs: string[] = []
  let paragraphLines: string[] = []
  let previous: PdfLine | undefined
  const flushParagraph = () => {
    const text = paragraphLines.join(' ').trim()
    paragraphLines = []
    if (text) paragraphs.push(text)
  }
  for (const line of lines) {
    if (
      previous?.y !== undefined
      && line.y !== undefined
      && Math.abs(previous.y - line.y) > Math.max(previous.height, line.height, 1) * 1.6
    ) flushParagraph()
    paragraphLines.push(line.text)
    previous = line
  }
  flushParagraph()
  return paragraphs
}

export const parsePdf = (bytes: Uint8Array) =>
  Effect.tryPromise({
    try: async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as PdfJs
      const standardFontDataUrl = new URL(
        '../../standard_fonts/',
        import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'),
      ).href
      const loadingTask = pdfjs.getDocument({
        data: bytes,
        useWorkerFetch: false,
        isEvalSupported: false,
        standardFontDataUrl,
        useSystemFonts: true,
      })
      let document: PdfDocument | undefined
      try {
        document = await loadingTask.promise
        if (document.numPages > MAX_PDF_PAGES) {
          throw new DocumentProcessingError({ reason: 'document-too-large', message: 'PDF page count exceeds the supported limit' })
        }
        const pages: ReadonlyArray<string>[] = []
        let extractedCharacters = 0
        for (let index = 0; index < document.numPages; index += 1) {
          const content = await (await document.getPage(index + 1)).getTextContent()
          const paragraphs = extractPdfPageParagraphs(content.items)
          extractedCharacters += paragraphs.reduce((total, text) => total + text.length, 0)
          if (extractedCharacters > MAX_EXTRACTED_CHARACTERS) {
            throw new DocumentProcessingError({ reason: 'document-too-large', message: 'PDF extracted text exceeds the supported limit' })
          }
          pages.push(paragraphs)
        }
        if (isOcrHeavyPdf(pages.map((paragraphs) => paragraphs.join(' ')))) {
          throw new DocumentProcessingError({ reason: 'ocr-heavy-pdf', message: 'PDF requires OCR and is not supported' })
        }
        return normalizeDocument('pdf', pages.flatMap((paragraphs, page) =>
          paragraphs.map((text, paragraph) => ({ text, page: page + 1, paragraph: paragraph + 1 }))))
      } finally {
        try {
          await document?.destroy()
        } finally {
          await loadingTask.destroy()
        }
      }
    },
    catch: (error) => error instanceof DocumentProcessingError
      ? error
      : new DocumentProcessingError({ reason: 'invalid-pdf', message: 'PDF could not be parsed as embedded text' }),
  })
