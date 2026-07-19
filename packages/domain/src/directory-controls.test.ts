import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  JobQueueId,
  ManifestEntryId,
  ProjectId,
  SourceId,
  WorkspaceId,
} from './branded-ids.js'
import {
  DirectoryProgressCounts,
  DirectoryStatusProjection,
} from './directory-controls.js'
import { DirectoryRelativePath } from './directory-manifest.js'

const counts = {
  total: 4,
  processed: 2,
  succeeded: 1,
  failed: 1,
  unsupported: 1,
  pending: 1,
}

describe('directory control projections', () => {
  it('accepts honest aggregate counts and typed entry failures', () => {
    const projection = Schema.decodeUnknownSync(DirectoryStatusProjection)({
      jobId: JobQueueId.make('e10e8400-e29b-41d4-a716-446655440001'),
      workspaceId: WorkspaceId.make('e10e8400-e29b-41d4-a716-446655440002'),
      projectId: ProjectId.make('e10e8400-e29b-41d4-a716-446655440003'),
      sourceId: SourceId.make('e10e8400-e29b-41d4-a716-446655440004'),
      directoryRootId: DirectoryRootId.make('e10e8400-e29b-41d4-a716-446655440005'),
      snapshotId: DirectorySnapshotId.make('e10e8400-e29b-41d4-a716-446655440006'),
      name: 'notes',
      status: 'running',
      attempts: 1,
      maxAttempts: 3,
      counts,
      failures: [{
        entryId: ManifestEntryId.make('e10e8400-e29b-41d4-a716-446655440007'),
        relativePath: DirectoryRelativePath.make('private/locked.md'),
        errorTag: 'DirectoryPermissionError',
      }],
      updatedAt: 1_700_000_000_000,
    })
    expect(projection.counts).toEqual(counts)
    expect(String(projection.failures[0]?.relativePath)).toBe('private/locked.md')
  })

  it('rejects contradictory aggregate counts', () => {
    expect(() => Schema.decodeUnknownSync(DirectoryProgressCounts)({
      ...counts,
      pending: 2,
    })).toThrow()
  })
})
