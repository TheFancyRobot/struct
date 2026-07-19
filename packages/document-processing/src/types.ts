export type SupportedDocumentFormat = 'pdf' | 'html' | 'markdown' | 'text'

export interface DocumentLocator {
  readonly page: number | null
  readonly section: string | null
  readonly paragraph: number | null
  readonly charStart: number
  readonly charEnd: number
  readonly byteStart: number
  readonly byteEnd: number
}

export interface DocumentFragment extends DocumentLocator {
  readonly text: string
}

export interface NormalizedDocument {
  readonly format: SupportedDocumentFormat
  readonly text: string
  readonly fragments: ReadonlyArray<DocumentFragment>
}
