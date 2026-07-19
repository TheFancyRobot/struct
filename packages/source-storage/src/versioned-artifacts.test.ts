import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DirectoryRelativePath,
  DirectoryRootId,
  DirectorySnapshotId,
  ManifestEntryId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
  type DirectoryManifestEntry,
} from '@struct/domain'
import { Effect } from 'effect'
import { LocalArtifactStore } from './object-store.js'
import { writeVersionedArtifact } from './versioned-artifacts.js'

const bytes = new TextEncoder().encode('versioned')
const hash = Sha256Digest.make(
  `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
)
const entry: DirectoryManifestEntry = {
  id: ManifestEntryId.make('350e8400-e29b-41d4-a716-446655440000'),
  snapshotId: DirectorySnapshotId.make('350e8400-e29b-41d4-a716-446655440001'),
  directoryRootId: DirectoryRootId.make('350e8400-e29b-41d4-a716-446655440002'),
  workspaceId: WorkspaceId.make('350e8400-e29b-41d4-a716-446655440003'),
  projectId: ProjectId.make('350e8400-e29b-41d4-a716-446655440004'),
  relativePath: DirectoryRelativePath.make('note.txt'),
  status: 'included',
  byteLength: bytes.byteLength,
  contentHash: hash,
  unsupportedReason: null,
}

describe('writeVersionedArtifact', () => {
  it('writes and reuses the same content-addressed object', async () => {
    const root = await mkdtemp(join(tmpdir(), 'struct-versioned-'))
    try {
      const store = await Effect.runPromise(LocalArtifactStore.make({ root }))
      const first = await Effect.runPromise(writeVersionedArtifact(store, {
        entry,
        bytes,
        options: { mediaType: 'text/plain' },
      }))
      const replay = await Effect.runPromise(writeVersionedArtifact(store, {
        entry,
        bytes,
        options: { mediaType: 'text/plain' },
      }))
      expect(replay).toEqual(first)
      expect(String(first.hash)).toBe(String(hash))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects bytes changed after discovery without storing them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'struct-versioned-'))
    try {
      const store = await Effect.runPromise(LocalArtifactStore.make({ root }))
      const exit = await Effect.runPromiseExit(writeVersionedArtifact(store, {
        entry,
        bytes: new TextEncoder().encode('different'),
        options: { mediaType: 'text/plain' },
      }))
      expect(exit._tag).toBe('Failure')
      if (exit._tag === 'Failure') {
        expect(exit.cause.toString()).toContain(
          'Artifact bytes do not match the immutable manifest entry',
        )
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
