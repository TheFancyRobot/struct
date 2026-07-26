import { describe, expect, it } from 'bun:test'
import { decodeBrowserSourceImport } from './browser-source-import'

const clientBatchId = 'b50e8400-e29b-41d4-a716-446655440010'

function form(): FormData {
  const value = new FormData()
  value.set('clientBatchId', clientBatchId)
  return value
}

function request(form: FormData): Request {
  return new Request('http://localhost/api/projects/project/sources', {
    method: 'POST',
    body: form,
  })
}

describe('decodeBrowserSourceImport', () => {
  it('accepts bounded multiple files through native multipart form data', async () => {
    const input = form()
    input.set('mode', 'files')
    input.append('files', new File(['alpha'], 'alpha.md', { type: 'text/markdown' }))
    input.append('files', new File(['beta'], 'beta.txt', { type: 'text/plain' }))

    const result = await decodeBrowserSourceImport(request(input), 1024)

    expect(result.clientBatchId).toBe(clientBatchId)
    expect(result.rejected).toEqual([])
    expect(result.items.map((item) => [item.name, item.mediaType, item.kind, item.bytes.byteLength])).toEqual([
      ['alpha.md', 'text/markdown', 'document', 5],
      ['beta.txt', 'text/plain', 'document', 4],
    ])
  })

  it('preserves safe folder-relative paths and independently rejects unsafe or duplicate entries', async () => {
    const input = form()
    input.set('mode', 'folder')
    input.set('paths', JSON.stringify([
      'folder/alpha.md',
      '../secret.md',
      'folder/alpha.md',
    ]))
    input.append('files', new File(['alpha'], 'alpha.md'))
    input.append('files', new File(['secret'], 'secret.md'))
    input.append('files', new File(['duplicate'], 'duplicate.md'))

    const result = await decodeBrowserSourceImport(request(input), 1024)

    expect(result.items.map((item) => item.name)).toEqual(['folder/alpha.md'])
    expect(result.rejected).toEqual([
      { name: '../secret.md', reason: 'unsafe-path' },
      { name: 'folder/alpha.md', reason: 'duplicate' },
    ])
  })

  it('accepts named pasted Markdown and rejects empty input without staging', async () => {
    const accepted = form()
    accepted.set('mode', 'paste')
    accepted.set('name', 'notes.md')
    accepted.set('content', '# Notes')

    expect((await decodeBrowserSourceImport(request(accepted), 1024)).items[0]).toMatchObject({
      name: 'notes.md',
      mediaType: 'text/markdown',
    })

    const empty = form()
    empty.set('mode', 'paste')
    empty.set('name', 'notes.md')
    empty.set('content', '')
    expect((await decodeBrowserSourceImport(request(empty), 1024)).rejected).toEqual([
      { name: 'notes.md', reason: 'empty' },
    ])
  })

  it('accepts a file at exactly maxFileBytes and rejects one byte over', async () => {
    const atLimit = form()
    atLimit.set('mode', 'files')
    atLimit.append('files', new File(['a'.repeat(1024)], 'exact.txt', { type: 'text/plain' }))
    const atResult = await decodeBrowserSourceImport(request(atLimit), 1024)
    expect(atResult.rejected).toEqual([])
    expect(atResult.items).toHaveLength(1)

    const over = form()
    over.set('mode', 'files')
    over.append('files', new File(['a'.repeat(1025)], 'over.txt', { type: 'text/plain' }))
    const overResult = await decodeBrowserSourceImport(request(over), 1024)
    expect(overResult.items).toEqual([])
    expect(overResult.rejected).toEqual([{ name: 'over.txt', reason: 'too-large' }])
  })

  it('keeps every supported structured format explicitly in the dataset path', async () => {
    const input = form()
    input.set('mode', 'dataset')
    for (const name of [
      'rows.csv',
      'rows.tsv',
      'rows.json',
      'rows.jsonl',
      'rows.parquet',
    ]) {
      input.append('files', new File(['rows'], name))
    }

    const result = await decodeBrowserSourceImport(request(input), 1024)

    expect(result.rejected).toEqual([])
    expect(result.items.map(({ name, kind, format }) => [name, kind, format]))
      .toEqual([
        ['rows.csv', 'dataset', 'csv'],
        ['rows.tsv', 'dataset', 'tsv'],
        ['rows.json', 'dataset', 'json'],
        ['rows.jsonl', 'dataset', 'jsonl'],
        ['rows.parquet', 'dataset', 'parquet'],
      ])
  })
})
