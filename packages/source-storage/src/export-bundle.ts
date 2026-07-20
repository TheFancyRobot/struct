import {
  ExportBundleDigest,
  ExportBundleEnvelope,
  ExportBundleLimitError,
  ExportBundleManifest,
  ExportBundleStatus,
  ExportBundleVerificationError,
  ProvenanceGraph,
  Report,
  ReportExportBlockedError,
  Sha256Digest,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type {
  CrossSourceEvidence,
  ExportClaimManifest,
  ExportEvidenceReference,
} from '@struct/domain'
import type {
  ArtifactObject,
  ArtifactStoreShape,
} from './object-store.js'
/* eslint-enable no-unused-vars */

export const REPORT_EXPORT_MEDIA_TYPE =
  'application/vnd.struct.report-bundle+json' as const
export const REPORT_EXPORT_PRODUCER_VERSION = '0.0.1' as const
export const DEFAULT_EXPORT_LIMITS = {
  maximumBytes: 8 * 1024 * 1024,
  maximumFiles: 16,
} as const

export interface ReportExportInput {
  readonly report: Report
  readonly provenance: ProvenanceGraph
  readonly producerVersion: string
  readonly maximumBytes?: number
  readonly maximumFiles?: number
}

export interface PreparedReportExport {
  readonly bytes: Uint8Array
  readonly digest: typeof ExportBundleDigest.Type
  readonly envelope: ExportBundleEnvelope
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareUtf8(left, right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

function sha256(bytes: Uint8Array): typeof Sha256Digest.Type {
  return Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
  )
}

function file(
  path: 'report.json' | 'provenance.json',
  mediaType: 'application/json',
  bytes: Uint8Array,
) {
  return {
    path,
    mediaType,
    sha256: sha256(bytes),
    byteLength: bytes.byteLength,
    contentBase64: Buffer.from(bytes).toString('base64'),
  } as const
}

function excerptHash(text: string): typeof Sha256Digest.Type {
  return sha256(encoder.encode(text))
}

function evidenceReference(
  evidence: CrossSourceEvidence,
): ExportEvidenceReference {
  const payload = evidence.payload
  if (payload.kind === 'document') {
    return {
      kind: 'document',
      sourceVersionId: payload.sourceVersionId,
      locator: payload.citationLocator,
      contentHash: excerptHash(payload.excerpt),
    }
  }
  if (payload.kind === 'dataset') {
    const dataset = payload.evidence
    return {
      kind: 'dataset',
      datasetSnapshotId: dataset.citation.datasetSnapshotId,
      queryResultSnapshotId: dataset.citation.queryResultSnapshotId,
      requestHash: dataset.snapshot.requestHash,
      engineVersion: dataset.snapshot.engineVersion,
      engineConfigHash: dataset.snapshot.engineConfigHash,
      querySnapshots: dataset.snapshot.snapshots,
      schemaHash: dataset.snapshot.schemaHash,
      resultHash: dataset.snapshot.resultHash,
      resultArtifactHash: dataset.snapshot.resultArtifactHash,
      canonicalSql: dataset.snapshot.canonicalSql,
      parameters: [],
      columns: dataset.columns,
      rows: dataset.rows,
      rowStart: dataset.citation.rowStart,
      rowEndExclusive: dataset.citation.rowEndExclusive,
      unit: evidence.semantics.unit,
      timeWindow: evidence.semantics.timeWindow,
      filters: evidence.semantics.filters,
    }
  }
  return {
    kind: 'recursive',
    sourceVersionId: payload.reference.sourceVersionId,
    artifactHash: payload.reference.artifact.digest,
    locator: payload.reference.locator,
    contentHash: excerptHash(payload.excerpt),
  }
}

function normalizeProvenance(graph: ProvenanceGraph): ProvenanceGraph {
  return {
    ...graph,
    edges: [...graph.edges].sort((left, right) =>
      compareUtf8(left.id, right.id)),
    validations: [...graph.validations].sort((left, right) =>
      compareUtf8(left.edgeId, right.edgeId)
      || compareUtf8(left.claimId, right.claimId)),
  }
}

function claimManifest(
  report: Report,
): ReadonlyArray<ExportClaimManifest> {
  return report.claims.map((claim) => ({
    id: claim.id,
    currentRevisionId: claim.revisions[claim.currentRevision]!.id,
    citationStatus: 'valid',
    evidence: claim.support.kind === 'unsupported'
      ? []
      : claim.support.evidence
      .map(evidenceReference)
      .sort((left, right) =>
        compareUtf8(canonicalJson(left), canonicalJson(right))),
  }))
}

function blockingClaimIds(
  report: Report,
  graph: ProvenanceGraph,
): ReadonlyArray<Report['claims'][number]['id']> {
  const invalidClaims = new Set(
    graph.validations
      .filter((fact) => fact.status !== 'valid')
      .map((fact) => fact.claimId),
  )
  for (const claim of report.claims) {
    if (
      claim.support.kind === 'unsupported'
      || claim.citation.state !== 'publishable'
    ) invalidClaims.add(claim.id)
  }
  return report.claims
    .filter((claim) => invalidClaims.has(claim.id))
    .map((claim) => claim.id)
}

function validateInput(
  report: Report,
  graph: ProvenanceGraph,
): Effect.Effect<void, ReportExportBlockedError> {
  if (
    report.publicationState !== 'publishable'
    && report.publicationState !== 'published'
  ) {
    return Effect.fail(new ReportExportBlockedError({
      reportId: report.id,
      reason: 'report-not-publishable',
      blockingClaimIds: blockingClaimIds(report, graph),
      message: 'Only publishable or published reports can be exported',
    }))
  }
  if (
    graph.workspaceId !== report.workspaceId
    || graph.projectId !== report.projectId
    || graph.reportId !== report.id
    || graph.reportRevision !== report.revision
  ) {
    return Effect.fail(new ReportExportBlockedError({
      reportId: report.id,
      reason: 'provenance-mismatch',
      blockingClaimIds: report.claims.map((claim) => claim.id),
      message: 'Provenance does not identify the exact report revision',
    }))
  }
  const blocked = blockingClaimIds(report, graph)
  if (
    blocked.length > 0
    || graph.validations.length === 0
    || graph.validations.some((fact) => fact.status !== 'valid')
  ) {
    return Effect.fail(new ReportExportBlockedError({
      reportId: report.id,
      reason: 'citation-not-valid',
      blockingClaimIds: blocked,
      message: 'Every required citation must be valid before export',
    }))
  }
  return Effect.void
}

export const prepareReportExport = Effect.fn('ReportExport.prepare')(
  function* (input: ReportExportInput) {
    yield* validateInput(input.report, input.provenance)
    const maximumBytes = input.maximumBytes
      ?? DEFAULT_EXPORT_LIMITS.maximumBytes
    const maximumFiles = input.maximumFiles
      ?? DEFAULT_EXPORT_LIMITS.maximumFiles
    const normalizedGraph = normalizeProvenance(input.provenance)
    const reportBytes = encoder.encode(canonicalJson(
      Schema.encodeSync(Report)(input.report),
    ))
    const provenanceBytes = encoder.encode(canonicalJson(
      Schema.encodeSync(ProvenanceGraph)(normalizedGraph),
    ))
    const files = [
      file('report.json', 'application/json', reportBytes),
      file('provenance.json', 'application/json', provenanceBytes),
    ] as const
    if (files.length > maximumFiles) {
      return yield* new ExportBundleLimitError({
        limit: 'files',
        actual: files.length,
        maximum: maximumFiles,
        message: 'Report export exceeds the file-count limit',
      })
    }
    const manifest = Schema.decodeUnknownSync(
      Schema.typeSchema(ExportBundleManifest),
    )({
      schemaVersion: '1',
      producer: {
        name: '@struct/source-storage',
        version: input.producerVersion,
      },
      generatedAt: input.report.updatedAt,
      workspaceId: input.report.workspaceId,
      projectId: input.report.projectId,
      reportId: input.report.id,
      reportRevision: input.report.revision,
      provenanceGraphId: normalizedGraph.id,
      sourceVersionIds: input.report.sourceVersionIds,
      sections: input.report.sections.map((section) => ({
        id: section.id,
        ordinal: section.ordinal,
        currentRevisionId:
          section.revisions[section.currentRevision]!.id,
        findingIds: section.findingIds,
        claimIds: section.claimIds,
      })),
      claims: claimManifest(input.report),
      validations: normalizedGraph.validations,
      redactions: [
        {
          path: 'report.json',
          decision: 'included',
          reason: 'Exact immutable report revision required for offline verification',
        },
        {
          path: 'provenance.json',
          decision: 'included',
          reason: 'Exact evidence graph and validation facts required for offline verification',
        },
      ],
      files: files.map(({ contentBase64: _, ...metadata }) => metadata),
    })
    const envelope = Schema.decodeUnknownSync(
      Schema.typeSchema(ExportBundleEnvelope),
    )({
      format: 'struct-export-bundle/1',
      manifest,
      files,
    })
    const bytes = encoder.encode(canonicalJson(
      Schema.encodeSync(ExportBundleEnvelope)(envelope),
    ))
    if (bytes.byteLength > maximumBytes) {
      return yield* new ExportBundleLimitError({
        limit: 'bytes',
        actual: bytes.byteLength,
        maximum: maximumBytes,
        message: 'Report export exceeds the byte limit',
      })
    }
    return {
      bytes,
      digest: ExportBundleDigest.make(sha256(bytes)),
      envelope,
    } satisfies PreparedReportExport
  },
)

function decodeBase64(content: string): Uint8Array | undefined {
  if (
    content.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
      .test(content)
  ) return undefined
  const bytes = new Uint8Array(Buffer.from(content, 'base64'))
  return Buffer.from(bytes).toString('base64') === content
    ? bytes
    : undefined
}

function verificationFailure(
  reason: ConstructorParameters<typeof ExportBundleVerificationError>[0]['reason'],
  message: string,
) {
  return new ExportBundleVerificationError({ reason, message })
}

export const verifyReportExport = Effect.fn('ReportExport.verify')(
  function* (
    bytes: Uint8Array,
    limits: {
      readonly maximumBytes?: number
      readonly maximumFiles?: number
    } = {},
  ) {
    const maximumBytes = limits.maximumBytes
      ?? DEFAULT_EXPORT_LIMITS.maximumBytes
    const maximumFiles = limits.maximumFiles
      ?? DEFAULT_EXPORT_LIMITS.maximumFiles
    if (bytes.byteLength > maximumBytes) {
      return yield* verificationFailure(
        'file-size',
        'Bundle exceeds the verification byte limit',
      )
    }
    const text = yield* Effect.try({
      try: () => decoder.decode(bytes),
      catch: () => verificationFailure(
        'invalid-envelope',
        'Bundle is not valid UTF-8',
      ),
    })
    const parsed = yield* Effect.try({
      try: () => JSON.parse(text),
      catch: () => verificationFailure(
        'invalid-envelope',
        'Bundle is not valid JSON',
      ),
    })
    if (canonicalJson(parsed) !== text) {
      return yield* verificationFailure(
        'non-canonical',
        'Bundle bytes are not in canonical form or contain trailing bytes',
      )
    }
    const envelope = yield* Schema.decodeUnknown(ExportBundleEnvelope)(
      parsed,
    ).pipe(
      Effect.mapError(() => verificationFailure(
        'invalid-envelope',
        'Bundle envelope does not satisfy the export schema',
      )),
    )
    if (envelope.files.length > maximumFiles) {
      return yield* verificationFailure(
        'file-count',
        'Bundle exceeds the verification file-count limit',
      )
    }
    const decoded = new Map<string, Uint8Array>()
    for (const [index, item] of envelope.files.entries()) {
      const metadata = envelope.manifest.files[index]
      if (
        metadata === undefined
        || metadata.path !== item.path
        || metadata.mediaType !== item.mediaType
        || metadata.byteLength !== item.byteLength
        || metadata.sha256 !== item.sha256
      ) {
        return yield* verificationFailure(
          'file-metadata',
          'Bundle file metadata does not match the manifest',
        )
      }
      const content = decodeBase64(item.contentBase64)
      if (content === undefined || content.byteLength !== item.byteLength) {
        return yield* verificationFailure(
          'file-size',
          'Bundle file bytes do not match the declared size',
        )
      }
      if (sha256(content) !== item.sha256) {
        return yield* verificationFailure(
          'file-hash',
          'Bundle file bytes do not match the declared hash',
        )
      }
      decoded.set(item.path, content)
    }
    const reportBytes = decoded.get('report.json')
    const provenanceBytes = decoded.get('provenance.json')
    if (reportBytes === undefined || provenanceBytes === undefined) {
      return yield* verificationFailure(
        'manifest-mismatch',
        'Bundle is missing a required offline snapshot',
      )
    }
    const report = yield* Effect.try({
      try: () => Schema.decodeUnknownSync(Report)(
        JSON.parse(decoder.decode(reportBytes)),
      ),
      catch: () => verificationFailure(
        'report-decode',
        'Report snapshot cannot be decoded',
      ),
    })
    const provenance = yield* Effect.try({
      try: () => Schema.decodeUnknownSync(ProvenanceGraph)(
        JSON.parse(decoder.decode(provenanceBytes)),
      ),
      catch: () => verificationFailure(
        'provenance-decode',
        'Provenance snapshot cannot be decoded',
      ),
    })
    const rebuilt = yield* prepareReportExport({
      report,
      provenance,
      producerVersion: envelope.manifest.producer.version,
      maximumBytes,
      maximumFiles,
    }).pipe(
      Effect.mapError(() => verificationFailure(
        'manifest-mismatch',
        'Bundle snapshots are not independently exportable',
      )),
    )
    if (
      canonicalJson(Schema.encodeSync(ExportBundleEnvelope)(
        rebuilt.envelope,
      ))
      !== canonicalJson(Schema.encodeSync(ExportBundleEnvelope)(envelope))
    ) {
      return yield* verificationFailure(
        'manifest-mismatch',
        'Manifest does not bind the exact report and provenance snapshots',
      )
    }
    return {
      digest: ExportBundleDigest.make(sha256(bytes)),
      report,
      provenance,
      envelope,
    }
  },
)

export const publishReportExport = Effect.fn('ReportExport.publish')(
  function* (
    store: ArtifactStoreShape,
    input: ReportExportInput,
  ) {
    const prepared = yield* prepareReportExport(input)
    const stored = yield* store.writeObject(prepared.bytes, {
      mediaType: REPORT_EXPORT_MEDIA_TYPE,
    })
    if (
      stored.hash !== prepared.digest
      || stored.byteLength !== prepared.bytes.byteLength
    ) {
      return yield* verificationFailure(
        'file-metadata',
        'Published object metadata does not match the export bytes',
      )
    }
    return {
      prepared,
      stored,
      status: exportStatus(input.report, stored),
    }
  },
)

export function exportStatus(
  report: Report,
  artifact: ArtifactObject,
): ExportBundleStatus {
  return Schema.decodeUnknownSync(ExportBundleStatus)({
    status: 'completed',
    workspaceId: report.workspaceId,
    projectId: report.projectId,
    reportId: report.id,
    reportRevision: report.revision,
    digest: ExportBundleDigest.make(artifact.hash),
    artifactRef: artifact.ref,
    byteLength: artifact.byteLength,
    mediaType: REPORT_EXPORT_MEDIA_TYPE,
  })
}

export const readVerifiedReportExport = Effect.fn('ReportExport.readVerified')(
  function* (
    store: ArtifactStoreShape,
    digest: typeof ExportBundleDigest.Type,
  ) {
    const artifactRef =
      `artifact://sha256/${digest.slice('sha256:'.length)}` as const
    const stored = yield* store.readObject(artifactRef)
    const verified = yield* verifyReportExport(stored.bytes)
    if (verified.digest !== digest) {
      return yield* verificationFailure(
        'file-hash',
        'Bundle digest does not match the requested artifact',
      )
    }
    return { stored, verified, artifactRef }
  },
)
