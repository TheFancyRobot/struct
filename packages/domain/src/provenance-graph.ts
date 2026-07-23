import { Schema } from 'effect'
import {
  DATA_ENGINE_ADAPTER_VERSION,
  DATA_ENGINE_EXECUTION_POLICY_VERSION,
  DATA_ENGINE_VERSION,
} from './data-engine-contract.js'
import {
  ActorId,
  ClaimId,
  ContentRevisionId,
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  DocumentChunkId,
  DocumentId,
  ProjectId,
  ProvenanceGraphId,
  QueryResultSnapshotId,
  ReportId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import { CrossSourceEvidenceId } from './cross-source-evidence.js'
import {
  QueryResultColumn,
  QuerySnapshotReference,
} from './dataset-query-evidence.js'
import { Sha256Digest } from './directory-manifest.js'
import { DocumentLocator } from './document.js'
import {
  RecursiveEvidenceId,
  RecursiveFindingId,
} from './research-finding.js'

const Revision = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const Counter = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const NonBlank = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(65_536),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const ArtifactDigest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))

export const ProvenanceEdgeId = Schema.String.pipe(
  Schema.pattern(/^sha256:[0-9a-f]{64}$/),
  Schema.brand('ProvenanceEdgeId'),
)
export type ProvenanceEdgeId = Schema.Schema.Type<typeof ProvenanceEdgeId>

const EdgeIdentity = {
  id: ProvenanceEdgeId,
  reportId: ReportId,
  reportRevision: Revision,
  claimId: ClaimId,
  claimRevisionId: ContentRevisionId,
  claimRevision: Revision,
}

export const ReportClaimProvenanceEdge = Schema.Struct({
  ...EdgeIdentity,
  kind: Schema.Literal('report-claim'),
  evidenceMode: Schema.NullOr(
    Schema.Literal('document', 'dataset', 'recursive', 'hybrid'),
  ),
  expectedEvidenceCount: Counter,
})

export const ClaimRecursiveFindingProvenanceEdge = Schema.Struct({
  ...EdgeIdentity,
  kind: Schema.Literal('claim-recursive-finding'),
  recursiveFindingId: RecursiveFindingId,
})

export const ClaimRunProvenanceEdge = Schema.Struct({
  ...EdgeIdentity,
  kind: Schema.Literal('claim-run-output'),
  runId: ResearchRunId,
})

export const ClaimUserProvenanceEdge = Schema.Struct({
  ...EdgeIdentity,
  kind: Schema.Literal('claim-user-origin'),
  actorId: ActorId,
})

export const DocumentProvenanceEdge = Schema.Struct({
  ...EdgeIdentity,
  kind: Schema.Literal('evidence-document'),
  evidenceId: CrossSourceEvidenceId,
  chunkId: DocumentChunkId,
  documentId: DocumentId,
  sourceVersionId: SourceVersionId,
  chunkingVersion: NonBlank,
  ordinal: Counter,
  locator: DocumentLocator,
  citationLocator: NonBlank,
  excerptHash: Sha256Digest,
})

export const DatasetProvenanceEdge = Schema.Struct({
  ...EdgeIdentity,
  kind: Schema.Literal('evidence-dataset'),
  evidenceId: CrossSourceEvidenceId,
  citationId: DatasetCitationId,
  queryResultSnapshotId: QueryResultSnapshotId,
  requestHash: Sha256Digest,
  protocolVersion: Schema.Literal('1'),
  engineVersion: Schema.Literal(DATA_ENGINE_VERSION),
  engineAdapterVersion: Schema.Literal(DATA_ENGINE_ADAPTER_VERSION),
  executionPolicyVersion: Schema.Literal(DATA_ENGINE_EXECUTION_POLICY_VERSION),
  engineConfigHash: Sha256Digest,
  querySnapshots: Schema.Array(QuerySnapshotReference).pipe(Schema.minItems(1)),
  datasetId: DatasetId,
  datasetSnapshotId: DatasetSnapshotId,
  datasetSchemaHash: Sha256Digest,
  parquetDigest: ArtifactDigest,
  resultSchemaHash: Sha256Digest,
  resultHash: Sha256Digest,
  resultArtifactHash: Sha256Digest,
  canonicalSql: NonBlank,
  resultColumns: Schema.Array(QueryResultColumn).pipe(Schema.minItems(1)),
  rowCount: Counter,
  truncated: Schema.Boolean,
  selectedColumns: Schema.Array(NonBlank).pipe(Schema.minItems(1)),
  rowStart: Counter,
  rowEndExclusive: Counter,
})

export const RecursiveProvenanceEdge = Schema.Struct({
  ...EdgeIdentity,
  kind: Schema.Literal('evidence-recursive'),
  evidenceId: CrossSourceEvidenceId,
  recursiveEvidenceId: RecursiveEvidenceId,
  sourceVersionId: SourceVersionId,
  artifactHash: Sha256Digest,
  artifactByteLength: Counter,
  artifactMediaType: NonBlank,
  locator: NonBlank,
  excerptHash: Sha256Digest,
})

export const ProvenanceEdge = Schema.Union(
  ReportClaimProvenanceEdge,
  ClaimRecursiveFindingProvenanceEdge,
  ClaimRunProvenanceEdge,
  ClaimUserProvenanceEdge,
  DocumentProvenanceEdge,
  DatasetProvenanceEdge,
  RecursiveProvenanceEdge,
)
export type ProvenanceEdge = Schema.Schema.Type<typeof ProvenanceEdge>

export const CitationValidationStatus = Schema.Literal(
  'valid',
  'stale',
  'broken',
  'unauthorized',
  'incompatible',
)
export type CitationValidationStatus =
  Schema.Schema.Type<typeof CitationValidationStatus>

export const CitationValidationReason = Schema.Literal(
  'validated',
  'report-not-found',
  'claim-not-found',
  'origin-not-found',
  'target-not-found',
  'edge-missing',
  'edge-unexpected',
  'edge-type-mismatch',
  'target-id-mismatch',
  'source-version-mismatch',
  'locator-mismatch',
  'content-hash-mismatch',
  'query-snapshot-mismatch',
  'query-sql-mismatch',
  'query-parameters-mismatch',
  'result-hash-mismatch',
  'artifact-hash-mismatch',
  'artifact-metadata-mismatch',
  'report-revision-mismatch',
  'claim-revision-mismatch',
  'revision-link-mismatch',
  'workspace-scope-mismatch',
  'project-scope-mismatch',
  'target-not-visible',
  'evidence-kind-mismatch',
  'claim-mode-mismatch',
  'hybrid-evidence-incomplete',
)
export type CitationValidationReason =
  Schema.Schema.Type<typeof CitationValidationReason>

export const CitationValidationFact = Schema.Struct({
  claimId: ClaimId,
  edgeId: ProvenanceEdgeId,
  evidenceId: Schema.NullOr(CrossSourceEvidenceId),
  reportId: ReportId,
  reportRevision: Revision,
  status: CitationValidationStatus,
  reason: CitationValidationReason,
  checkedAt: Schema.BigIntFromNumber,
})
export type CitationValidationFact =
  Schema.Schema.Type<typeof CitationValidationFact>

export const RevalidationTrigger = Schema.Union(
  Schema.Struct({ kind: Schema.Literal('publish') }),
  Schema.Struct({ kind: Schema.Literal('export') }),
  Schema.Struct({
    kind: Schema.Literal('source-version-change'),
    sourceVersionId: SourceVersionId,
  }),
)
export type RevalidationTrigger = Schema.Schema.Type<typeof RevalidationTrigger>

export const ProvenanceGraph = Schema.Struct({
  id: ProvenanceGraphId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  reportId: ReportId,
  reportRevision: Revision,
  revalidationKey: NonBlank,
  trigger: RevalidationTrigger,
  edges: Schema.Array(ProvenanceEdge).pipe(
    Schema.minItems(2),
    Schema.maxItems(4_096),
  ),
  validations: Schema.Array(CitationValidationFact).pipe(
    Schema.minItems(2),
    Schema.maxItems(4_096),
  ),
  createdAt: Schema.BigIntFromNumber,
}).pipe(
  Schema.filter((graph) => {
    const edgeIds = new Set(graph.edges.map((edge) => edge.id))
    const edgesById = new Map(graph.edges.map((edge) => [edge.id, edge]))
    const meanings = graph.edges.map((edge) =>
      JSON.stringify({ ...edge, id: undefined }))
    const reportClaims = graph.edges.filter((edge) =>
      edge.kind === 'report-claim')
    return [
      edgeIds.size === graph.edges.length
        ? undefined
        : 'provenance edge identities must be unique',
      new Set(meanings).size === meanings.length
        ? undefined
        : 'provenance edge meanings must be unique',
      new Set(reportClaims.map((edge) => edge.claimId)).size
        === reportClaims.length
        ? undefined
        : 'a provenance graph requires one report-claim edge per claim',
      graph.edges.every((edge) =>
        reportClaims.some((reportClaim) =>
          reportClaim.claimId === edge.claimId))
        ? undefined
        : 'every provenance edge must belong to a report claim',
      graph.edges.every((edge) =>
        edge.reportId === graph.reportId
        && edge.reportRevision === graph.reportRevision)
        ? undefined
        : 'provenance edges must link the projected report revision',
      graph.validations.every((fact) => edgeIds.has(fact.edgeId))
        ? undefined
        : 'citation validations must target an edge in the graph',
      graph.validations.every((fact) => {
        const edge = edgesById.get(fact.edgeId)
        const targetEvidenceId = edge !== undefined
          && (
            edge.kind === 'evidence-document'
            || edge.kind === 'evidence-dataset'
            || edge.kind === 'evidence-recursive'
          )
          ? edge.evidenceId
          : null
        return edge !== undefined
          && fact.claimId === edge.claimId
          && fact.evidenceId === targetEvidenceId
      })
        ? undefined
        : 'citation validations must match their targeted claim and evidence',
      graph.validations.every((fact) =>
        (fact.status === 'valid') === (fact.reason === 'validated'))
        ? undefined
        : 'only valid citation validations may use the validated reason',
      new Set(graph.validations.map((fact) =>
        `${fact.claimId}\u0000${fact.edgeId}`)).size === graph.validations.length
        ? undefined
        : 'a provenance graph may contain one validation per claim edge',
      graph.validations.length === graph.edges.length
        && graph.edges.every((edge) =>
          graph.validations.some((fact) => fact.edgeId === edge.id))
        ? undefined
        : 'every provenance edge requires exactly one validation fact',
      graph.validations.every((fact) =>
        fact.reportId === graph.reportId
        && fact.reportRevision === graph.reportRevision)
        ? undefined
        : 'citation validations must link the projected report revision',
      graph.validations.every((fact) => fact.checkedAt === graph.createdAt)
        ? undefined
        : 'citation validations must share one graph validation instant',
      reportClaims.every((reportClaim) => {
        const claimEdges = graph.edges.filter((edge) =>
          edge.claimId === reportClaim.claimId)
        const origins = claimEdges.filter((edge) =>
          edge.kind === 'claim-recursive-finding'
          || edge.kind === 'claim-run-output'
          || edge.kind === 'claim-user-origin')
        const evidence = claimEdges.filter((edge) =>
          edge.kind === 'evidence-document'
          || edge.kind === 'evidence-dataset'
          || edge.kind === 'evidence-recursive')
        const evidenceKinds = new Set(evidence.map((edge) => edge.kind))
        return origins.length === 1
          && claimEdges.every((edge) =>
            edge.claimRevisionId === reportClaim.claimRevisionId
            && edge.claimRevision === reportClaim.claimRevision)
          && evidence.length === reportClaim.expectedEvidenceCount
          && (
            reportClaim.evidenceMode === null
              ? evidence.length === 0
              : reportClaim.evidenceMode === 'hybrid'
                ? (
              evidenceKinds.has('evidence-document')
              && evidenceKinds.has('evidence-dataset')
                )
                : evidenceKinds.size === 1
                  && evidenceKinds.has(`evidence-${reportClaim.evidenceMode}`)
          )
      })
        ? undefined
        : 'every report claim requires exact origin and evidence edge coverage',
    ]
  }),
)
export type ProvenanceGraph = Schema.Schema.Type<typeof ProvenanceGraph>

export const CitationPublicationGate = Schema.Struct({
  reportId: ReportId,
  reportRevision: Revision,
  allowed: Schema.Boolean,
  blockingClaimIds: Schema.Array(ClaimId),
})
export type CitationPublicationGate =
  Schema.Schema.Type<typeof CitationPublicationGate>
