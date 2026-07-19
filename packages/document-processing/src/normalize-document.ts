const encoder = new TextEncoder()

export interface UnnormalizedFragment {
  readonly text: string
  readonly page?: number | null
  readonly section?: string | null
  readonly paragraph?: number | null
}

export const normalize = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '')

export const normalizeDocument = (
  format: 'pdf' | 'html' | 'markdown' | 'text',
  fragments: ReadonlyArray<UnnormalizedFragment>,
)=> {
  let charOffset = 0
  let byteOffset = 0
  const normalizedFragments: Array<{
    readonly text: string
    readonly page: number | null
    readonly section: string | null
    readonly paragraph: number | null
    readonly charStart: number
    readonly charEnd: number
    readonly byteStart: number
    readonly byteEnd: number
  }> = []
  for (const fragment of fragments) {
    const text = normalize(fragment.text).trim()
    if (!text) continue
    const separator = normalizedFragments.length === 0 ? '' : '\n\n'
    charOffset += separator.length
    byteOffset += encoder.encode(separator).byteLength
    const bytes = encoder.encode(text)
    normalizedFragments.push({
      text,
      page: fragment.page ?? null,
      section: fragment.section ?? null,
      paragraph: fragment.paragraph ?? null,
      charStart: charOffset,
      charEnd: charOffset + text.length,
      byteStart: byteOffset,
      byteEnd: byteOffset + bytes.byteLength,
    })
    charOffset += text.length
    byteOffset += bytes.byteLength
  }
  return { format, text: normalizedFragments.map((fragment) => fragment.text).join('\n\n'), fragments: normalizedFragments }
}

export const normalizeSourceDocument = (
  format: 'markdown' | 'text',
  source: string,
  fragments: ReadonlyArray<UnnormalizedFragment>,
) => {
  const text = normalize(source)
  let cursor = 0
  let byteCursor = 0
  const located = fragments.flatMap((fragment) => {
    const fragmentText = normalize(fragment.text).trim()
    if (!fragmentText) return []
    const charStart = text.indexOf(fragmentText, cursor)
    if (charStart < 0) return []
    const charEnd = charStart + fragmentText.length
    const byteStart = byteCursor
      + encoder.encode(text.slice(cursor, charStart)).byteLength
    const byteEnd = byteStart + encoder.encode(fragmentText).byteLength
    cursor = charEnd
    byteCursor = byteEnd
    return [{
      text: fragmentText,
      page: fragment.page ?? null,
      section: fragment.section ?? null,
      paragraph: fragment.paragraph ?? null,
      charStart,
      charEnd,
      byteStart,
      byteEnd,
    }]
  })
  return { format, text, fragments: located }
}
