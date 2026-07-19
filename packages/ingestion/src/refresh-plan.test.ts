import { describe, expect, it } from 'bun:test'
import {
  DirectoryManifestEntry,
  DirectoryRootId,
  DirectorySnapshotId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
} from '@struct/domain'
import { Option, Schema } from 'effect'
import { buildRefreshPlan } from './refresh-plan.js'

const workspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440001')
const rootId = DirectoryRootId.make('550e8400-e29b-41d4-a716-446655440002')
const previousSnapshotId = DirectorySnapshotId.make('550e8400-e29b-41d4-a716-446655440003')
const currentSnapshotId = DirectorySnapshotId.make('550e8400-e29b-41d4-a716-446655440004')
const hashA = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const hashB = Sha256Digest.make(`sha256:${'b'.repeat(64)}`)

function entry(
  id: string,
  snapshotId: typeof previousSnapshotId,
  relativePath: string,
  contentHash: typeof hashA | null,
  status: 'included' | 'unsupported' = 'included',
) {
  return Schema.decodeUnknownSync(DirectoryManifestEntry)({
    id,
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    relativePath,
    status,
    byteLength: 10,
    contentHash,
    unsupportedReason: status === 'unsupported' ? 'not supported' : null,
  })
}

describe('buildRefreshPlan', () => {
  it('implements the complete deterministic refresh matrix', () => {
    const previous = [
      entry('550e8400-e29b-41d4-a716-446655440010', previousSnapshotId, 'unchanged.txt', hashA),
      entry('550e8400-e29b-41d4-a716-446655440011', previousSnapshotId, 'modified.txt', hashA),
      entry('550e8400-e29b-41d4-a716-446655440012', previousSnapshotId, 'removed.txt', hashA),
      entry('550e8400-e29b-41d4-a716-446655440013', previousSnapshotId, 'now-supported.txt', null, 'unsupported'),
    ]
    const current = [
      entry('550e8400-e29b-41d4-a716-446655440020', currentSnapshotId, 'added.txt', hashA),
      entry('550e8400-e29b-41d4-a716-446655440021', currentSnapshotId, 'modified.txt', hashB),
      entry('550e8400-e29b-41d4-a716-446655440022', currentSnapshotId, 'unchanged.txt', hashA),
      entry('550e8400-e29b-41d4-a716-446655440023', currentSnapshotId, 'unsupported.bin', null, 'unsupported'),
      entry('550e8400-e29b-41d4-a716-446655440024', currentSnapshotId, 'now-supported.txt', hashA),
    ]

    expect(buildRefreshPlan(previous, current).map((item) => [
      String(item.relativePath),
      item.disposition,
    ])).toEqual([
      ['added.txt', 'added'],
      ['modified.txt', 'modified'],
      ['now-supported.txt', 'modified'],
      ['removed.txt', 'removed'],
      ['unchanged.txt', 'unchanged'],
      ['unsupported.bin', 'unsupported'],
    ])
  })

  it('is independent of both manifest enumeration orders', () => {
    const previous = [
      entry('550e8400-e29b-41d4-a716-446655440010', previousSnapshotId, 'a.txt', hashA),
      entry('550e8400-e29b-41d4-a716-446655440011', previousSnapshotId, 'b.txt', hashA),
    ]
    const current = [
      entry('550e8400-e29b-41d4-a716-446655440020', currentSnapshotId, 'a.txt', hashA),
      entry('550e8400-e29b-41d4-a716-446655440021', currentSnapshotId, 'b.txt', hashB),
    ]

    const summarize = (items: ReturnType<typeof buildRefreshPlan>) =>
      items.map((item) => ({
        path: String(item.relativePath),
        disposition: item.disposition,
        previous: Option.getOrElse(item.previousEntryId, () => 'none'),
        current: Option.getOrElse(item.currentEntryId, () => 'none'),
      }))

    expect(summarize(buildRefreshPlan(previous, current))).toEqual(
      summarize(buildRefreshPlan(previous.toReversed(), current.toReversed())),
    )
  })
})
