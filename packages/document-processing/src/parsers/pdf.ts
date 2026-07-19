import { Effect } from 'effect'
import { DocumentProcessingError } from '../errors.js'
import { normalizeDocument } from '../normalize-document.js'

const MINIMUM_EMBEDDED_TEXT_PER_PAGE = 8
const MAX_PDF_PAGES = 1_000
const MAX_EXTRACTED_CHARACTERS = 5_000_000

export const isOcrHeavyPdf = (pageText: ReadonlyArray<string>): boolean =>
  pageText.length === 0
  || pageText.filter((text) => text.length < MINIMUM_EMBEDDED_TEXT_PER_PAGE).length
    > pageText.length / 2

interface PdfTextItem { readonly str?: string }
interface PdfPage { getTextContent(): Promise<{ readonly items: ReadonlyArray<PdfTextItem> }> }
interface PdfDocument { readonly numPages: number; getPage(pageNumber: number): Promise<PdfPage>; destroy(): Promise<void> }
interface PdfLoadingTask { readonly promise: Promise<PdfDocument>; destroy(): Promise<void> }
interface PdfJs { getDocument(input: { readonly data: Uint8Array; readonly useWorkerFetch: false; readonly isEvalSupported: false; readonly standardFontDataUrl: string; readonly useSystemFonts: true }): PdfLoadingTask }

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
        const pages: string[] = []
        let extractedCharacters = 0
        for (let index = 0; index < document.numPages; index += 1) {
          const content = await (await document.getPage(index + 1)).getTextContent()
          const text = content.items.map((item) => item.str ?? '').join(' ').replace(/\s+/g, ' ').trim()
          extractedCharacters += text.length
          if (extractedCharacters > MAX_EXTRACTED_CHARACTERS) {
            throw new DocumentProcessingError({ reason: 'document-too-large', message: 'PDF extracted text exceeds the supported limit' })
          }
          pages.push(text)
        }
        if (isOcrHeavyPdf(pages)) {
          throw new DocumentProcessingError({ reason: 'ocr-heavy-pdf', message: 'PDF requires OCR and is not supported' })
        }
        return normalizeDocument('pdf', pages.map((text, index) => ({ text, page: index + 1, paragraph: 1 })))
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
