import { afterEach, describe, expect, it } from 'bun:test'
import {
  ProvenanceGraph,
  Report,
} from '@struct/domain'
import { Effect, Exit, Schema } from 'effect'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  canonicalJson,
  compareUtf8,
  prepareReportExport,
  publishReportExport,
  readVerifiedReportExport,
  verifyReportExport,
} from './export-bundle.js'
import { LocalArtifactStore } from './object-store.js'

const id = (suffix: string) =>
  `750e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const hash = (character: string) => `sha256:${character.repeat(64)}`
const workspaceId = id('1')
const projectId = id('2')
const runId = id('3')
const sourceVersionId = id('4')
const reportId = id('5')
const claimId = id('6')
const citationId = id('7')
const findingId = id('8')
const sectionId = id('9')
const claimRevisionId = id('10')
const titleRevisionId = id('11')
const sectionRevisionId = id('12')
const evidenceId = hash('1')

function report(): Report {
  return Schema.decodeUnknownSync(Schema.typeSchema(Report))({
    id: reportId,
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId],
    findingIds: [findingId],
    titleRevisions: [{
      id: titleRevisionId,
      revision: 0,
      content: 'Verified report',
      authorship: {
        kind: 'generated',
        runId,
        model: 'fixture',
        promptVersion: 'v1',
      },
      idempotencyKey: 'report:title',
      createdAt: 1n,
    }],
    currentTitleRevision: 0,
    claims: [{
      id: claimId,
      claimSignature: hash('a'),
      citation: {
        citationId,
        state: 'publishable',
        revision: 1,
        supersededBy: null,
        lastIdempotencyKey: 'citation:publish',
        updatedAt: 2n,
      },
      origin: { kind: 'research-run', runId },
      revisions: [{
        id: claimRevisionId,
        revision: 0,
        content: 'The source says café.',
        authorship: {
          kind: 'generated',
          runId,
          model: 'fixture',
          promptVersion: 'v1',
        },
        idempotencyKey: 'claim:0',
        createdAt: 1n,
      }],
      currentRevision: 0,
      support: {
        kind: 'supported',
        mode: 'document',
        evidence: [{
          id: evidenceId,
          claimSignature: hash('a'),
          stance: 'supports',
          semantics: {
            unit: null,
            timeWindow: null,
            version: 'v1',
            filters: [],
            cohort: null,
            denominator: null,
            joinKeys: [],
          },
          payload: {
            kind: 'document',
            chunkId: id('13'),
            documentId: id('14'),
            sourceVersionId,
            chunkingVersion: 'v1',
            ordinal: 0,
            locator: {
              page: 1,
              section: 'Résumé',
              paragraph: 1,
              charStart: 0,
              charEnd: 21,
              byteStart: 0,
              byteEnd: 22,
            },
            citationLocator: 'page:1:chars:0-21',
            excerpt: 'The source says café.',
            trust: 'untrusted-evidence',
          },
          limitations: [],
        }],
      },
      createdAt: 1n,
    }],
    sections: [{
      id: sectionId,
      ordinal: 0,
      heading: 'Résumé',
      revisions: [{
        id: sectionRevisionId,
        revision: 0,
        content: 'The source says café.',
        authorship: {
          kind: 'generated',
          runId,
          model: 'fixture',
          promptVersion: 'v1',
        },
        idempotencyKey: 'section:0',
        createdAt: 1n,
      }],
      currentRevision: 0,
      findingIds: [findingId],
      claimIds: [claimId],
      lastRegenerationKey: null,
    }],
    revision: 0,
    publicationState: 'publishable',
    supersededBy: null,
    lastPublicationKey: 'publish:0',
    createdAt: 1n,
    updatedAt: 2n,
  })
}

function graph(): ProvenanceGraph {
  const base = {
    reportId,
    reportRevision: 0,
    claimId,
    claimRevisionId,
    claimRevision: 0,
  }
  const edges = [{
    ...base,
    id: hash('2'),
    kind: 'report-claim',
    evidenceMode: 'document',
    expectedEvidenceCount: 1,
  }, {
    ...base,
    id: hash('3'),
    kind: 'claim-run-output',
    runId,
  }, {
    ...base,
    id: hash('4'),
    kind: 'evidence-document',
    evidenceId,
    chunkId: id('13'),
    documentId: id('14'),
    sourceVersionId,
    chunkingVersion: 'v1',
    ordinal: 0,
    locator: {
      page: 1,
      section: 'Résumé',
      paragraph: 1,
      charStart: 0,
      charEnd: 21,
      byteStart: 0,
      byteEnd: 22,
    },
    citationLocator: 'page:1:chars:0-21',
    excerptHash: `sha256:${new Bun.CryptoHasher('sha256')
      .update(new TextEncoder().encode('The source says café.'))
      .digest('hex')}`,
  }]
  return Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
    id: id('15'),
    workspaceId,
    projectId,
    reportId,
    reportRevision: 0,
    revalidationKey: 'export:0',
    trigger: { kind: 'export' },
    edges,
    validations: edges.map((edge) => ({
      claimId,
      edgeId: edge.id,
      evidenceId: edge.kind === 'evidence-document' ? evidenceId : null,
      reportId,
      reportRevision: 0,
      status: 'valid',
      reason: 'validated',
      checkedAt: 2n,
    })),
    createdAt: 2n,
  })
}

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

describe('deterministic report export bundles', () => {
  it('is byte-identical across graph insertion order and UTF-8 canonicalization', async () => {
    const first = await Effect.runPromise(prepareReportExport({
      report: report(),
      provenance: graph(),
      producerVersion: '1.0.0',
    }))
    const reordered = graph()
    const second = await Effect.runPromise(prepareReportExport({
      report: report(),
      provenance: ProvenanceGraph.make({
        ...reordered,
        edges: [...reordered.edges].reverse(),
        validations: [...reordered.validations].reverse(),
      }),
      producerVersion: '1.0.0',
    }))
    expect(second.bytes).toEqual(first.bytes)
    expect(second.digest).toBe(first.digest)
    expect(canonicalJson({ 'é': 1, z: 2 })).toBe('{"z":2,"é":1}')
    expect(compareUtf8('z', 'é')).toBeLessThan(0)
  })

  it('changes the digest for report, validation, or producer changes', async () => {
    const base = await Effect.runPromise(prepareReportExport({
      report: report(),
      provenance: graph(),
      producerVersion: '1.0.0',
    }))
    const changedProducer = await Effect.runPromise(prepareReportExport({
      report: report(),
      provenance: graph(),
      producerVersion: '1.0.1',
    }))
    const changedGraph = graph()
    const changedValidation = await Effect.runPromise(prepareReportExport({
      report: report(),
      provenance: ProvenanceGraph.make({
        ...changedGraph,
        createdAt: 3n,
        validations: changedGraph.validations.map((fact) => ({
          ...fact,
          checkedAt: 3n,
        })),
      }),
      producerVersion: '1.0.0',
    }))
    expect(changedProducer.digest).not.toBe(base.digest)
    expect(changedValidation.digest).not.toBe(base.digest)
  })

  it('round-trips offline and fails closed on hashes, paths, and trailing bytes', async () => {
    const prepared = await Effect.runPromise(prepareReportExport({
      report: report(),
      provenance: graph(),
      producerVersion: '1.0.0',
    }))
    const verified = await Effect.runPromise(
      verifyReportExport(prepared.bytes),
    )
    expect(String(verified.report.id)).toBe(reportId)
    expect(verified.provenance.id).toBe(graph().id)

    const parsed = JSON.parse(new TextDecoder().decode(prepared.bytes))
    parsed.files[0].contentBase64 =
      `${parsed.files[0].contentBase64.slice(0, -4)}AAAA`
    const tampered = new TextEncoder().encode(canonicalJson(parsed))
    expect(Exit.isFailure(
      await Effect.runPromiseExit(verifyReportExport(tampered)),
    )).toBe(true)

    const unsafe = JSON.parse(new TextDecoder().decode(prepared.bytes))
    unsafe.files[0].path = '../report.json'
    unsafe.manifest.files[0].path = '../report.json'
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyReportExport(
      new TextEncoder().encode(canonicalJson(unsafe)),
    )))).toBe(true)

    const trailing = new Uint8Array(prepared.bytes.byteLength + 1)
    trailing.set(prepared.bytes)
    trailing[trailing.length - 1] = 10
    expect(Exit.isFailure(
      await Effect.runPromiseExit(verifyReportExport(trailing)),
    )).toBe(true)

    const identity = JSON.parse(new TextDecoder().decode(prepared.bytes))
    identity.manifest.reportRevision = 1
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyReportExport(
      new TextEncoder().encode(canonicalJson(identity)),
    )))).toBe(true)

    const count = JSON.parse(new TextDecoder().decode(prepared.bytes))
    count.manifest.files.pop()
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyReportExport(
      new TextEncoder().encode(canonicalJson(count)),
    )))).toBe(true)

    const metadata = JSON.parse(new TextDecoder().decode(prepared.bytes))
    metadata.manifest.files[0].byteLength += 1
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyReportExport(
      new TextEncoder().encode(canonicalJson(metadata)),
    )))).toBe(true)

    for (const alias of ['.', 'report.json/', 'reports//report.json']) {
      const aliased = JSON.parse(new TextDecoder().decode(prepared.bytes))
      aliased.files[0].path = alias
      aliased.manifest.files[0].path = alias
      expect(Exit.isFailure(await Effect.runPromiseExit(verifyReportExport(
        new TextEncoder().encode(canonicalJson(aliased)),
      )))).toBe(true)
    }

    const duplicate = JSON.parse(new TextDecoder().decode(prepared.bytes))
    duplicate.files[1].path = duplicate.files[0].path
    duplicate.manifest.files[1].path = duplicate.manifest.files[0].path
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyReportExport(
      new TextEncoder().encode(canonicalJson(duplicate)),
    )))).toBe(true)
  })

  it('publishes duplicate requests atomically and detects stored corruption', async () => {
    const root = await mkdtemp(join(tmpdir(), 'struct-export-'))
    roots.push(root)
    const store = await Effect.runPromise(LocalArtifactStore.make({ root }))
    const input = {
      report: report(),
      provenance: graph(),
      producerVersion: '1.0.0',
    }
    const [first, second] = await Promise.all([
      Effect.runPromise(publishReportExport(store, input)),
      Effect.runPromise(publishReportExport(store, input)),
    ])
    expect(second.stored.ref).toBe(first.stored.ref)
    const reopened = await Effect.runPromise(
      readVerifiedReportExport(store, first.prepared.digest),
    )
    expect(String(reopened.verified.report.id)).toBe(reportId)

    const objectPath = join(
      root,
      'objects',
      'sha256',
      first.prepared.digest.slice(7, 9),
      first.prepared.digest.slice(7),
    )
    const bytes = await readFile(objectPath)
    bytes[0] = bytes[0] === 0 ? 1 : 0
    await writeFile(objectPath, bytes)
    expect(Exit.isFailure(await Effect.runPromiseExit(
      readVerifiedReportExport(store, first.prepared.digest),
    ))).toBe(true)
  })

  it('enforces byte and file bounds before publication', async () => {
    const byteExit = await Effect.runPromiseExit(prepareReportExport({
      report: report(),
      provenance: graph(),
      producerVersion: '1.0.0',
      maximumBytes: 100,
    }))
    const fileExit = await Effect.runPromiseExit(prepareReportExport({
      report: report(),
      provenance: graph(),
      producerVersion: '1.0.0',
      maximumFiles: 1,
    }))
    expect(Exit.isFailure(byteExit)).toBe(true)
    expect(Exit.isFailure(fileExit)).toBe(true)
  })
})
