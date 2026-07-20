import {
  Claim,
  Finding,
  Report,
  ReportSection,
  ReportSectionId,
} from '@struct/domain'
import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Schema } from 'effect'
import {
  AddReportSectionInput,
  ComposeReportInput,
  EditReportSectionInput,
  addReportSection,
  composeReport,
  editReportSection,
  removeReportSection,
  reorderReportSections,
} from '../src/compose-report'

const uuid = (suffix: string) =>
  `a80e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const hash = (character: string) => `sha256:${character.repeat(64)}`
const digest = (character: string) => character.repeat(64)
const workspaceId = uuid('1')
const projectId = uuid('2')
const runId = uuid('3')
const sourceVersionId = uuid('4')
const semantics = {
  unit: null,
  timeWindow: null,
  version: 'v1',
  filters: [],
  cohort: null,
  denominator: null,
  joinKeys: [],
}

function claim(
  suffix: string,
  mode: 'document' | 'dataset',
): Claim {
  const claimSignature = hash(suffix === '1' ? 'a' : 'b')
  const payload = mode === 'document'
    ? {
        kind: 'document' as const,
        chunkId: uuid(`${suffix}01`),
        documentId: uuid(`${suffix}02`),
        sourceVersionId,
        chunkingVersion: 'v1',
        ordinal: 0,
        locator: {
          page: 1,
          section: 'Summary',
          paragraph: 1,
          charStart: 0,
          charEnd: 8,
          byteStart: 0,
          byteEnd: 8,
        },
        citationLocator: 'document:chars:0-8,bytes:0-8',
        excerpt: 'Evidence',
        trust: 'untrusted-evidence' as const,
      }
    : {
        kind: 'dataset' as const,
        evidence: {
          citation: {
            id: uuid(`${suffix}03`),
            queryResultSnapshotId: uuid(`${suffix}04`),
            workspaceId,
            projectId,
            datasetId: uuid(`${suffix}05`),
            datasetSnapshotId: uuid(`${suffix}06`),
            schemaHash: hash('c'),
            parquetDigest: digest('d'),
            resultHash: hash('e'),
            resultArtifactHash: hash('f'),
            canonicalSql: 'SELECT total FROM evidence',
            selectedColumns: ['total'],
            rowStart: 0,
            rowEndExclusive: 1,
            createdAt: 1n,
          },
          snapshot: {
            id: uuid(`${suffix}04`),
            workspaceId,
            projectId,
            requestHash: hash('1'),
            protocolVersion: '1' as const,
            engineVersion: 'duckdb-test',
            engineConfigHash: hash('2'),
            canonicalSql: 'SELECT total FROM evidence',
            snapshots: [{
              alias: 'evidence',
              datasetId: uuid(`${suffix}05`),
              snapshotId: uuid(`${suffix}06`),
              schemaHash: hash('c'),
              parquetDigest: digest('d'),
            }],
            schemaHash: hash('3'),
            resultHash: hash('e'),
            resultArtifactHash: hash('f'),
            columns: [{ ordinal: 0, name: 'total', type: 'BIGINT' }],
            rows: [['42']],
            rowCount: 1,
            truncated: false,
            executedAt: 1n,
            createdAt: 1n,
          },
          columns: [{ ordinal: 0, name: 'total', type: 'BIGINT' }],
          rows: [['42']],
        },
        exactness: 'exact-immutable-query-result' as const,
      }
  return Schema.decodeUnknownSync(Schema.typeSchema(Claim))({
    id: uuid(`${suffix}10`),
    claimSignature,
    citation: {
      citationId: uuid(`${suffix}11`),
      state: 'publishable',
      revision: 0,
      supersededBy: null,
      lastIdempotencyKey: null,
      updatedAt: 1n,
    },
    origin: { kind: 'research-run', runId },
    revisions: [{
      id: uuid(`${suffix}12`),
      revision: 0,
      content: mode === 'document' ? 'Document-backed result' : 'Dataset-backed result',
      authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
      idempotencyKey: `claim:${suffix}`,
      createdAt: 1n,
    }],
    currentRevision: 0,
    support: {
      kind: 'supported',
      mode,
      evidence: [{
        id: hash(suffix),
        claimSignature,
        stance: 'supports',
        semantics,
        payload,
        limitations: [],
      }],
    },
    createdAt: 1n,
  })
}

function finding(suffix: string, mode: 'document' | 'dataset'): Finding {
  return Schema.decodeUnknownSync(Schema.typeSchema(Finding))({
    id: uuid(`${suffix}20`),
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId],
    titleRevisions: [{
      id: uuid(`${suffix}21`),
      revision: 0,
      content: `${mode} finding`,
      authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
      idempotencyKey: `finding:${suffix}`,
      createdAt: 1n,
    }],
    currentRevision: 0,
    claims: [claim(suffix, mode)],
    supersededBy: null,
    createdAt: 1n,
    updatedAt: 1n,
  })
}

const first = finding('1', 'document')
const second = finding('2', 'dataset')

async function initialReport(): Promise<Report> {
  return Effect.runPromise(composeReport(
    Schema.decodeUnknownSync(ComposeReportInput)({
    id: uuid('30'),
    workspaceId,
    projectId,
    runId,
    title: 'Evidence notebook',
    titleRevisionId: uuid('31'),
    idempotencyKey: 'compose',
    model: 'deterministic-composer',
    promptVersion: 'v1',
    sections: [{
      id: uuid('32'),
      revisionId: uuid('33'),
      heading: 'Document finding',
      findingIds: [first.id],
    }, {
      id: uuid('34'),
      revisionId: uuid('35'),
      heading: 'Dataset finding',
      findingIds: [second.id],
    }],
      occurredAt: 2,
    }),
    [first, second],
  ))
}

describe('durable report composition', () => {
  it('composes mixed immutable evidence into ordered sections', async () => {
    const report = await initialReport()
    expect(report.sections.map((section) => section.heading)).toEqual([
      'Document finding',
      'Dataset finding',
    ])
    expect(report.claims.map((item) =>
      item.support.kind === 'supported' ? item.support.mode : 'unsupported'))
      .toEqual(['document', 'dataset'])
  })

  it('adds, reorders, removes, and re-adds a finding without dangling allocation', async () => {
    const report = await initialReport()
    const removed = await Effect.runPromise(removeReportSection(
      report,
      report.sections[1]!.id,
      [first],
      0,
      3n,
    ))
    expect(removed.findingIds).toEqual([first.id])
    const readded = await Effect.runPromise(addReportSection(
      removed,
      second,
      Schema.decodeUnknownSync(AddReportSectionInput)({
        sectionId: uuid('36'),
        revisionId: uuid('37'),
        heading: 'Restored dataset finding',
        idempotencyKey: 'add-again',
        model: 'deterministic-composer',
        promptVersion: 'v1',
        expectedReportRevision: 1,
        occurredAt: 4,
      }),
    ))
    expect(readded.findingIds).toEqual([first.id, second.id])
    const reordered = await Effect.runPromise(reorderReportSections(
      readded,
      [...readded.sections].reverse().map((section) => section.id),
      2,
      5n,
    ))
    expect(reordered.sections.map((section) => section.ordinal)).toEqual([0, 1])
  })

  it('rejects duplicate retained findings and resolves an unknown section first', async () => {
    const report = await initialReport()
    const third = finding('3', 'document')
    const expanded = await Effect.runPromise(addReportSection(
      report,
      third,
      Schema.decodeUnknownSync(AddReportSectionInput)({
        sectionId: uuid('38'),
        revisionId: uuid('39'),
        heading: 'Third finding',
        idempotencyKey: 'add-third',
        model: 'deterministic-composer',
        promptVersion: 'v1',
        expectedReportRevision: 0,
        occurredAt: 3,
      }),
    ))
    expect(Exit.isFailure(await Effect.runPromiseExit(removeReportSection(
      expanded,
      expanded.sections[0]!.id,
      [second, second],
      1,
      4n,
    )))).toBe(true)

    const single = await Effect.runPromise(removeReportSection(
      report,
      report.sections[1]!.id,
      [first],
      0,
      3n,
    ))
    expect(Exit.isFailure(await Effect.runPromiseExit(removeReportSection(
      single,
      ReportSectionId.make(uuid('999')),
      [],
      1,
      4n,
    )))).toBe(true)
  })

  it('records user edits as new authored revisions and rejects stale writes', async () => {
    const report = await initialReport()
    const edited = await Effect.runPromise(editReportSection(
      report,
      Schema.decodeUnknownSync(EditReportSectionInput)({
      sectionId: report.sections[0]!.id,
      revisionId: uuid('40'),
      content: 'User-authored clarification',
      actorId: uuid('41'),
      idempotencyKey: 'edit',
      expectedReportRevision: 0,
        occurredAt: 3,
      }),
    ))
    expect(edited.sections[0]?.revisions[1]?.authorship.kind).toBe('user')
    expect(edited.sections[0]?.revisions[1]?.authorship).toMatchObject({
      actorId: uuid('41'),
    })
    expect(Exit.isFailure(await Effect.runPromiseExit(
      reorderReportSections(edited, edited.sections.map((section) => section.id), 0, 4n),
    ))).toBe(true)
  })

  it('preserves every unrelated revision hash during selected-section regeneration', async () => {
    const report = await initialReport()
    const untouched = JSON.stringify(
      Schema.encodeSync(ReportSection)(report.sections[1]!),
    )
    const edited = await Effect.runPromise(editReportSection(
      report,
      Schema.decodeUnknownSync(EditReportSectionInput)({
      sectionId: ReportSectionId.make(report.sections[0]!.id),
      revisionId: uuid('42'),
      content: 'Only this section changes',
      actorId: uuid('41'),
      idempotencyKey: 'selected-only',
      expectedReportRevision: 0,
        occurredAt: 3,
      }),
    ))
    expect(JSON.stringify(
      Schema.encodeSync(ReportSection)(edited.sections[1]!),
    )).toBe(untouched)
    expect(Schema.encodeSync(Schema.Array(Claim))(edited.claims))
      .toEqual(Schema.encodeSync(Schema.Array(Claim))(report.claims))
  })
})
