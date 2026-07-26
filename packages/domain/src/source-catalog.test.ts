import { describe, expect, it } from 'bun:test'
import {
  datasetUploadForName,
  normalizeBrowserRelativePath,
  sourceUploadMediaTypeForName,
} from './source-uploads'

describe('browser source upload metadata', () => {
  it('normalizes safe relative paths and rejects host paths or traversal', () => {
    expect(normalizeBrowserRelativePath('folder\\notes.md')).toBe('folder/notes.md')
    expect(normalizeBrowserRelativePath('/Users/dino/notes.md')).toBeNull()
    expect(normalizeBrowserRelativePath('C:\\Users\\dino\\notes.md')).toBeNull()
    expect(normalizeBrowserRelativePath('folder/../notes.md')).toBeNull()
    expect(normalizeBrowserRelativePath('folder//notes.md')).toBeNull()
  })

  it('uses the existing source allowlist for browser media metadata', () => {
    expect(sourceUploadMediaTypeForName('Notes.MD')).toBe('text/markdown')
    expect(sourceUploadMediaTypeForName('payload.exe')).toBeNull()
  })

  it('maps supported dataset extensions without guessing document semantics', () => {
    expect(datasetUploadForName('rows.tsv')).toEqual({
      mediaType: 'text/tab-separated-values',
      format: 'tsv',
    })
    expect(datasetUploadForName('rows.parquet')).toEqual({
      mediaType: 'application/vnd.apache.parquet',
      format: 'parquet',
    })
    expect(datasetUploadForName('notes.md')).toBeNull()
  })
})
