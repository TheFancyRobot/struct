import { describe, expect, it } from 'bun:test'
import {
  CitationId,
  ClaimId,
  CrossSourceEvidence,
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  DocumentChunkId,
  DocumentId,
  ProjectId,
  ProvenanceGraph,
  ProvenanceEdgeId,
  ProvenanceGraphId,
  QueryResultSnapshotId,
  Report,
  ReportId,
  ReportSectionId,
  ResearchRunId,
  RecursiveEvidenceId,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  type ClaimEvidenceMode,
  type CrossSourceEvidenceInput,
} from '@struct/domain'
import { Effect, Layer, Schema } from 'effect'
import {
  CitationEvidenceResolver,
  CitationValidation,
  CitationValidationLimitExceeded,
  citationPublicationGate,
  computeCrossSourceEvidenceId,
  computeProvenanceEdgeId,
  requireValidCitationsForPublication,
  type CitationEvidenceResolverShape,
} from '../src/index.js'

const uuid = (suffix: string) => `750e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const hash = (character: string) =>
  Sha256Digest.make(`sha256:${character.repeat(64)}`)
const rawDigest = (character: string) => character.repeat(64)
const workspaceId = WorkspaceId.make(uuid('1'))
const projectId = ProjectId.make(uuid('2'))
const runId = ResearchRunId.make(uuid('3'))
const sourceVersionId = SourceVersionId.make(uuid('4'))
const secondSourceVersionId = SourceVersionId.make(uuid('5'))

const semantics = {
  unit: null,
  timeWindow: null,
  version: 'v1',
  filters: [],
  cohort: null,
  denominator: null,
  joinKeys: [],
}

const documentInput: CrossSourceEvidenceInput = {
  claimSignature: hash('a'),
  stance: 'supports',
  semantics,
  payload: {
    kind: 'document',
    chunkId: DocumentChunkId.make(uuid('6')),
    documentId: DocumentId.make(uuid('7')),
    sourceVersionId,
    chunkingVersion: 'chunk-v1',
    ordinal: 0,
    locator: {
      page: 1,
      section: 'Summary',
      paragraph: 1,
      charStart: 0,
      charEnd: 13,
      byteStart: 0,
      byteEnd: 13,
    },
    citationLocator: 'document:chars:0-13,bytes:0-13',
    excerpt: 'Evidence text',
    trust: 'untrusted-evidence',
  },
  limitations: [],
}

const querySnapshot = {
  id: QueryResultSnapshotId.make(uuid('8')),
  workspaceId,
  projectId,
  requestHash: hash('b'),
  protocolVersion: '1' as const,
  engineVersion: 'duckdb-test',
  engineConfigHash: hash('c'),
  canonicalSql: 'SELECT total FROM evidence',
  snapshots: [{
    alias: 'evidence',
    datasetId: DatasetId.make(uuid('9')),
    snapshotId: DatasetSnapshotId.make(uuid('10')),
    schemaHash: hash('d'),
    parquetDigest: rawDigest('e'),
  }],
  schemaHash: hash('f'),
  resultHash: hash('1'),
  resultArtifactHash: hash('2'),
  columns: [{ ordinal: 0, name: 'total', type: 'BIGINT' }],
  rows: [['42']],
  rowCount: 1,
  truncated: false,
  executedAt: 1n,
  createdAt: 1n,
}

const datasetCitation = {
  id: DatasetCitationId.make(uuid('11')),
  queryResultSnapshotId: querySnapshot.id,
  workspaceId,
  projectId,
  datasetId: querySnapshot.snapshots[0].datasetId,
  datasetSnapshotId: querySnapshot.snapshots[0].snapshotId,
  schemaHash: querySnapshot.snapshots[0].schemaHash,
  parquetDigest: querySnapshot.snapshots[0].parquetDigest,
  resultHash: querySnapshot.resultHash,
  resultArtifactHash: querySnapshot.resultArtifactHash,
  canonicalSql: querySnapshot.canonicalSql,
  selectedColumns: ['total'],
  rowStart: 0,
  rowEndExclusive: 1,
  createdAt: 1n,
}

const datasetInput: CrossSourceEvidenceInput = {
  claimSignature: hash('a'),
  stance: 'supports',
  semantics,
  payload: {
    kind: 'dataset',
    evidence: {
      citation: datasetCitation,
      snapshot: querySnapshot,
      columns: querySnapshot.columns,
      rows: querySnapshot.rows,
    },
    exactness: 'exact-immutable-query-result',
  },
  limitations: [],
}

const recursiveInput: CrossSourceEvidenceInput = {
  claimSignature: hash('a'),
  stance: 'supports',
  semantics,
  payload: {
    kind: 'recursive',
    reference: {
      id: RecursiveEvidenceId.make(hash('3')),
      sourceVersionId: secondSourceVersionId,
      artifact: {
        digest: hash('4'),
        byteLength: 42,
        mediaType: 'application/vnd.struct.recursive-batch-evidence+json',
      },
      locator: 'partition:0/finding:0',
    },
    excerpt: 'Recursive evidence',
    trust: 'untrusted-evidence',
  },
  limitations: [],
}

function evidence(input: CrossSourceEvidenceInput): CrossSourceEvidence {
  return Schema.decodeUnknownSync(Schema.typeSchema(CrossSourceEvidence))({
    ...input,
    id: computeCrossSourceEvidenceId(input),
  })
}

const documentEvidence = evidence(documentInput)
const datasetEvidence = evidence(datasetInput)
const recursiveEvidence = evidence(recursiveInput)

function report(mode: ClaimEvidenceMode): Report {
  const selected = mode === 'document'
    ? [documentEvidence]
    : mode === 'dataset'
      ? [datasetEvidence]
      : mode === 'recursive'
        ? [recursiveEvidence]
        : [documentEvidence, datasetEvidence]
  return Schema.decodeUnknownSync(Schema.typeSchema(Report))({
    id: ReportId.make(uuid(mode === 'hybrid' ? '15' : '12')),
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId, secondSourceVersionId],
    findingIds: [uuid('19')],
    titleRevisions: [{
      id: uuid('20'),
      revision: 0,
      content: 'Citation report',
      authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
      idempotencyKey: 'report-title',
      createdAt: 1n,
    }],
    currentTitleRevision: 0,
    claims: [{
      id: uuid('21'),
      claimSignature: hash('a'),
      citation: {
        citationId: CitationId.make(uuid('22')),
        state: 'valid',
        revision: 0,
        supersededBy: null,
        lastIdempotencyKey: null,
        updatedAt: 1n,
      },
      origin: { kind: 'research-run', runId },
      revisions: [{
        id: uuid('23'),
        revision: 0,
        content: 'Supported claim',
        authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
        idempotencyKey: 'claim-revision',
        createdAt: 1n,
      }],
      currentRevision: 0,
      support: { kind: 'supported', mode, evidence: selected },
      createdAt: 1n,
    }],
    sections: [{
      id: ReportSectionId.make(uuid('24')),
      ordinal: 0,
      heading: 'Summary',
      revisions: [{
        id: uuid('25'),
        revision: 0,
        content: 'Supported claim',
        authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
        idempotencyKey: 'section-revision',
        createdAt: 1n,
      }],
      currentRevision: 0,
      findingIds: [uuid('19')],
      claimIds: [uuid('21')],
      lastRegenerationKey: null,
    }],
    revision: 0,
    publicationState: 'draft',
    supersededBy: null,
    lastPublicationKey: null,
    createdAt: 1n,
    updatedAt: 1n,
  })
}

const resolver: CitationEvidenceResolverShape = {
  openOrigin: () => Effect.void,
  openDocument: (_scope, item) => {
    const payload = item.payload
    return payload.kind === 'document'
      ? Effect.succeed({
          chunkId: payload.chunkId,
          documentId: payload.documentId,
          sourceVersionId: payload.sourceVersionId,
          chunkingVersion: payload.chunkingVersion,
          ordinal: payload.ordinal,
          locator: payload.locator,
          citationLocator: payload.citationLocator,
          excerpt: payload.excerpt,
        })
      : Effect.die('wrong evidence kind')
  },
  openDataset: (_scope, item) =>
    item.payload.kind === 'dataset'
      ? Effect.succeed(item.payload.evidence)
      : Effect.die('wrong evidence kind'),
  openRecursive: (_scope, item) =>
    item.payload.kind === 'recursive'
      ? Effect.succeed({
          reference: item.payload.reference,
          excerpt: item.payload.excerpt,
        })
      : Effect.die('wrong evidence kind'),
}

const validationLayer = CitationValidation.Default.pipe(
  Layer.provide(Layer.succeed(CitationEvidenceResolver, resolver)),
)

function validate(
  value: Report,
  existing: ProvenanceGraph | null = null,
) {
  return Effect.runPromise(
    CitationValidation.validate({
      graphId: ProvenanceGraphId.make(uuid('30')),
      report: value,
      revalidationKey: 'validate:test',
      checkedAt: 10n,
      trigger: { kind: 'publish' },
      existing,
    }).pipe(Effect.provide(validationLayer)),
  )
}

function replaceEdge(
  graph: ProvenanceGraph,
  targetId: typeof ProvenanceEdgeId.Type,
  replacement: ProvenanceGraph['edges'][number],
): ProvenanceGraph {
  return Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
    ...graph,
    edges: graph.edges.map((edge) =>
      edge.id === targetId ? replacement : edge),
    validations: graph.validations.map((fact) =>
      fact.edgeId === targetId
        ? { ...fact, edgeId: replacement.id }
        : fact),
  })
}

describe('citation validation and provenance graph', () => {
  it.each(['document', 'dataset', 'recursive', 'hybrid'] as const)(
    'opens and preserves exact %s evidence',
    async (mode) => {
      const graph = await validate(report(mode))
      expect(graph.validations.map((fact) => [fact.status, fact.reason]))
        .toEqual(graph.validations.map(() => ['valid', 'validated']))
      const targetEdges = graph.edges.filter((edge) =>
        edge.kind.startsWith('evidence-'))
      expect(targetEdges).toHaveLength(mode === 'hybrid' ? 2 : 1)
      if (mode === 'dataset') {
        const edge = graph.edges.find((item) => item.kind === 'evidence-dataset')
        expect(edge?.kind).toBe('evidence-dataset')
        if (edge?.kind === 'evidence-dataset') {
          expect(edge.requestHash).toBe(querySnapshot.requestHash)
          expect(edge.canonicalSql).toBe(querySnapshot.canonicalSql)
          expect(edge.resultHash).toBe(querySnapshot.resultHash)
          expect(edge.querySnapshots).toEqual(querySnapshot.snapshots)
        }
      }
      if (mode === 'recursive') {
        const edge = graph.edges.find((item) => item.kind === 'evidence-recursive')
        expect(edge?.kind === 'evidence-recursive' && edge.artifactHash)
          .toBe(hash('4'))
        expect(Schema.decodeUnknownSync(ProvenanceGraph)(
          Schema.encodeSync(ProvenanceGraph)(graph),
        )).toEqual(graph)
      }
    },
  )

  it('reports independent target, version, locator, hash, scope, revision, and edge-kind reasons', async () => {
    const value = report('document')
    const base = await validate(value)
    const target = base.edges.find((edge) => edge.kind === 'evidence-document')!
    if (target.kind !== 'evidence-document') throw new Error('fixture edge missing')
    const cases = [
      {
        expected: 'target-id-mismatch',
        edge: { ...target, chunkId: DocumentChunkId.make(uuid('41')) },
      },
      {
        expected: 'source-version-mismatch',
        edge: { ...target, sourceVersionId: SourceVersionId.make(uuid('42')) },
      },
      {
        expected: 'locator-mismatch',
        edge: { ...target, locator: { ...target.locator, charEnd: 12 } },
      },
      {
        expected: 'content-hash-mismatch',
        edge: { ...target, excerptHash: hash('9') },
      },
    ] as const
    for (const item of cases) {
      const { id: _discarded, ...meaning } = item.edge
      const changed = {
        ...item.edge,
        id: computeProvenanceEdgeId(meaning),
      }
      const existing = replaceEdge(base, target.id, changed)
      const checked = await validate(value, existing)
      expect(checked.validations.find((fact) =>
        fact.evidenceId === target.evidenceId)?.reason).toBe(item.expected)
    }

    const unauthorized = ProvenanceGraph.make({
      ...base,
      workspaceId: WorkspaceId.make(uuid('43')),
    })
    const scoped = await validate(value, unauthorized)
    expect(scoped.validations.some((fact) =>
      fact.reason === 'workspace-scope-mismatch')).toBe(true)
  })

  it('diagnoses every immutable dataset identity independently after outer edge identity is recomputed', async () => {
    const value = report('dataset')
    const base = await validate(value)
    const target = base.edges.find((edge) => edge.kind === 'evidence-dataset')!
    if (target.kind !== 'evidence-dataset') throw new Error('fixture edge missing')
    const cases = [
      ['target-id-mismatch', {
        ...target,
        citationId: DatasetCitationId.make(uuid('51')),
      }],
      ['query-snapshot-mismatch', {
        ...target,
        queryResultSnapshotId: QueryResultSnapshotId.make(uuid('52')),
      }],
      ['query-sql-mismatch', {
        ...target,
        canonicalSql: 'SELECT changed FROM evidence',
      }],
      ['query-parameters-mismatch', {
        ...target,
        selectedColumns: ['changed'],
      }],
      ['result-hash-mismatch', {
        ...target,
        resultHash: hash('6'),
      }],
      ['artifact-hash-mismatch', {
        ...target,
        resultArtifactHash: hash('7'),
      }],
    ] as const
    for (const [reason, candidate] of cases) {
      const { id: _discarded, ...meaning } = candidate
      const changed = {
        ...candidate,
        id: computeProvenanceEdgeId(meaning),
      }
      const existing = replaceEdge(base, target.id, changed)
      const checked = await validate(value, existing)
      expect(checked.validations.find((fact) =>
        fact.evidenceId === target.evidenceId)?.reason).toBe(reason)
    }
  })

  it('source-version-change revalidation never retargets old evidence', async () => {
    const value = report('document')
    const initial = await validate(value)
    const refreshed = await Effect.runPromise(
      CitationValidation.validate({
        graphId: ProvenanceGraphId.make(uuid('53')),
        report: value,
        revalidationKey: 'source-version-change:test',
        checkedAt: 20n,
        trigger: {
          kind: 'source-version-change',
          sourceVersionId,
        },
        existing: initial,
      }).pipe(Effect.provide(validationLayer)),
    )
    expect(refreshed.trigger).toEqual({
      kind: 'source-version-change',
      sourceVersionId,
    })
    expect(refreshed.edges.map((edge) => edge.id))
      .toEqual(initial.edges.map((edge) => edge.id))
    const edge = refreshed.edges.find((item) => item.kind === 'evidence-document')
    expect(edge?.kind === 'evidence-document' && edge.sourceVersionId)
      .toBe(sourceVersionId)
  })

  it('rejects orphan edges and incomplete edge/fact coverage', async () => {
    const base = await validate(report('document'))
    expect(() => Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
      ...base,
      edges: [],
      validations: [],
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
      ...base,
      validations: base.validations.slice(1),
    })).toThrow()
    const evidenceEdge = base.edges.find((edge) =>
      edge.kind === 'evidence-document')!
    const orphanClaimId = ClaimId.make(uuid('54'))
    const { id: _orphanOriginalId, ...orphanOriginalMeaning } = evidenceEdge
    const orphanMeaning = { ...orphanOriginalMeaning, claimId: orphanClaimId }
    const orphanEdge = {
      ...evidenceEdge,
      claimId: orphanClaimId,
      id: computeProvenanceEdgeId(orphanMeaning),
    }
    expect(() => Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
      ...base,
      edges: [...base.edges, orphanEdge],
      validations: [...base.validations, {
        ...base.validations.find((fact) => fact.edgeId === evidenceEdge.id),
        claimId: orphanClaimId,
        edgeId: orphanEdge.id,
      }],
    })).toThrow()

    const origin = base.edges.find((edge) => edge.kind === 'claim-run-output')!
    const { id: _originId, ...originMeaning } = origin
    const mixedRevision = {
      ...origin,
      claimRevision: origin.claimRevision + 1,
      id: computeProvenanceEdgeId({
        ...originMeaning,
        claimRevision: origin.claimRevision + 1,
      }),
    }
    expect(() => replaceEdge(base, origin.id, mixedRevision)).toThrow()

    const reportClaim = base.edges.find((edge) => edge.kind === 'report-claim')!
    if (reportClaim.kind !== 'report-claim') {
      throw new Error('fixture report edge missing')
    }
    const { id: _reportClaimId, ...reportClaimMeaning } = reportClaim
    const wrongMode = {
      ...reportClaim,
      evidenceMode: 'dataset' as const,
      id: computeProvenanceEdgeId({
        ...reportClaimMeaning,
        evidenceMode: 'dataset',
      }),
    }
    expect(() => replaceEdge(base, reportClaim.id, wrongMode)).toThrow()
  })

  it('rejects internally consistent dataset evidence outside report scope', async () => {
    const foreignWorkspaceId = WorkspaceId.make(uuid('56'))
    const foreignProjectId = ProjectId.make(uuid('57'))
    const foreignInput: CrossSourceEvidenceInput = {
      ...datasetInput,
      payload: datasetInput.payload.kind === 'dataset'
        ? {
            ...datasetInput.payload,
            evidence: {
              ...datasetInput.payload.evidence,
              citation: {
                ...datasetInput.payload.evidence.citation,
                workspaceId: foreignWorkspaceId,
                projectId: foreignProjectId,
              },
              snapshot: {
                ...datasetInput.payload.evidence.snapshot,
                workspaceId: foreignWorkspaceId,
                projectId: foreignProjectId,
              },
            },
          }
        : datasetInput.payload,
    }
    const value = report('dataset')
    const foreignEvidence = evidence(foreignInput)
    const foreignReport = Schema.decodeUnknownSync(Schema.typeSchema(Report))({
      ...value,
      claims: value.claims.map((claim) => ({
        ...claim,
        support: {
          kind: 'supported',
          mode: 'dataset',
          evidence: [foreignEvidence],
        },
      })),
    })
    const checked = await validate(foreignReport)
    const fact = checked.validations.find((item) => item.evidenceId !== null)
    expect(fact?.status).toBe('unauthorized')
    expect(fact?.reason).toBe('workspace-scope-mismatch')
  })

  it('propagates resolver defects instead of converting them to broken facts', async () => {
    const defective: CitationEvidenceResolverShape = {
      ...resolver,
      openDocument: () => Effect.die('resolver defect'),
    }
    const defectiveLayer = CitationValidation.Default.pipe(
      Layer.provide(Layer.succeed(CitationEvidenceResolver, defective)),
    )
    const exit = await Effect.runPromiseExit(
      CitationValidation.validate({
        graphId: ProvenanceGraphId.make(uuid('55')),
        report: report('document'),
        revalidationKey: 'defect:test',
        checkedAt: 10n,
        trigger: { kind: 'publish' },
        existing: null,
      }).pipe(Effect.provide(defectiveLayer)),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(exit.cause.toString()).toContain('resolver defect')
      expect(exit.cause.toString()).not.toContain('target-not-found')
    }
  })

  it('detects recursive excerpt tampering after the outer evidence identity is recomputed', async () => {
    if (recursiveInput.payload.kind !== 'recursive') {
      throw new Error('fixture recursive evidence missing')
    }
    const recursivePayload = recursiveInput.payload
    const tamperedEvidence = evidence({
      ...recursiveInput,
      payload: {
        ...recursivePayload,
        excerpt: 'Tampered recursive evidence',
      },
    })
    const value = report('recursive')
    const tamperedReport = Schema.decodeUnknownSync(Schema.typeSchema(Report))({
      ...value,
      claims: value.claims.map((claim) => ({
        ...claim,
        support: {
          kind: 'supported',
          mode: 'recursive',
          evidence: [tamperedEvidence],
        },
      })),
    })
    const independentResolver: CitationEvidenceResolverShape = {
      ...resolver,
      openRecursive: () => Effect.succeed({
        reference: recursivePayload.reference,
        excerpt: recursivePayload.excerpt,
      }),
    }
    const independentLayer = CitationValidation.Default.pipe(
      Layer.provide(Layer.succeed(
        CitationEvidenceResolver,
        independentResolver,
      )),
    )
    const checked = await Effect.runPromise(
      CitationValidation.validate({
        graphId: ProvenanceGraphId.make(uuid('58')),
        report: tamperedReport,
        revalidationKey: 'recursive-tamper:test',
        checkedAt: 10n,
        trigger: { kind: 'publish' },
        existing: null,
      }).pipe(Effect.provide(independentLayer)),
    )
    expect(checked.validations.find((fact) =>
      fact.evidenceId === tamperedEvidence.id)?.reason)
      .toBe('content-hash-mismatch')
  })

  it('rejects an oversized report before invoking any resolver', async () => {
    const base = report('document')
    const claims = Array.from({ length: 2_049 }, (_, index) => {
      const claimId = ClaimId.make(uuid(String(100_000 + index)))
      return {
        ...base.claims[0]!,
        id: claimId,
        citation: {
          ...base.claims[0]!.citation,
          citationId: CitationId.make(uuid(String(200_000 + index))),
        },
        revisions: [{
          ...base.claims[0]!.revisions[0]!,
          id: uuid(String(300_000 + index)),
        }],
        support: {
          kind: 'unsupported' as const,
          reason: 'No evidence',
        },
      }
    })
    const oversized = Schema.decodeUnknownSync(Schema.typeSchema(Report))({
      ...base,
      claims,
      sections: [{
        ...base.sections[0]!,
        claimIds: claims.map((claim) => claim.id),
      }],
    })
    let resolverCalls = 0
    const countingResolver: CitationEvidenceResolverShape = {
      ...resolver,
      openOrigin: () => {
        resolverCalls += 1
        return Effect.void
      },
    }
    const countingLayer = CitationValidation.Default.pipe(
      Layer.provide(Layer.succeed(CitationEvidenceResolver, countingResolver)),
    )
    const exit = await Effect.runPromiseExit(
      CitationValidation.validate({
        graphId: ProvenanceGraphId.make(uuid('59')),
        report: oversized,
        revalidationKey: 'oversized:test',
        checkedAt: 10n,
        trigger: { kind: 'publish' },
        existing: null,
      }).pipe(Effect.provide(countingLayer)),
    )
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(exit.cause.toString()).toContain(
        CitationValidationLimitExceeded.name,
      )
    }
    expect(resolverCalls).toBe(0)
  })

  it('fails publication closed for partial sets, unsupported facts, and any invalid hybrid edge', async () => {
    const graph = await validate(report('hybrid'))
    const claimId = graph.edges.find((edge) => edge.kind === 'report-claim')!.claimId
    expect((await Effect.runPromise(citationPublicationGate(
      graph.reportId,
      graph.reportRevision,
      [claimId],
      graph,
    ))).allowed).toBe(true)
    expect((await Effect.runPromise(citationPublicationGate(
      graph.reportId,
      graph.reportRevision,
      [],
      graph,
    ))).allowed).toBe(false)
    const evidenceFact = graph.validations.find((fact) =>
      fact.evidenceId !== null)!
    const invalid = Schema.decodeUnknownSync(
      Schema.typeSchema(ProvenanceGraph),
    )({
      ...graph,
      validations: graph.validations.map((fact) =>
        fact.edgeId === evidenceFact.edgeId
          ? { ...fact, status: 'broken', reason: 'content-hash-mismatch' }
          : fact),
    })
    const exit = await Effect.runPromiseExit(requireValidCitationsForPublication(
      graph.reportId,
      graph.reportRevision,
      [claimId],
      invalid,
    ))
    expect(exit._tag).toBe('Failure')
  })
})
