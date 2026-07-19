import { describe, expect, it } from 'bun:test'
import {
  DirectoryManifest,
  DirectoryRelativePath,
  DirectoryRootId,
  DirectorySnapshotId,
  ManifestEntryId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
  computeManifestDigest,
  type DirectoryManifestEntry,
} from '@struct/domain'
import { Option, Schema } from 'effect'
import { diffManifest } from './diff-manifest.js'

const workspaceId = WorkspaceId.make('340e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('340e8400-e29b-41d4-a716-446655440001')
const rootId = DirectoryRootId.make('340e8400-e29b-41d4-a716-446655440002')

function entry(
  snapshotId: typeof DirectorySnapshotId.Type,
  suffix: string,
  path: string,
  hash: string | null,
  unsupportedReason: string | null = null,
): DirectoryManifestEntry {
  return {
    id: ManifestEntryId.make(`340e8400-e29b-41d4-a716-44665544${suffix}`),
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    relativePath: DirectoryRelativePath.make(path),
    status: hash === null ? 'unsupported' : 'included',
    byteLength: hash === null ? 0 : 10,
    contentHash: hash === null ? null : Sha256Digest.make(hash),
    unsupportedReason,
  }
}

function manifest(
  snapshotId: typeof DirectorySnapshotId.Type,
  entries: ReadonlyArray<DirectoryManifestEntry>,
) {
  return Schema.decodeUnknownSync(DirectoryManifest)({
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    entries,
    digest: computeManifestDigest(entries),
  })
}

describe('diffManifest', () => {
  it('classifies a mixed refresh in canonical path order', () => {
    const previousId =
      DirectorySnapshotId.make('340e8400-e29b-41d4-a716-446655440003')
    const currentId =
      DirectorySnapshotId.make('340e8400-e29b-41d4-a716-446655440004')
    const stableHash = `sha256:${'a'.repeat(64)}`
    const oldHash = `sha256:${'b'.repeat(64)}`
    const newHash = `sha256:${'c'.repeat(64)}`
    const previous = manifest(previousId, [
      entry(previousId, '0005', 'changed.md', oldHash),
      entry(previousId, '0006', 'removed.md', stableHash),
      entry(previousId, '0007', 'renamed-old.md', newHash),
      entry(previousId, '0008', 'same.md', stableHash),
    ])
    const current = manifest(currentId, [
      entry(currentId, '0009', 'added.md', newHash),
      entry(currentId, '0010', 'changed.md', newHash),
      entry(currentId, '0011', 'renamed-new.md', newHash),
      entry(currentId, '0012', 'same.md', stableHash),
      entry(currentId, '0013', 'unsupported.bin', null, 'binary'),
    ])

    const result = diffManifest(previous, current)
    expect(result.map(({ relativePath, disposition }) => [
      String(relativePath),
      disposition,
    ])).toEqual([
      ['added.md', 'added'],
      ['changed.md', 'modified'],
      ['removed.md', 'removed'],
      ['renamed-new.md', 'added'],
      ['renamed-old.md', 'removed'],
      ['same.md', 'unchanged'],
      ['unsupported.bin', 'unsupported'],
    ])
    expect(Option.isNone(result[0]!.previous)).toBe(true)
    expect(Option.isNone(result[2]!.current)).toBe(true)
  })

  it('classifies every included entry in an initial snapshot as added', () => {
    const currentId =
      DirectorySnapshotId.make('340e8400-e29b-41d4-a716-446655440014')
    const current = manifest(currentId, [
      entry(currentId, '0015', 'one.txt', `sha256:${'d'.repeat(64)}`),
    ])
    expect(diffManifest(null, current).map(({ disposition }) => disposition))
      .toEqual(['added'])
  })
})
