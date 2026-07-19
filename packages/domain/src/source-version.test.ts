import { describe, expect, it } from 'bun:test'
import { Option, Schema } from 'effect'
import {
  DirectorySnapshotId,
  DirectorySourceVersionLineage,
  ManifestEntryId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
} from './index.js'

const snapshotId = DirectorySnapshotId.make('550e8400-e29b-41d4-a716-446655440001')
const manifestEntryId = ManifestEntryId.make('550e8400-e29b-41d4-a716-446655440002')
const sourceId = SourceId.make('550e8400-e29b-41d4-a716-446655440003')
const previous = SourceVersionId.make('550e8400-e29b-41d4-a716-446655440004')
const current = SourceVersionId.make('550e8400-e29b-41d4-a716-446655440005')
const contentHash = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)

const base = {
  snapshotId,
  manifestEntryId,
  sourceId,
  contentHash,
}

describe('directory source-version lineage', () => {
  it('requires unchanged content to reuse its previous immutable version', () => {
    const lineage = Schema.decodeUnknownSync(DirectorySourceVersionLineage)({
      ...base,
      sourceVersionId: previous,
      previousSourceVersionId: previous,
      disposition: 'unchanged',
    })

    expect(Option.getOrElse(lineage.previousSourceVersionId, () => current)).toBe(previous)
    expect(() => Schema.decodeUnknownSync(DirectorySourceVersionLineage)({
      ...base,
      sourceVersionId: current,
      previousSourceVersionId: previous,
      disposition: 'unchanged',
    })).toThrow()
  })

  it('requires modified content to create a new immutable version', () => {
    expect(Schema.decodeUnknownSync(DirectorySourceVersionLineage)({
      ...base,
      sourceVersionId: current,
      previousSourceVersionId: previous,
      disposition: 'modified',
    }).sourceVersionId).toBe(current)

    expect(() => Schema.decodeUnknownSync(DirectorySourceVersionLineage)({
      ...base,
      sourceVersionId: previous,
      previousSourceVersionId: previous,
      disposition: 'modified',
    })).toThrow()
  })

  it('requires added content to have no previous version', () => {
    expect(Schema.decodeUnknownSync(DirectorySourceVersionLineage)({
      ...base,
      sourceVersionId: current,
      previousSourceVersionId: null,
      disposition: 'added',
    }).disposition).toBe('added')

    expect(() => Schema.decodeUnknownSync(DirectorySourceVersionLineage)({
      ...base,
      sourceVersionId: current,
      previousSourceVersionId: previous,
      disposition: 'added',
    })).toThrow()
  })
})
