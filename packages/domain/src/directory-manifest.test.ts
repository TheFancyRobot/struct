import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import {
  DirectoryManifest,
  DirectoryManifestEntry,
  DirectoryRelativePath,
  DirectoryRootId,
  DirectorySnapshotId,
  ManifestEntryId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
  computeManifestDigest,
  orderManifestEntries,
} from './index.js'

const workspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440000')
const otherWorkspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440002')
const rootId = DirectoryRootId.make('550e8400-e29b-41d4-a716-446655440003')
const snapshotId = DirectorySnapshotId.make('550e8400-e29b-41d4-a716-446655440004')
const hashA = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const hashB = Sha256Digest.make(`sha256:${'b'.repeat(64)}`)

function entry(
  id: string,
  relativePath: string,
  contentHash: typeof hashA = hashA,
) {
  return Schema.decodeUnknownSync(DirectoryManifestEntry)({
    id,
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    relativePath,
    status: 'included',
    byteLength: 10,
    contentHash,
    unsupportedReason: null,
  })
}

describe('directory manifest contracts', () => {
  it('round-trips a valid, canonical, workspace-scoped manifest', () => {
    const entries = orderManifestEntries([
      entry('550e8400-e29b-41d4-a716-446655440011', 'zeta/readme.md', hashB),
      entry('550e8400-e29b-41d4-a716-446655440010', 'alpha.txt'),
    ])
    const manifest = Schema.decodeUnknownSync(DirectoryManifest)({
      snapshotId,
      directoryRootId: rootId,
      workspaceId,
      projectId,
      digest: computeManifestDigest(entries),
      entries,
    })
    const encoded = Schema.encodeSync(DirectoryManifest)(manifest)

    expect(Schema.decodeUnknownSync(DirectoryManifest)(encoded)).toEqual(manifest)
    expect(manifest.entries.map((item) => String(item.relativePath))).toEqual([
      'alpha.txt',
      'zeta/readme.md',
    ])
  })

  it.each([
    '/etc/passwd',
    '../escape.txt',
    'folder/../escape.txt',
    'folder/./file.txt',
    'folder//file.txt',
    'folder\\file.txt',
    'C:/Windows/file.txt',
    'folder/',
    'line\nbreak.txt',
    'cafe\u0301.txt',
    `${'a'.repeat(256)}.txt`,
  ])('rejects non-canonical or escaping path %s', (relativePath) => {
    expect(() => Schema.decodeUnknownSync(DirectoryRelativePath)(relativePath)).toThrow()
  })

  it('rejects malformed digests and invalid byte lengths', () => {
    expect(() => Schema.decodeUnknownSync(Sha256Digest)('sha256:not-a-digest')).toThrow()
    expect(() => Schema.decodeUnknownSync(DirectoryManifestEntry)({
      ...entry('550e8400-e29b-41d4-a716-446655440010', 'alpha.txt'),
      byteLength: -1,
    })).toThrow()
  })

  it('rejects duplicate paths, unstable order, forged scope, and stale digests', () => {
    const alpha = entry('550e8400-e29b-41d4-a716-446655440010', 'alpha.txt')
    const beta = entry('550e8400-e29b-41d4-a716-446655440011', 'beta.txt', hashB)
    const base = {
      snapshotId,
      directoryRootId: rootId,
      workspaceId,
      projectId,
    }

    const duplicate = [
      alpha,
      entry('550e8400-e29b-41d4-a716-446655440012', 'alpha.txt', hashB),
    ]
    expect(() => Schema.decodeUnknownSync(DirectoryManifest)({
      ...base,
      digest: computeManifestDigest(duplicate),
      entries: duplicate,
    })).toThrow()

    expect(() => Schema.decodeUnknownSync(DirectoryManifest)({
      ...base,
      digest: computeManifestDigest([beta, alpha]),
      entries: [beta, alpha],
    })).toThrow()

    const forged = [{ ...alpha, workspaceId: otherWorkspaceId }]
    expect(() => Schema.decodeUnknownSync(DirectoryManifest)({
      ...base,
      digest: computeManifestDigest(forged),
      entries: forged,
    })).toThrow()

    expect(() => Schema.decodeUnknownSync(DirectoryManifest)({
      ...base,
      digest: `sha256:${'f'.repeat(64)}`,
      entries: [alpha, beta],
    })).toThrow()
  })

  it('produces the same ordering and digest for every enumeration order', () => {
    const alpha = entry('550e8400-e29b-41d4-a716-446655440010', 'alpha.txt')
    const beta = entry('550e8400-e29b-41d4-a716-446655440011', 'beta.txt', hashB)
    const gamma = entry('550e8400-e29b-41d4-a716-446655440012', 'nested/gamma.txt')
    const expected = computeManifestDigest([alpha, beta, gamma])

    for (const entries of [
      [gamma, alpha, beta],
      [beta, gamma, alpha],
      [alpha, beta, gamma],
    ]) {
      expect(orderManifestEntries(entries).map((item) => String(item.relativePath))).toEqual([
        'alpha.txt',
        'beta.txt',
        'nested/gamma.txt',
      ])
      expect(computeManifestDigest(entries)).toBe(expected)
    }
  })

  it('orders normalized paths by UTF-8 bytes rather than UTF-16 code units', () => {
    const privateUse = entry(
      '550e8400-e29b-41d4-a716-446655440010',
      '\uE000.txt',
    )
    const astral = entry(
      '550e8400-e29b-41d4-a716-446655440011',
      '\u{10000}.txt',
      hashB,
    )

    expect(orderManifestEntries([astral, privateUse]).map((item) =>
      String(item.relativePath))).toEqual([
      '\uE000.txt',
      '\u{10000}.txt',
    ])
  })

  it('requires status-consistent content identity and unsupported reasons', () => {
    const id = ManifestEntryId.make('550e8400-e29b-41d4-a716-446655440010')
    const base = {
      id,
      snapshotId,
      directoryRootId: rootId,
      workspaceId,
      projectId,
      relativePath: 'binary.dat',
      byteLength: 10,
    }

    expect(() => Schema.decodeUnknownSync(DirectoryManifestEntry)({
      ...base,
      status: 'included',
      contentHash: null,
      unsupportedReason: null,
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(DirectoryManifestEntry)({
      ...base,
      status: 'unsupported',
      contentHash: null,
      unsupportedReason: null,
    })).toThrow()
    expect(Schema.decodeUnknownSync(DirectoryManifestEntry)({
      ...base,
      status: 'unsupported',
      contentHash: null,
      unsupportedReason: 'extension is not supported',
    }).status).toBe('unsupported')
  })
})
