import { Option, Schema } from 'effect'
import {
  DirectorySnapshotId,
  ManifestEntryId,
  SourceId,
  SourceVersionId,
} from './branded-ids.js'
import { Sha256Digest } from './directory-manifest.js'

export const SourceVersion = Schema.Struct({
  id: SourceVersionId,
  sourceId: SourceId,
  version: Schema.Number,
  artifactRef: Schema.String,
  contentHash: Schema.String,
  createdAt: Schema.BigIntFromNumber,
})
export type SourceVersion = Schema.Schema.Type<typeof SourceVersion>

export const SourceVersionRefreshDisposition = Schema.Literal(
  'added',
  'modified',
  'unchanged',
)
export type SourceVersionRefreshDisposition =
  Schema.Schema.Type<typeof SourceVersionRefreshDisposition>

/**
 * Records how one included manifest entry resolves to an immutable source
 * version. Removed and unsupported entries never produce this record.
 */
export const DirectorySourceVersionLineage = Schema.Struct({
  snapshotId: DirectorySnapshotId,
  manifestEntryId: ManifestEntryId,
  sourceId: SourceId,
  sourceVersionId: SourceVersionId,
  previousSourceVersionId: Schema.OptionFromNullOr(SourceVersionId),
  contentHash: Sha256Digest,
  disposition: SourceVersionRefreshDisposition,
}).pipe(
  Schema.filter((lineage) => [
    lineage.disposition === 'added'
      && Option.isSome(lineage.previousSourceVersionId)
      ? 'added content cannot reference a previous source version'
      : undefined,
    lineage.disposition === 'modified'
      && Option.isNone(lineage.previousSourceVersionId)
      ? 'modified content requires a previous source version'
      : undefined,
    lineage.disposition === 'modified'
      && Option.isSome(lineage.previousSourceVersionId)
      && lineage.previousSourceVersionId.value === lineage.sourceVersionId
      ? 'modified content must create a new source version'
      : undefined,
    lineage.disposition === 'unchanged'
      && (
        Option.isNone(lineage.previousSourceVersionId)
        || lineage.previousSourceVersionId.value !== lineage.sourceVersionId
      )
      ? 'unchanged content must reuse its previous source version'
      : undefined,
  ]),
)
export type DirectorySourceVersionLineage =
  Schema.Schema.Type<typeof DirectorySourceVersionLineage>
