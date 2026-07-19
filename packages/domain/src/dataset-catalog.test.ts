import { describe, expect, it } from 'bun:test'
import { Option, Schema } from 'effect'
import {
  DatasetAsset,
  DatasetFieldSchema,
  DatasetId,
  DatasetSchemaFamily,
  DatasetSchemaFamilyId,
  DatasetSnapshot,
  DatasetSnapshotId,
  ProjectId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from './index.js'

const workspaceId = WorkspaceId.make('710e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('710e8400-e29b-41d4-a716-446655440001')
const datasetId = DatasetId.make('710e8400-e29b-41d4-a716-446655440002')
const familyId = DatasetSchemaFamilyId.make('710e8400-e29b-41d4-a716-446655440003')
const snapshotId = DatasetSnapshotId.make('710e8400-e29b-41d4-a716-446655440004')
const sourceId = SourceId.make('710e8400-e29b-41d4-a716-446655440005')
const sourceVersionId = SourceVersionId.make('710e8400-e29b-41d4-a716-446655440006')
const hash = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)

describe('dataset catalog schemas', () => {
  it('decodes the stable catalog contracts', () => {
    expect(Schema.decodeUnknownSync(DatasetAsset)({
      id: datasetId,
      workspaceId,
      projectId,
      name: 'Revenue',
      lifecycleStatus: 'active',
      createdAt: 1_750_000_000_000,
    }).name).toBe('Revenue')
    expect(Schema.decodeUnknownSync(DatasetFieldSchema)({
      ordinal: 0,
      name: 'amount',
      sourceType: 'number',
      logicalType: 'decimal',
      nullable: false,
    }).logicalType).toBe('decimal')
  })

  it('rejects malformed fields and schema families', () => {
    expect(() => Schema.decodeUnknownSync(DatasetFieldSchema)({
      ordinal: -1,
      name: '',
      sourceType: 'number',
      logicalType: 'money',
      nullable: false,
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(DatasetSchemaFamily)({
      id: familyId,
      datasetId,
      workspaceId,
      projectId,
      schemaHash: hash,
      fields: [
        { ordinal: 0, name: 'amount', sourceType: 'number', logicalType: 'decimal', nullable: false },
        { ordinal: 2, name: 'amount', sourceType: 'number', logicalType: 'decimal', nullable: true },
      ],
      createdAt: 1_750_000_000_000,
    })).toThrow()
  })

  it('rejects malformed hashes, lifecycle states, and snapshot lineage', () => {
    expect(() => Schema.decodeUnknownSync(DatasetAsset)({
      id: datasetId,
      workspaceId,
      projectId,
      name: 'Revenue',
      lifecycleStatus: 'deleted',
      createdAt: 1_750_000_000_000,
    })).toThrow()
    expect(() => Sha256Digest.make('sha256:not-a-digest')).toThrow()
    expect(() => Schema.decodeUnknownSync(DatasetSnapshot)({
      id: snapshotId,
      datasetId,
      workspaceId,
      projectId,
      version: 2,
      schemaFamilyId: familyId,
      previousSnapshotId: Option.none(),
      contentHash: hash,
      sources: [{ ordinal: 1, sourceId, sourceVersionId, contentHash: hash }],
      createdAt: 1_750_000_000_000,
    })).toThrow()
  })
})
