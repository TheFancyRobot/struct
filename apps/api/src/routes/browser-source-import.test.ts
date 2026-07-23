import { describe, expect, it } from 'bun:test'
import { decodeBrowserSourceImport } from './browser-source-import'

function request(form: FormData): Request {
  return new Request('http://localhost/api/projects/project/sources', {
    method: 'POST',
    body: form,
  })
}

describe('decodeBrowserSourceImport', () => {
  it('accepts bounded multiple files through native multipart form data', async () => {
    const form = new FormData()
    form.set('mode', 'files')
    form.append('files', new File(['alpha'], 'alpha.md', { type: 'text/markdown' }))
    form.append('files', new File(['beta'], 'beta.txt', { type: 'text/plain' }))

    const result = await decodeBrowserSourceImport(request(form), 1024)

    expect(result.rejected).toEqual([])
    expect(result.items.map((item) => [item.name, item.mediaType, item.bytes.byteLength])).toEqual([
      ['alpha.md', 'text/markdown', 5],
      ['beta.txt', 'text/plain', 4],
    ])
  })

  it('preserves safe folder-relative paths and independently rejects unsafe or duplicate entries', async () => {
    const form = new FormData()
    form.set('mode', 'folder')
    form.set('paths', JSON.stringify([
      'folder/alpha.md',
      '../secret.md',
      'folder/alpha.md',
    ]))
    form.append('files', new File(['alpha'], 'alpha.md'))
    form.append('files', new File(['secret'], 'secret.md'))
    form.append('files', new File(['duplicate'], 'duplicate.md'))

    const result = await decodeBrowserSourceImport(request(form), 1024)

    expect(result.items.map((item) => item.name)).toEqual(['folder/alpha.md'])
    expect(result.rejected).toEqual([
      { name: '../secret.md', reason: 'unsafe-path' },
      { name: 'folder/alpha.md', reason: 'duplicate' },
    ])
  })

  it('accepts named pasted Markdown and rejects empty input without staging', async () => {
    const accepted = new FormData()
    accepted.set('mode', 'paste')
    accepted.set('name', 'notes.md')
    accepted.set('content', '# Notes')

    expect((await decodeBrowserSourceImport(request(accepted), 1024)).items[0]).toMatchObject({
      name: 'notes.md',
      mediaType: 'text/markdown',
    })

    const empty = new FormData()
    empty.set('mode', 'paste')
    empty.set('name', 'notes.md')
    empty.set('content', '')
    expect((await decodeBrowserSourceImport(request(empty), 1024)).rejected).toEqual([
      { name: 'notes.md', reason: 'empty' },
    ])
  })
})
