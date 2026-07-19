import { Option, Schema } from 'effect'
import {
  DatasetId,
  DatasetSchemaFamilyId,
  DatasetSnapshotId,
  ProjectId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import { Sha256Digest } from './directory-manifest.js'

const NonEmptyString = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255))
const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())

export const DatasetLifecycleStatus = Schema.Literal('active', 'archived')
export type DatasetLifecycleStatus = Schema.Schema.Type<typeof DatasetLifecycleStatus>

export const DatasetLogicalType = Schema.Literal(
  'boolean',
  'integer',
  'decimal',
  'string',
  'date',
  'timestamp',
  'json',
)
export type DatasetLogicalType = Schema.Schema.Type<typeof DatasetLogicalType>

export const DatasetAsset = Schema.Struct({
  id: DatasetId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  name: NonEmptyString,
  lifecycleStatus: DatasetLifecycleStatus,
  createdAt: Schema.BigIntFromNumber,
})
export type DatasetAsset = Schema.Schema.Type<typeof DatasetAsset>

export const DatasetFieldSchema = Schema.Struct({
  ordinal: NonNegativeInteger,
  name: NonEmptyString,
  sourceType: NonEmptyString,
  logicalType: DatasetLogicalType,
  nullable: Schema.Boolean,
})
export type DatasetFieldSchema = Schema.Schema.Type<typeof DatasetFieldSchema>

export const DatasetSchemaFamily = Schema.Struct({
  id: DatasetSchemaFamilyId,
  datasetId: DatasetId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  schemaHash: Sha256Digest,
  fields: Schema.Array(DatasetFieldSchema),
  createdAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((family) => {
    const names = new Set(family.fields.map((field) => field.name))
    return [
      family.fields.length === 0 ? 'schema family requires at least one field' : undefined,
      family.fields.every((field, index) => field.ordinal === index)
        ? undefined
        : 'schema family fields must have contiguous zero-based ordinals',
      names.size === family.fields.length
        ? undefined
        : 'schema family field names must be unique',
    ]
  }),
)
export type DatasetSchemaFamily = Schema.Schema.Type<typeof DatasetSchemaFamily>

export const DatasetSnapshotSource = Schema.Struct({
  ordinal: NonNegativeInteger,
  sourceId: SourceId,
  sourceVersionId: SourceVersionId,
  contentHash: Sha256Digest,
})
export type DatasetSnapshotSource =
  Schema.Schema.Type<typeof DatasetSnapshotSource>

export const DatasetSnapshot = Schema.Struct({
  id: DatasetSnapshotId,
  datasetId: DatasetId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  version: PositiveInteger,
  schemaFamilyId: DatasetSchemaFamilyId,
  previousSnapshotId: Schema.OptionFromNullOr(DatasetSnapshotId),
  contentHash: Sha256Digest,
  sources: Schema.Array(DatasetSnapshotSource),
  createdAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((snapshot) => {
    const versions = new Set(snapshot.sources.map((source) => source.sourceVersionId))
    return [
      snapshot.sources.length === 0 ? 'dataset snapshot requires source lineage' : undefined,
      snapshot.sources.every((source, index) => source.ordinal === index)
        ? undefined
        : 'snapshot sources must have contiguous zero-based ordinals',
      versions.size === snapshot.sources.length
        ? undefined
        : 'snapshot source versions must be unique',
      snapshot.version === 1 && Option.isSome(snapshot.previousSnapshotId)
        ? 'first dataset snapshot cannot reference a previous snapshot'
        : undefined,
      snapshot.version > 1 && Option.isNone(snapshot.previousSnapshotId)
        ? 'later dataset snapshots require a previous snapshot'
        : undefined,
    ]
  }),
)
export type DatasetSnapshot = Schema.Schema.Type<typeof DatasetSnapshot>
