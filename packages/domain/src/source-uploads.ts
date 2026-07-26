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

const datasetUploadRules = [
  { extension: '.csv', mediaType: 'text/csv', format: 'csv' },
  { extension: '.tsv', mediaType: 'text/tab-separated-values', format: 'tsv' },
  { extension: '.json', mediaType: 'application/json', format: 'json' },
  { extension: '.jsonl', mediaType: 'application/x-ndjson', format: 'jsonl' },
  { extension: '.parquet', mediaType: 'application/vnd.apache.parquet', format: 'parquet' },
] as const

export type DatasetUploadMediaType = typeof datasetUploadRules[number]['mediaType']
export type StructuredSourceFormat = typeof datasetUploadRules[number]['format']

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

export function datasetUploadForName(
  name: string,
): {
  readonly mediaType: DatasetUploadMediaType
  readonly format: StructuredSourceFormat
} | null {
  const lowerName = name.toLowerCase()
  const rule = datasetUploadRules.find(({ extension }) =>
    lowerName.endsWith(extension))
  return rule === undefined
    ? null
    : { mediaType: rule.mediaType, format: rule.format }
}

export function isSupportedDatasetUpload(
  name: unknown,
  mediaType: unknown,
  format: unknown,
): mediaType is DatasetUploadMediaType {
  if (
    typeof name !== 'string'
    || typeof mediaType !== 'string'
    || typeof format !== 'string'
  ) return false
  const rule = datasetUploadForName(name)
  return rule?.mediaType === mediaType && rule.format === format
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
