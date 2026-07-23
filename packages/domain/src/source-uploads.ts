const uploadRules = [
  { extensions: ['.txt', '.ts', '.tsx', '.py', '.go', '.rs'], mediaType: 'text/plain' },
  { extensions: ['.md'], mediaType: 'text/markdown' },
  { extensions: ['.html', '.htm'], mediaType: 'text/html' },
  { extensions: ['.pdf'], mediaType: 'application/pdf' },
  { extensions: ['.json'], mediaType: 'application/json' },
  { extensions: ['.css'], mediaType: 'text/css' },
  { extensions: ['.js', '.jsx'], mediaType: 'application/javascript' },
] as const

export type SourceUploadMediaType = typeof uploadRules[number]['mediaType']

export function isSupportedSourceUpload(
  name: unknown,
  mediaType: unknown,
): mediaType is SourceUploadMediaType {
  if (typeof name !== 'string' || typeof mediaType !== 'string') return false
  const lowerName = name.toLowerCase()
  return uploadRules.some((rule) =>
    rule.mediaType === mediaType
    && rule.extensions.some((extension) => lowerName.endsWith(extension)),
  )
}

export function sourceUploadMediaTypeForName(
  name: string,
): SourceUploadMediaType | null {
  const lowerName = name.toLowerCase()
  return uploadRules.find((rule) =>
    rule.extensions.some((extension) => lowerName.endsWith(extension)),
  )?.mediaType ?? null
}

export function normalizeBrowserRelativePath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('/')) {
    return null
  }
  const normalized = value.replaceAll('\\', '/')
  const components = normalized.split('/')
  if (
    components.some((component) =>
      component.length === 0
      || component === '.'
      || component === '..'
      || component.includes(':')
      || Array.from(component).some((character) => {
        const codePoint = character.codePointAt(0)
        return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
      }))
  ) {
    return null
  }
  return components.join('/')
}
