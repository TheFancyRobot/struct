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
