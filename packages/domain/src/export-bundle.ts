import { Schema } from 'effect'
import {
  ClaimId,
  ContentRevisionId,
  DatasetSnapshotId,
  FindingId,
  ProjectId,
  ProvenanceGraphId,
  QueryResultSnapshotId,
  ReportId,
  ReportSectionId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import {
  CitationValidationFact,
  CitationValidationStatus,
} from './provenance-graph.js'
import { Sha256Digest } from './directory-manifest.js'
import {
  EvidenceFilter,
  EvidenceTimeWindow,
} from './cross-source-evidence.js'
import {
  QueryResultColumn,
  QuerySnapshotReference,
} from './dataset-query-evidence.js'

const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const Count = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const Revision = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const SafeBundlePath = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9._/-]{0,254}$/),
  Schema.filter((path) => {
    const segments = path.split('/')
    return !path.startsWith('/')
      && !path.endsWith('/')
      && !path.includes('\\')
      && segments.every((segment) =>
        segment.length > 0 && segment !== '.' && segment !== '..')
      ? true
      : 'bundle paths must be canonical, relative, and traversal-free'
  }),
)

export const ExportBundleDigest = Sha256Digest.pipe(
  Schema.brand('ExportBundleDigest'),
)
export type ExportBundleDigest =
  Schema.Schema.Type<typeof ExportBundleDigest>

export const ExportBundleFile = Schema.Struct({
  path: SafeBundlePath,
  mediaType: NonBlank,
  sha256: Sha256Digest,
  byteLength: Count,
  contentBase64: Schema.String,
})
export type ExportBundleFile =
  Schema.Schema.Type<typeof ExportBundleFile>

export const ExportEvidenceReference = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('document'),
    sourceVersionId: SourceVersionId,
    locator: NonBlank,
    contentHash: Sha256Digest,
  }),
  Schema.Struct({
    kind: Schema.Literal('dataset'),
    datasetSnapshotId: DatasetSnapshotId,
    queryResultSnapshotId: QueryResultSnapshotId,
    requestHash: Sha256Digest,
    engineVersion: NonBlank,
    engineConfigHash: Sha256Digest,
    querySnapshots: Schema.Array(QuerySnapshotReference).pipe(
      Schema.minItems(1),
    ),
    schemaHash: Sha256Digest,
    resultHash: Sha256Digest,
    resultArtifactHash: Sha256Digest,
    canonicalSql: NonBlank,
    parameters: Schema.Array(
      Schema.Union(Schema.Null, Schema.Boolean, Schema.String),
    ),
    columns: Schema.Array(QueryResultColumn).pipe(Schema.minItems(1)),
    rows: Schema.Array(Schema.Array(
      Schema.Union(Schema.Null, Schema.Boolean, Schema.String),
    )),
    rowStart: Count,
    rowEndExclusive: Count,
    unit: Schema.NullOr(NonBlank),
    timeWindow: Schema.NullOr(EvidenceTimeWindow),
    filters: Schema.Array(EvidenceFilter).pipe(Schema.maxItems(64)),
  }),
  Schema.Struct({
    kind: Schema.Literal('recursive'),
    sourceVersionId: SourceVersionId,
    artifactHash: Sha256Digest,
    locator: NonBlank,
    contentHash: Sha256Digest,
  }),
)
export type ExportEvidenceReference =
  Schema.Schema.Type<typeof ExportEvidenceReference>

export const ExportClaimManifest = Schema.Struct({
  id: ClaimId,
  currentRevisionId: ContentRevisionId,
  citationStatus: CitationValidationStatus,
  evidence: Schema.Array(ExportEvidenceReference).pipe(
    Schema.maxItems(512),
  ),
})
export type ExportClaimManifest =
  Schema.Schema.Type<typeof ExportClaimManifest>

export const ExportSectionManifest = Schema.Struct({
  id: ReportSectionId,
  ordinal: Count,
  currentRevisionId: ContentRevisionId,
  findingIds: Schema.Array(FindingId),
  claimIds: Schema.Array(ClaimId),
})
export type ExportSectionManifest =
  Schema.Schema.Type<typeof ExportSectionManifest>

export const ExportRedactionDecision = Schema.Struct({
  path: SafeBundlePath,
  decision: Schema.Literal('included', 'omitted'),
  reason: NonBlank,
})
export type ExportRedactionDecision =
  Schema.Schema.Type<typeof ExportRedactionDecision>

export const ExportBundleManifest = Schema.Struct({
  schemaVersion: Schema.Literal('1'),
  producer: Schema.Struct({
    name: Schema.Literal('@struct/source-storage'),
    version: NonBlank,
  }),
  generatedAt: Schema.BigIntFromNumber,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  reportId: ReportId,
  reportRevision: Revision,
  provenanceGraphId: ProvenanceGraphId,
  sourceVersionIds: Schema.Array(SourceVersionId),
  sections: Schema.Array(ExportSectionManifest),
  claims: Schema.Array(ExportClaimManifest),
  validations: Schema.Array(CitationValidationFact),
  redactions: Schema.Array(ExportRedactionDecision).pipe(
    Schema.minItems(2),
    Schema.maxItems(64),
  ),
  files: Schema.Array(Schema.Struct({
    path: SafeBundlePath,
    mediaType: NonBlank,
    sha256: Sha256Digest,
    byteLength: Count,
  })).pipe(Schema.minItems(2), Schema.maxItems(64)),
}).pipe(
  Schema.filter((manifest) => [
    manifest.sections.every((section, index) => section.ordinal === index)
      ? undefined
      : 'export sections must be in contiguous report order',
    new Set(manifest.sections.map((section) => section.id)).size
      === manifest.sections.length
      ? undefined
      : 'export section identities must be unique',
    new Set(manifest.claims.map((claim) => claim.id)).size
      === manifest.claims.length
      ? undefined
      : 'export claim identities must be unique',
    new Set(manifest.files.map((file) => file.path)).size
      === manifest.files.length
      ? undefined
      : 'export file paths must be unique',
    new Set(manifest.redactions.map((item) => item.path)).size
      === manifest.redactions.length
      ? undefined
      : 'export redaction paths must be unique',
  ]),
)
export type ExportBundleManifest =
  Schema.Schema.Type<typeof ExportBundleManifest>

export const ExportBundleEnvelope = Schema.Struct({
  format: Schema.Literal('struct-export-bundle/1'),
  manifest: ExportBundleManifest,
  files: Schema.Array(ExportBundleFile).pipe(
    Schema.minItems(2),
    Schema.maxItems(64),
  ),
}).pipe(
  Schema.filter((bundle) => [
    new Set(bundle.files.map((file) => file.path)).size === bundle.files.length
      ? undefined
      : 'bundle file paths must be unique',
    bundle.files.length === bundle.manifest.files.length
      ? undefined
      : 'bundle file count must match the manifest',
  ]),
)
export type ExportBundleEnvelope =
  Schema.Schema.Type<typeof ExportBundleEnvelope>

export const ExportBundleStatus = Schema.Struct({
  status: Schema.Literal('completed'),
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  reportId: ReportId,
  reportRevision: Revision,
  digest: ExportBundleDigest,
  artifactRef: Schema.String.pipe(
    Schema.pattern(/^artifact:\/\/sha256\/[a-f0-9]{64}$/),
  ),
  byteLength: Count,
  mediaType: Schema.Literal('application/vnd.struct.report-bundle+json'),
})
export type ExportBundleStatus =
  Schema.Schema.Type<typeof ExportBundleStatus>

export class ReportExportBlockedError
  extends Schema.TaggedError<ReportExportBlockedError>()(
    'ReportExportBlockedError',
    {
      reportId: ReportId,
      reason: Schema.Literal(
        'report-not-publishable',
        'citation-not-valid',
        'provenance-mismatch',
        'source-not-authorized',
      ),
      blockingClaimIds: Schema.Array(ClaimId),
      message: Schema.String,
    },
  ) {}

export class ExportBundleLimitError
  extends Schema.TaggedError<ExportBundleLimitError>()(
    'ExportBundleLimitError',
    {
      limit: Schema.Literal('bytes', 'files'),
      actual: Count,
      maximum: Count,
      message: Schema.String,
    },
  ) {}

export class ExportBundleVerificationError
  extends Schema.TaggedError<ExportBundleVerificationError>()(
    'ExportBundleVerificationError',
    {
      reason: Schema.Literal(
        'non-canonical',
        'invalid-envelope',
        'unsafe-path',
        'file-count',
        'file-size',
        'file-hash',
        'file-metadata',
        'report-decode',
        'provenance-decode',
        'manifest-mismatch',
      ),
      message: Schema.String,
    },
  ) {}
