import {
  CitationValidationFact,
  DatasetCitationEvidence,
  DocumentChunkId,
  DocumentId,
  DocumentLocator,
  ProjectId,
  ProvenanceEdge,
  ProvenanceEdgeId,
  ProvenanceGraph,
  ProvenanceGraphId,
  RecursiveEvidenceReference,
  Report,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  type RevalidationTrigger,
} from '@struct/domain'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type {
  Claim,
  ClaimId,
  CitationValidationReason,
  CitationValidationStatus,
  CrossSourceEvidence,
  CrossSourceEvidenceId,
  ResearchFinding,
  ResearchRunId,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { canonicalJson } from '@struct/retrieval'
import { Context, Effect, Schema } from 'effect'
import { computeCrossSourceEvidenceId } from './normalize-evidence.js'

export class CitationTargetResolutionError
  extends Schema.TaggedError<CitationTargetResolutionError>()(
    'CitationTargetResolutionError',
    {
      status: Schema.Literal(
        'stale',
        'broken',
        'unauthorized',
        'incompatible',
      ),
      reason: Schema.Literal(
        'origin-not-found',
        'target-not-found',
        'source-version-mismatch',
        'workspace-scope-mismatch',
        'project-scope-mismatch',
        'target-not-visible',
        'evidence-kind-mismatch',
        'locator-mismatch',
        'artifact-hash-mismatch',
        'artifact-metadata-mismatch',
      ),
      message: Schema.String,
    },
  ) {}

export class CitationValidationLimitExceeded
  extends Schema.TaggedError<CitationValidationLimitExceeded>()(
    'CitationValidationLimitExceeded',
    {
      actualEdges: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      maximumEdges: Schema.Number.pipe(Schema.int(), Schema.positive()),
      message: Schema.String,
    },
  ) {}

export interface CitationValidationScope {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly reportId: Report['id']
  readonly reportRevision: number
}

export interface OpenDocumentEvidence {
  readonly chunkId: typeof DocumentChunkId.Type
  readonly documentId: typeof DocumentId.Type
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly chunkingVersion: string
  readonly ordinal: number
  readonly locator: typeof DocumentLocator.Type
  readonly citationLocator: string
  readonly excerpt: string
}

export interface OpenRecursiveEvidence {
  readonly reference: RecursiveEvidenceReference
  readonly excerpt: string
}

export interface CitationEvidenceResolverShape {
  readonly openOrigin: (
    scope: CitationValidationScope,
    origin:
      | { readonly kind: 'recursive-finding'; readonly finding: ResearchFinding }
      | { readonly kind: 'run'; readonly runId: typeof ResearchRunId.Type }
      | { readonly kind: 'user'; readonly actorId: string },
  ) => Effect.Effect<void, CitationTargetResolutionError>
  readonly openDocument: (
    scope: CitationValidationScope,
    evidence: CrossSourceEvidence,
  ) => Effect.Effect<OpenDocumentEvidence, CitationTargetResolutionError>
  readonly openDataset: (
    scope: CitationValidationScope,
    evidence: CrossSourceEvidence,
  ) => Effect.Effect<DatasetCitationEvidence, CitationTargetResolutionError>
  readonly openRecursive: (
    scope: CitationValidationScope,
    evidence: CrossSourceEvidence,
  ) => Effect.Effect<OpenRecursiveEvidence, CitationTargetResolutionError>
}

// Infrastructure capability: API and persistence adapters provide existing
// scoped citation-opening implementations at the composition root.
/* eslint-disable no-restricted-syntax -- Runtime-injected infrastructure capability. */
export class CitationEvidenceResolver
  extends Context.Tag('@struct/research-engine/CitationEvidenceResolver')<
    CitationEvidenceResolver,
    CitationEvidenceResolverShape
  >() {}
/* eslint-enable no-restricted-syntax */

export interface ValidateReportCitationsInput {
  readonly graphId: typeof ProvenanceGraphId.Type
  readonly report: Report
  readonly revalidationKey: string
  readonly checkedAt: bigint
  readonly trigger: RevalidationTrigger
  readonly existing: ProvenanceGraph | null
}

function digest(value: unknown): typeof Sha256Digest.Type {
  return Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256')
      .update(new TextEncoder().encode(canonicalJson(value)))
      .digest('hex')}`,
  )
}

export function computeProvenanceEdgeId(
  edge: unknown,
): typeof ProvenanceEdgeId.Type {
  return ProvenanceEdgeId.make(digest(edge))
}

function withEdgeId(edge: Readonly<Record<string, unknown>>): ProvenanceEdge {
  return Schema.decodeUnknownSync(ProvenanceEdge)({
    ...edge,
    id: computeProvenanceEdgeId(edge),
  })
}

function commonEdge(report: Report, claim: Claim) {
  const revision = claim.revisions[claim.currentRevision]!
  return {
    reportId: report.id,
    reportRevision: report.revision,
    claimId: claim.id,
    claimRevisionId: revision.id,
    claimRevision: revision.revision,
  }
}

function evidenceEdge(
  report: Report,
  claim: Claim,
  evidence: CrossSourceEvidence,
): ProvenanceEdge {
  const common = commonEdge(report, claim)
  const payload = evidence.payload
  if (payload.kind === 'document') {
    return withEdgeId({
      ...common,
      kind: 'evidence-document',
      evidenceId: evidence.id,
      chunkId: payload.chunkId,
      documentId: payload.documentId,
      sourceVersionId: payload.sourceVersionId,
      chunkingVersion: payload.chunkingVersion,
      ordinal: payload.ordinal,
      locator: payload.locator,
      citationLocator: payload.citationLocator,
      excerptHash: digest(payload.excerpt),
    })
  }
  if (payload.kind === 'dataset') {
    const citation = payload.evidence.citation
    const snapshot = payload.evidence.snapshot
    return withEdgeId({
      ...common,
      kind: 'evidence-dataset',
      evidenceId: evidence.id,
      citationId: citation.id,
      queryResultSnapshotId: citation.queryResultSnapshotId,
      requestHash: snapshot.requestHash,
      protocolVersion: snapshot.protocolVersion,
      engineVersion: snapshot.engineVersion,
      engineConfigHash: snapshot.engineConfigHash,
      querySnapshots: snapshot.snapshots,
      datasetId: citation.datasetId,
      datasetSnapshotId: citation.datasetSnapshotId,
      datasetSchemaHash: citation.schemaHash,
      parquetDigest: citation.parquetDigest,
      resultSchemaHash: snapshot.schemaHash,
      resultHash: citation.resultHash,
      resultArtifactHash: citation.resultArtifactHash,
      canonicalSql: citation.canonicalSql,
      resultColumns: snapshot.columns,
      rowCount: snapshot.rowCount,
      truncated: snapshot.truncated,
      selectedColumns: citation.selectedColumns,
      rowStart: citation.rowStart,
      rowEndExclusive: citation.rowEndExclusive,
    })
  }
  return withEdgeId({
    ...common,
    kind: 'evidence-recursive',
    evidenceId: evidence.id,
    recursiveEvidenceId: payload.reference.id,
    sourceVersionId: payload.reference.sourceVersionId,
    artifactHash: payload.reference.artifact.digest,
    artifactByteLength: payload.reference.artifact.byteLength,
    artifactMediaType: payload.reference.artifact.mediaType,
    locator: payload.reference.locator,
    excerptHash: digest(payload.excerpt),
  })
}

export function buildProvenanceEdges(report: Report): ReadonlyArray<ProvenanceEdge> {
  return report.claims.flatMap((claim) => {
    const common = commonEdge(report, claim)
    const origin = claim.origin.kind === 'research-finding'
      ? withEdgeId({
          ...common,
          kind: 'claim-recursive-finding',
          recursiveFindingId: claim.origin.finding.id,
        })
      : claim.origin.kind === 'research-run'
        ? withEdgeId({
            ...common,
            kind: 'claim-run-output',
            runId: claim.origin.runId,
          })
        : withEdgeId({
            ...common,
            kind: 'claim-user-origin',
            actorId: claim.origin.actorId,
          })
    return [
      withEdgeId({
        ...common,
        kind: 'report-claim',
        evidenceMode: claim.support.kind === 'supported'
          ? claim.support.mode
          : null,
        expectedEvidenceCount: claim.support.kind === 'supported'
          ? claim.support.evidence.length
          : 0,
      }),
      ...(origin === undefined ? [] : [origin]),
      ...(claim.support.kind === 'supported'
        ? claim.support.evidence.map((evidence) =>
            evidenceEdge(report, claim, evidence))
        : []),
    ]
  })
}

function failed(
  claimId: typeof ClaimId.Type,
  edgeId: typeof ProvenanceEdgeId.Type,
  evidenceId: typeof CrossSourceEvidenceId.Type | null,
  report: Report,
  checkedAt: bigint,
  status: CitationValidationStatus,
  reason: CitationValidationReason,
): CitationValidationFact {
  return CitationValidationFact.make({
    claimId,
    edgeId,
    evidenceId,
    reportId: report.id,
    reportRevision: report.revision,
    status,
    reason,
    checkedAt,
  })
}

function mismatchReason(
  expected: ProvenanceEdge,
  actual: ProvenanceEdge,
): readonly [CitationValidationStatus, CitationValidationReason] | undefined {
  if (expected.kind !== actual.kind) return ['incompatible', 'edge-type-mismatch']
  if (expected.reportId !== actual.reportId) return ['broken', 'revision-link-mismatch']
  if (expected.reportRevision !== actual.reportRevision) return ['stale', 'report-revision-mismatch']
  if (expected.claimId !== actual.claimId) return ['broken', 'revision-link-mismatch']
  if (
    expected.claimRevisionId !== actual.claimRevisionId
    || expected.claimRevision !== actual.claimRevision
  ) return ['broken', 'claim-revision-mismatch']
  if (expected.id !== actual.id) {
    if (expected.kind === 'evidence-document' && actual.kind === 'evidence-document') {
      if (
        expected.chunkId !== actual.chunkId
        || expected.documentId !== actual.documentId
        || expected.evidenceId !== actual.evidenceId
      ) return ['broken', 'target-id-mismatch']
      if (expected.sourceVersionId !== actual.sourceVersionId) {
        return ['stale', 'source-version-mismatch']
      }
      if (
        canonicalJson(expected.locator) !== canonicalJson(actual.locator)
        || expected.citationLocator !== actual.citationLocator
      ) return ['broken', 'locator-mismatch']
      return ['broken', 'content-hash-mismatch']
    }
    if (expected.kind === 'evidence-dataset' && actual.kind === 'evidence-dataset') {
      if (
        expected.citationId !== actual.citationId
        || expected.datasetId !== actual.datasetId
        || expected.evidenceId !== actual.evidenceId
      ) return ['broken', 'target-id-mismatch']
      if (
        expected.queryResultSnapshotId !== actual.queryResultSnapshotId
        || expected.datasetSnapshotId !== actual.datasetSnapshotId
        || expected.requestHash !== actual.requestHash
        || canonicalJson(expected.querySnapshots)
          !== canonicalJson(actual.querySnapshots)
      ) return ['stale', 'query-snapshot-mismatch']
      if (expected.canonicalSql !== actual.canonicalSql) {
        return ['broken', 'query-sql-mismatch']
      }
      if (
        expected.protocolVersion !== actual.protocolVersion
        || expected.engineVersion !== actual.engineVersion
        || expected.engineConfigHash !== actual.engineConfigHash
        || canonicalJson(expected.selectedColumns)
          !== canonicalJson(actual.selectedColumns)
        || expected.rowStart !== actual.rowStart
        || expected.rowEndExclusive !== actual.rowEndExclusive
        || canonicalJson(expected.resultColumns)
          !== canonicalJson(actual.resultColumns)
        || expected.rowCount !== actual.rowCount
        || expected.truncated !== actual.truncated
      ) return ['broken', 'query-parameters-mismatch']
      if (
        expected.resultHash !== actual.resultHash
        || expected.datasetSchemaHash !== actual.datasetSchemaHash
        || expected.resultSchemaHash !== actual.resultSchemaHash
        || expected.parquetDigest !== actual.parquetDigest
      ) return ['broken', 'result-hash-mismatch']
      return ['broken', 'artifact-hash-mismatch']
    }
    if (expected.kind === 'evidence-recursive' && actual.kind === 'evidence-recursive') {
      if (
        expected.recursiveEvidenceId !== actual.recursiveEvidenceId
        || expected.evidenceId !== actual.evidenceId
      ) return ['broken', 'target-id-mismatch']
      if (expected.sourceVersionId !== actual.sourceVersionId) {
        return ['stale', 'source-version-mismatch']
      }
      if (expected.locator !== actual.locator) return ['broken', 'locator-mismatch']
      if (expected.artifactHash !== actual.artifactHash) {
        return ['broken', 'artifact-hash-mismatch']
      }
      return ['broken', 'artifact-metadata-mismatch']
    }
    return ['broken', 'target-id-mismatch']
  }
  return undefined
}

function isOriginEdge(edge: ProvenanceEdge): boolean {
  return edge.kind === 'claim-recursive-finding'
    || edge.kind === 'claim-run-output'
    || edge.kind === 'claim-user-origin'
}

function isEvidenceEdge(edge: ProvenanceEdge): edge is Extract<
  ProvenanceEdge,
  { readonly evidenceId: typeof CrossSourceEvidenceId.Type }
> {
  return edge.kind === 'evidence-document'
    || edge.kind === 'evidence-dataset'
    || edge.kind === 'evidence-recursive'
}

function compareExistingEdge(
  report: Report,
  expectedEdges: ReadonlyArray<ProvenanceEdge>,
  expected: ProvenanceEdge,
  existing: ProvenanceGraph | null,
): readonly [CitationValidationStatus, CitationValidationReason] | undefined {
  if (existing === null) return undefined
  if (existing.workspaceId !== report.workspaceId) {
    return ['unauthorized', 'workspace-scope-mismatch']
  }
  if (existing.projectId !== report.projectId) {
    return ['unauthorized', 'project-scope-mismatch']
  }
  if (existing.reportId !== report.id) return ['broken', 'revision-link-mismatch']
  if (existing.reportRevision !== report.revision) {
    return ['stale', 'report-revision-mismatch']
  }
  const actualClaimEdges = existing.edges.filter((edge) =>
    edge.claimId === expected.claimId)
  const expectedClaimEdges = expectedEdges.filter((edge) =>
    edge.claimId === expected.claimId)
  if (
    expected.kind === 'report-claim'
    && actualClaimEdges.length > expectedClaimEdges.length
  ) return ['broken', 'edge-unexpected']
  const actual = expected.kind === 'report-claim'
    ? actualClaimEdges.find((edge) => edge.kind === 'report-claim')
    : isOriginEdge(expected)
      ? actualClaimEdges.find(isOriginEdge)
      : isEvidenceEdge(expected)
        ? actualClaimEdges.find((edge) =>
            isEvidenceEdge(edge) && edge.evidenceId === expected.evidenceId)
        : undefined
  if (actual === undefined) return ['broken', 'edge-missing']
  const mismatch = mismatchReason(expected, actual)
  if (mismatch !== undefined) return mismatch
  if (expected.id !== actual.id) {
    return ['broken', 'target-id-mismatch']
  }
  return undefined
}

function compareDocument(
  evidence: CrossSourceEvidence,
  opened: OpenDocumentEvidence,
): readonly [CitationValidationStatus, CitationValidationReason] | undefined {
  const payload = evidence.payload
  if (payload.kind !== 'document') return ['incompatible', 'evidence-kind-mismatch']
  if (
    opened.chunkId !== payload.chunkId
    || opened.documentId !== payload.documentId
  ) return ['broken', 'target-id-mismatch']
  if (opened.sourceVersionId !== payload.sourceVersionId) {
    return ['stale', 'source-version-mismatch']
  }
  if (
    opened.chunkingVersion !== payload.chunkingVersion
    || opened.ordinal !== payload.ordinal
    || canonicalJson(opened.locator) !== canonicalJson(payload.locator)
    || opened.citationLocator !== payload.citationLocator
  ) return ['broken', 'locator-mismatch']
  return digest(opened.excerpt) === digest(payload.excerpt)
    ? undefined
    : ['broken', 'content-hash-mismatch']
}

function compareDataset(
  scope: CitationValidationScope,
  evidence: CrossSourceEvidence,
  opened: DatasetCitationEvidence,
): readonly [CitationValidationStatus, CitationValidationReason] | undefined {
  const payload = evidence.payload
  if (payload.kind !== 'dataset') return ['incompatible', 'evidence-kind-mismatch']
  const expected = payload.evidence
  const left = expected.citation
  const right = opened.citation
  if (right.id !== left.id || right.datasetId !== left.datasetId) {
    return ['broken', 'target-id-mismatch']
  }
  if (
    left.workspaceId !== scope.workspaceId
    || expected.snapshot.workspaceId !== scope.workspaceId
    ||
    right.workspaceId !== left.workspaceId
    || opened.snapshot.workspaceId !== expected.snapshot.workspaceId
  ) return ['unauthorized', 'workspace-scope-mismatch']
  if (
    left.projectId !== scope.projectId
    || expected.snapshot.projectId !== scope.projectId
    ||
    right.projectId !== left.projectId
    || opened.snapshot.projectId !== expected.snapshot.projectId
  ) return ['unauthorized', 'project-scope-mismatch']
  if (
    right.queryResultSnapshotId !== left.queryResultSnapshotId
    || right.datasetSnapshotId !== left.datasetSnapshotId
    || opened.snapshot.id !== expected.snapshot.id
  ) return ['stale', 'query-snapshot-mismatch']
  if (right.canonicalSql !== left.canonicalSql) return ['broken', 'query-sql-mismatch']
  if (
    canonicalJson(right.selectedColumns) !== canonicalJson(left.selectedColumns)
    || right.rowStart !== left.rowStart
    || right.rowEndExclusive !== left.rowEndExclusive
  ) return ['broken', 'query-parameters-mismatch']
  if (
    right.schemaHash !== left.schemaHash
    || right.parquetDigest !== left.parquetDigest
    || right.resultHash !== left.resultHash
    || opened.snapshot.resultHash !== expected.snapshot.resultHash
  ) return ['broken', 'result-hash-mismatch']
  if (
    right.resultArtifactHash !== left.resultArtifactHash
    || opened.snapshot.resultArtifactHash !== expected.snapshot.resultArtifactHash
  ) return ['broken', 'artifact-hash-mismatch']
  if (
    opened.snapshot.requestHash !== expected.snapshot.requestHash
    || opened.snapshot.protocolVersion !== expected.snapshot.protocolVersion
    || opened.snapshot.engineVersion !== expected.snapshot.engineVersion
    || opened.snapshot.engineConfigHash !== expected.snapshot.engineConfigHash
    || opened.snapshot.canonicalSql !== expected.snapshot.canonicalSql
    || opened.snapshot.schemaHash !== expected.snapshot.schemaHash
    || opened.snapshot.rowCount !== expected.snapshot.rowCount
    || opened.snapshot.truncated !== expected.snapshot.truncated
    || canonicalJson(opened.snapshot.snapshots)
      !== canonicalJson(expected.snapshot.snapshots)
    || canonicalJson(opened.columns) !== canonicalJson(expected.columns)
    || canonicalJson(opened.rows) !== canonicalJson(expected.rows)
  ) return ['broken', 'result-hash-mismatch']
  return undefined
}

function compareRecursive(
  evidence: CrossSourceEvidence,
  opened: OpenRecursiveEvidence,
): readonly [CitationValidationStatus, CitationValidationReason] | undefined {
  const payload = evidence.payload
  if (payload.kind !== 'recursive') return ['incompatible', 'evidence-kind-mismatch']
  const expected = payload.reference
  const actual = opened.reference
  if (actual.id !== expected.id) return ['broken', 'target-id-mismatch']
  if (actual.sourceVersionId !== expected.sourceVersionId) {
    return ['stale', 'source-version-mismatch']
  }
  if (actual.locator !== expected.locator) return ['broken', 'locator-mismatch']
  if (actual.artifact.digest !== expected.artifact.digest) {
    return ['broken', 'artifact-hash-mismatch']
  }
  if (
    actual.artifact.byteLength !== expected.artifact.byteLength
    || actual.artifact.mediaType !== expected.artifact.mediaType
  ) return ['broken', 'artifact-metadata-mismatch']
  return digest(opened.excerpt) === digest(payload.excerpt)
    ? undefined
    : ['broken', 'content-hash-mismatch']
}

function validateMode(claim: Claim) {
  if (claim.support.kind === 'unsupported') {
    return ['incompatible', 'claim-mode-mismatch'] as const
  }
  const kinds = new Set(claim.support.evidence.map((item) => item.payload.kind))
  if (
    claim.support.mode === 'hybrid'
    && (!kinds.has('document') || !kinds.has('dataset'))
  ) return ['incompatible', 'hybrid-evidence-incomplete'] as const
  if (
    claim.support.mode !== 'hybrid'
    && (kinds.size !== 1 || !kinds.has(claim.support.mode))
  ) return ['incompatible', 'claim-mode-mismatch'] as const
  return undefined
}

export class CitationValidation
  extends Effect.Service<CitationValidation>()(
    'CitationValidation',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const resolver = yield* CitationEvidenceResolver

        const validate = Effect.fn('CitationValidation.validate')(
          function* (input: ValidateReportCitationsInput) {
            const expectedEdges = buildProvenanceEdges(input.report)
            if (expectedEdges.length > 4_096) {
              return yield* new CitationValidationLimitExceeded({
                actualEdges: expectedEdges.length,
                maximumEdges: 4_096,
                message: 'Citation validation exceeds the provenance edge and fact limit',
              })
            }
            const scope: CitationValidationScope = {
              workspaceId: input.report.workspaceId,
              projectId: input.report.projectId,
              reportId: input.report.id,
              reportRevision: input.report.revision,
            }
            const validations = yield* Effect.forEach(
              input.report.claims,
              (claim) => Effect.gen(function* () {
                const claimEdges = expectedEdges.filter((edge) =>
                  edge.claimId === claim.id)
                const reportEdge = claimEdges.find((edge) =>
                  edge.kind === 'report-claim')!
                const originEdge = claimEdges.find(isOriginEdge)!
                const evidenceEdges = claimEdges.filter(isEvidenceEdge)
                const facts: CitationValidationFact[] = []
                const reportMismatch = compareExistingEdge(
                  input.report,
                  expectedEdges,
                  reportEdge,
                  input.existing,
                ) ?? validateMode(claim)
                facts.push(failed(
                  claim.id,
                  reportEdge.id,
                  null,
                  input.report,
                  input.checkedAt,
                  reportMismatch?.[0] ?? 'valid',
                  reportMismatch?.[1] ?? 'validated',
                ))
                const origin = claim.origin.kind === 'research-finding'
                  ? {
                      kind: 'recursive-finding' as const,
                      finding: claim.origin.finding,
                    }
                  : claim.origin.kind === 'research-run'
                    ? { kind: 'run' as const, runId: claim.origin.runId }
                    : { kind: 'user' as const, actorId: claim.origin.actorId }
                const originGraphMismatch = compareExistingEdge(
                  input.report,
                  expectedEdges,
                  originEdge,
                  input.existing,
                )
                if (originGraphMismatch !== undefined) {
                  facts.push(failed(
                    claim.id,
                    originEdge.id,
                    null,
                    input.report,
                    input.checkedAt,
                    originGraphMismatch[0],
                    originGraphMismatch[1],
                  ))
                } else {
                const openedOrigin = yield* Effect.either(
                  resolver.openOrigin(scope, origin),
                )
                if (openedOrigin._tag === 'Left') {
                  facts.push(failed(
                      claim.id,
                      originEdge.id,
                      null,
                      input.report,
                      input.checkedAt,
                      openedOrigin.left.status,
                      openedOrigin.left.reason,
                  ))
                  } else {
                    facts.push(failed(
                      claim.id,
                      originEdge.id,
                      null,
                      input.report,
                      input.checkedAt,
                      'valid',
                      'validated',
                    ))
                  }
                }
                if (claim.support.kind === 'unsupported') {
                  return facts
                }
                for (const [index, evidence] of claim.support.evidence.entries()) {
                  const edge = evidenceEdges[index]!
                  const graphMismatch = compareExistingEdge(
                    input.report,
                    expectedEdges,
                    edge,
                    input.existing,
                  )
                  if (graphMismatch !== undefined) {
                    facts.push(failed(
                      claim.id,
                      edge.id,
                      evidence.id,
                      input.report,
                      input.checkedAt,
                      graphMismatch[0],
                      graphMismatch[1],
                    ))
                    continue
                  }
                  if (evidence.id !== computeCrossSourceEvidenceId(evidence)) {
                    facts.push(failed(
                      claim.id,
                      edge.id,
                      evidence.id,
                      input.report,
                      input.checkedAt,
                      'broken',
                      'target-id-mismatch',
                    ))
                    continue
                  }
                  const opened = yield* Effect.either(
                    evidence.payload.kind === 'document'
                      ? resolver.openDocument(scope, evidence).pipe(
                          Effect.map((value) => compareDocument(evidence, value)),
                        )
                      : evidence.payload.kind === 'dataset'
                        ? resolver.openDataset(scope, evidence).pipe(
                            Effect.map((value) =>
                              compareDataset(scope, evidence, value)),
                          )
                        : resolver.openRecursive(scope, evidence).pipe(
                            Effect.map((value) => compareRecursive(evidence, value)),
                          ),
                  )
                  if (opened._tag === 'Left') {
                    facts.push(failed(
                      claim.id,
                      edge.id,
                      evidence.id,
                      input.report,
                      input.checkedAt,
                      opened.left.status,
                      opened.left.reason,
                    ))
                    continue
                  }
                  if (opened.right !== undefined) {
                    facts.push(failed(
                      claim.id,
                      edge.id,
                      evidence.id,
                      input.report,
                      input.checkedAt,
                      opened.right[0],
                      opened.right[1],
                    ))
                    continue
                  }
                  facts.push(failed(
                    claim.id,
                    edge.id,
                    evidence.id,
                    input.report,
                    input.checkedAt,
                    'valid',
                    'validated',
                  ))
                }
                return facts
              }),
              { concurrency: 8 },
            )
            return ProvenanceGraph.make({
              id: input.graphId,
              workspaceId: input.report.workspaceId,
              projectId: input.report.projectId,
              reportId: input.report.id,
              reportRevision: input.report.revision,
              revalidationKey: input.revalidationKey,
              trigger: input.trigger,
              edges: expectedEdges,
              validations: validations.flat(),
              createdAt: input.checkedAt,
            })
          },
        )

        return { validate }
      }),
    },
  ) {}
