import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Schema } from 'effect'
import {
  CitationLifecycle,
  transitionCitationState,
  validateCitationSupersession,
} from './citation-state'
import { Claim, Finding, validateFindingSupersession } from './finding'
import {
  Report,
  prepareReportPublication,
  publishReport,
  regenerateReportSection,
  validateReportSupersession,
} from './report'

const ids = {
  workspace: '550e8400-e29b-41d4-a716-446655440000',
  project: '550e8400-e29b-41d4-a716-446655440001',
  run: '550e8400-e29b-41d4-a716-446655440002',
  sourceVersion: '550e8400-e29b-41d4-a716-446655440003',
  sourceVersion2: '550e8400-e29b-41d4-a716-446655440004',
  document: '550e8400-e29b-41d4-a716-446655440005',
  chunk: '550e8400-e29b-41d4-a716-446655440006',
  dataset: '550e8400-e29b-41d4-a716-446655440007',
  datasetSnapshot: '550e8400-e29b-41d4-a716-446655440008',
  resultSnapshot: '550e8400-e29b-41d4-a716-446655440009',
  datasetCitation: '550e8400-e29b-41d4-a716-44665544000a',
  claim: '550e8400-e29b-41d4-a716-44665544000b',
  citation: '550e8400-e29b-41d4-a716-44665544000c',
  finding: '550e8400-e29b-41d4-a716-44665544000d',
  report: '550e8400-e29b-41d4-a716-44665544000e',
  section: '550e8400-e29b-41d4-a716-44665544000f',
  revision: '650e8400-e29b-41d4-a716-446655440000',
  revision2: '650e8400-e29b-41d4-a716-446655440001',
  revision3: '650e8400-e29b-41d4-a716-446655440004',
  actor: '650e8400-e29b-41d4-a716-446655440002',
  replacementCitation: '650e8400-e29b-41d4-a716-446655440003',
} as const

const hash = (character: string) => `sha256:${character.repeat(64)}`
const digest = (character: string) => character.repeat(64)

const semantics = {
  unit: null,
  timeWindow: null,
  version: 'v1',
  filters: [],
  cohort: null,
  denominator: null,
  joinKeys: [],
}

const documentEvidence = {
  id: hash('1'),
  claimSignature: hash('a'),
  stance: 'supports',
  semantics,
  payload: {
    kind: 'document',
    chunkId: ids.chunk,
    documentId: ids.document,
    sourceVersionId: ids.sourceVersion,
    chunkingVersion: 'v1',
    ordinal: 0,
    locator: {
      page: 1,
      section: 'Summary',
      paragraph: 1,
      charStart: 0,
      charEnd: 12,
      byteStart: 0,
      byteEnd: 12,
    },
    citationLocator: 'page:1:chars:0-12',
    excerpt: 'Evidence text',
    trust: 'untrusted-evidence',
  },
  limitations: [],
}

const querySnapshot = {
  id: ids.resultSnapshot,
  workspaceId: ids.workspace,
  projectId: ids.project,
  requestHash: hash('2'),
  protocolVersion: '1',
  engineVersion: 'duckdb-test',
  engineConfigHash: hash('3'),
  canonicalSql: 'SELECT total FROM evidence',
  snapshots: [{
    alias: 'evidence',
    datasetId: ids.dataset,
    snapshotId: ids.datasetSnapshot,
    schemaHash: hash('4'),
    parquetDigest: digest('5'),
  }],
  schemaHash: hash('6'),
  resultHash: hash('7'),
  resultArtifactHash: hash('8'),
  columns: [{ ordinal: 0, name: 'total', type: 'BIGINT' }],
  rows: [['42']],
  rowCount: 1,
  truncated: false,
  executedAt: 1,
  createdAt: 1,
}

const datasetCitation = {
  id: ids.datasetCitation,
  queryResultSnapshotId: ids.resultSnapshot,
  workspaceId: ids.workspace,
  projectId: ids.project,
  datasetId: ids.dataset,
  datasetSnapshotId: ids.datasetSnapshot,
  schemaHash: hash('4'),
  parquetDigest: digest('5'),
  resultHash: hash('7'),
  resultArtifactHash: hash('8'),
  canonicalSql: 'SELECT total FROM evidence',
  selectedColumns: ['total'],
  rowStart: 0,
  rowEndExclusive: 1,
  createdAt: 1,
}

const datasetEvidence = {
  id: hash('9'),
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

const recursiveEvidence = {
  id: hash('b'),
  claimSignature: hash('a'),
  stance: 'supports',
  semantics,
  payload: {
    kind: 'recursive',
    reference: {
      id: hash('c'),
      sourceVersionId: ids.sourceVersion2,
      artifact: {
        digest: hash('d'),
        byteLength: 42,
        mediaType: 'application/json',
      },
      locator: 'partition:0/finding:0',
    },
    excerpt: 'Recursive evidence',
    trust: 'untrusted-evidence',
  },
  limitations: [],
}

function revision(
  id: string = ids.revision,
  authorship: 'generated' | 'user' = 'generated',
) {
  return {
    id,
    revision: 0,
    content: 'Supported claim',
    authorship: authorship === 'generated'
      ? {
        kind: 'generated',
        runId: ids.run,
        model: 'fixture-model',
        promptVersion: 'v1',
      }
      : { kind: 'user', actorId: ids.actor },
    idempotencyKey: `revision:${id}`,
    createdAt: 1,
  }
}

function claimInput(
  mode: 'document' | 'dataset' | 'recursive' | 'hybrid' = 'document',
  citationState = 'publishable',
) {
  const evidence = mode === 'document'
    ? [documentEvidence]
    : mode === 'dataset'
      ? [datasetEvidence]
      : mode === 'recursive'
        ? [recursiveEvidence]
        : [documentEvidence, datasetEvidence]
  return {
    id: ids.claim,
    claimSignature: hash('a'),
    citation: {
      citationId: ids.citation,
      state: citationState,
      revision: 0,
      supersededBy: null,
      lastIdempotencyKey: null,
      updatedAt: 1,
    },
    origin: { kind: 'research-run', runId: ids.run },
    revisions: [revision()],
    currentRevision: 0,
    support: { kind: 'supported', mode, evidence },
    createdAt: 1,
  }
}

function reportInput() {
  return {
    id: ids.report,
    workspaceId: ids.workspace,
    projectId: ids.project,
    runId: ids.run,
    sourceVersionIds: [ids.sourceVersion],
    findingIds: [ids.finding],
    titleRevisions: [revision(ids.revision2)],
    currentTitleRevision: 0,
    claims: [claimInput()],
    sections: [{
      id: ids.section,
      ordinal: 0,
      heading: 'Summary',
      revisions: [revision(ids.revision3)],
      currentRevision: 0,
      claimIds: [ids.claim],
      lastRegenerationKey: null,
    }],
    revision: 0,
    publicationState: 'draft',
    supersededBy: null,
    lastPublicationKey: null,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('durable report lifecycle contracts', () => {
  it.each([
    ['document', [documentEvidence]],
    ['dataset', [datasetEvidence]],
    ['recursive', [recursiveEvidence]],
    ['hybrid', [documentEvidence, datasetEvidence]],
  ] as const)('retains lossless immutable %s evidence', (mode, evidence) => {
    const decoded = Schema.decodeUnknownSync(Claim)({
      ...claimInput(mode),
      support: { kind: 'supported', mode, evidence },
    })
    expect(decoded.support.kind).toBe('supported')
    if (decoded.support.kind === 'supported') {
      expect(decoded.support.evidence).toHaveLength(evidence.length)
    }
  })

  it('rejects unsupported claims marked publishable', () => {
    expect(() => Schema.decodeUnknownSync(Claim)({
      ...claimInput(),
      support: { kind: 'unsupported', reason: 'No source evidence' },
    })).toThrow()
  })

  it('rejects conflicting or signature-mismatched evidence as claim support', () => {
    expect(() => Schema.decodeUnknownSync(Claim)({
      ...claimInput(),
      support: {
        kind: 'supported',
        mode: 'document',
        evidence: [{ ...documentEvidence, stance: 'conflicts' }],
      },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Claim)({
      ...claimInput(),
      support: {
        kind: 'supported',
        mode: 'document',
        evidence: [{ ...documentEvidence, claimSignature: hash('f') }],
      },
    })).toThrow()
  })

  it('keeps generated and user authorship explicit in immutable revisions', () => {
    const decoded = Schema.decodeUnknownSync(Claim)({
      ...claimInput(),
      revisions: [
        revision(),
        {
          ...revision(ids.revision2, 'user'),
          revision: 1,
          content: 'User clarification',
        },
      ],
      currentRevision: 1,
    })
    expect(decoded.revisions.map((item) => item.authorship.kind))
      .toEqual(['generated', 'user'])
  })

  it('rejects missing scope identity and duplicate finding claims', () => {
    const finding = {
      id: ids.finding,
      workspaceId: ids.workspace,
      projectId: ids.project,
      runId: ids.run,
      sourceVersionIds: [ids.sourceVersion],
      titleRevisions: [revision(ids.revision2)],
      currentRevision: 0,
      claims: [claimInput()],
      supersededBy: null,
      createdAt: 1,
      updatedAt: 1,
    }
    expect(() => Schema.decodeUnknownSync(Finding)({
      ...finding,
      runId: undefined,
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Finding)({
      ...finding,
      claims: [claimInput(), claimInput()],
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Finding)({
      ...finding,
      sourceVersionIds: [ids.sourceVersion2],
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Finding)({
      ...finding,
      titleRevisions: [revision()],
    })).toThrow()
  })

  it('rejects dangling and duplicate report claim links', () => {
    expect(() => Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      sections: [{
        ...reportInput().sections[0],
        claimIds: ['750e8400-e29b-41d4-a716-446655440000'],
      }],
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      sections: [
        reportInput().sections[0],
        {
          ...reportInput().sections[0],
          id: '750e8400-e29b-41d4-a716-446655440001',
          ordinal: 1,
        },
      ],
    })).toThrow()
  })

  it('rejects unlinked claims and evidence outside the aggregate source scope', () => {
    const secondClaim = {
      ...claimInput(),
      id: '750e8400-e29b-41d4-a716-446655440010',
      citation: {
        ...claimInput().citation,
        citationId: '750e8400-e29b-41d4-a716-446655440011',
      },
    }
    expect(() => Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      claims: [claimInput(), secondClaim],
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      sourceVersionIds: [ids.sourceVersion2],
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      currentTitleRevision: 1,
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      titleRevisions: [revision()],
    })).toThrow()
  })

  it('applies legal citation transitions idempotently and rejects stale writes', async () => {
    const current = Schema.decodeUnknownSync(CitationLifecycle)({
      citationId: ids.citation,
      state: 'valid',
      revision: 2,
      supersededBy: null,
      lastIdempotencyKey: null,
      updatedAt: 1,
    })
    const command = {
      expectedRevision: 2,
      idempotencyKey: 'publish:citation',
      to: 'publishable' as const,
      replacementCitationId: null,
      occurredAt: 2n,
    }
    const transitioned = await Effect.runPromise(
      transitionCitationState(current, command),
    )
    expect(transitioned.revision).toBe(3)
    expect(await Effect.runPromise(
      transitionCitationState(transitioned, command),
    )).toEqual(transitioned)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      transitionCitationState(transitioned, {
        ...command,
        expectedRevision: 3,
      }),
    ))).toBe(true)

    const stale = await Effect.runPromiseExit(
      transitionCitationState(current, { ...command, expectedRevision: 1 }),
    )
    expect(Exit.isFailure(stale)).toBe(true)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      transitionCitationState(transitioned, {
        ...command,
        expectedRevision: 3,
        to: 'stale',
      }),
    ))).toBe(true)
  })

  it('rejects illegal transitions and supersession cycles', async () => {
    const current = Schema.decodeUnknownSync(CitationLifecycle)({
      citationId: ids.citation,
      state: 'draft',
      revision: 0,
      supersededBy: null,
      lastIdempotencyKey: null,
      updatedAt: 1,
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      transitionCitationState(current, {
        expectedRevision: 0,
        idempotencyKey: 'bad-transition',
        to: 'publishable',
        replacementCitationId: null,
        occurredAt: 2n,
      }),
    ))).toBe(true)

    const first = Schema.decodeUnknownSync(CitationLifecycle)({
      ...current,
      state: 'superseded',
      supersededBy: ids.replacementCitation,
      updatedAt: 1,
    })
    const second = Schema.decodeUnknownSync(CitationLifecycle)({
      ...current,
      citationId: ids.replacementCitation,
      state: 'superseded',
      supersededBy: ids.citation,
      updatedAt: 1,
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      validateCitationSupersession([first, second]),
    ))).toBe(true)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      validateCitationSupersession([first]),
    ))).toBe(true)
  })

  it('regenerates only the requested section without mutating evidence', async () => {
    const report = Schema.decodeUnknownSync(Report)(reportInput())
    const evidenceBefore = JSON.stringify(report.claims[0]?.support)
    const regenerated = await Effect.runPromise(regenerateReportSection(report, {
      sectionId: report.sections[0]!.id,
      revisionId: Schema.decodeUnknownSync(
        Schema.UUID.pipe(Schema.brand('BrandedUUID'), Schema.brand('ContentRevisionId')),
      )('750e8400-e29b-41d4-a716-446655440002'),
      expectedReportRevision: 0,
      idempotencyKey: 'regenerate:summary',
      content: 'Regenerated section',
      authorship: {
        kind: 'generated',
        runId: report.runId,
        model: 'fixture-model',
        promptVersion: 'v2',
      },
      occurredAt: 2n,
    }))
    expect(regenerated.sections[0]?.revisions).toHaveLength(2)
    expect(JSON.stringify(regenerated.claims[0]?.support)).toBe(evidenceBefore)
    expect(await Effect.runPromise(regenerateReportSection(regenerated, {
      sectionId: report.sections[0]!.id,
      revisionId: regenerated.sections[0]!.revisions[1]!.id,
      expectedReportRevision: 0,
      idempotencyKey: 'regenerate:summary',
      content: 'Regenerated section',
      authorship: regenerated.sections[0]!.revisions[1]!.authorship,
      occurredAt: 2n,
    }))).toEqual(regenerated)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      regenerateReportSection(regenerated, {
        sectionId: report.sections[0]!.id,
        revisionId: regenerated.sections[0]!.revisions[1]!.id,
        expectedReportRevision: 1,
        idempotencyKey: 'regenerate:summary',
        content: 'Different content',
        authorship: regenerated.sections[0]!.revisions[1]!.authorship,
        occurredAt: 2n,
      }),
    ))).toBe(true)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      regenerateReportSection(regenerated, {
        sectionId: report.sections[0]!.id,
        revisionId: regenerated.sections[0]!.revisions[1]!.id,
        expectedReportRevision: 1,
        idempotencyKey: 'regenerate:summary',
        content: 'Regenerated section',
        authorship: { kind: 'user', actorId: Schema.decodeUnknownSync(
          Schema.UUID.pipe(Schema.brand('BrandedUUID'), Schema.brand('ActorId')),
        )(ids.actor) },
        occurredAt: 2n,
      }),
    ))).toBe(true)
  })

  it('rejects regeneration of a superseded report', async () => {
    const report = Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      publicationState: 'superseded',
      supersededBy: '750e8400-e29b-41d4-a716-446655440020',
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      regenerateReportSection(report, {
        sectionId: report.sections[0]!.id,
        revisionId: Schema.decodeUnknownSync(
          Schema.UUID.pipe(Schema.brand('BrandedUUID'), Schema.brand('ContentRevisionId')),
        )('750e8400-e29b-41d4-a716-446655440021'),
        expectedReportRevision: 0,
        idempotencyKey: 'regenerate:superseded',
        content: 'Must not regenerate',
        authorship: report.sections[0]!.revisions[0]!.authorship,
        occurredAt: 2n,
      }),
    ))).toBe(true)
  })

  it('rejects dangling finding/report supersession and report cycles', async () => {
    const finding = Schema.decodeUnknownSync(Finding)({
      id: ids.finding,
      workspaceId: ids.workspace,
      projectId: ids.project,
      runId: ids.run,
      sourceVersionIds: [ids.sourceVersion],
      titleRevisions: [revision(ids.revision2)],
      currentRevision: 0,
      claims: [claimInput()],
      supersededBy: '750e8400-e29b-41d4-a716-446655440030',
      createdAt: 1,
      updatedAt: 1,
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      validateFindingSupersession([finding]),
    ))).toBe(true)

    const first = Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      publicationState: 'superseded',
      supersededBy: '750e8400-e29b-41d4-a716-446655440031',
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      validateReportSupersession([first]),
    ))).toBe(true)
    const second = Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      id: '750e8400-e29b-41d4-a716-446655440031',
      sections: [{
        ...reportInput().sections[0],
        id: '750e8400-e29b-41d4-a716-446655440032',
      }],
      publicationState: 'superseded',
      supersededBy: ids.report,
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      validateReportSupersession([first, second]),
    ))).toBe(true)
  })

  it('fails publication closed for any unsupported or non-publishable claim', async () => {
    const blocked = Schema.decodeUnknownSync(Report)({
      ...reportInput(),
      claims: [{
        ...claimInput(),
        citation: { ...claimInput().citation, state: 'stale' },
      }],
      publicationState: 'draft',
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      prepareReportPublication(blocked, 0, 'prepare:blocked', 2n),
    ))).toBe(true)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      publishReport(blocked, 0, 'publish:draft', 2n),
    ))).toBe(true)

    const ready = Schema.decodeUnknownSync(Report)(reportInput())
    const prepared = await Effect.runPromise(
      prepareReportPublication(ready, 0, 'prepare:ready', 2n),
    )
    const published = await Effect.runPromise(
      publishReport(prepared, 1, 'publish:ready', 3n),
    )
    expect(published.publicationState).toBe('published')
    expect(await Effect.runPromise(
      publishReport(published, 1, 'publish:ready', 3n),
    )).toEqual(published)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      publishReport(published, 0, 'publish:ready', 3n),
    ))).toBe(true)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      publishReport(prepared, 1, 'prepare:ready', 3n),
    ))).toBe(true)
  })
})
