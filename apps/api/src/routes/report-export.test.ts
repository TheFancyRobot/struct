import { describe, expect, it } from 'bun:test'
import {
  ExportBundleDigest,
  ExportBundleStatus,
  ProvenanceGraph,
  Report,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import { reportExportRoute } from './report-export.js'

const id = (suffix: string) =>
  `850e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const hash = (character: string) => `sha256:${character.repeat(64)}`
const workspaceId = id('1')
const projectId = id('2')
const reportId = id('3')
const runId = id('4')
const claimId = id('5')
const revisionId = id('6')
const digest = ExportBundleDigest.make(hash('a'))
const bytes = new TextEncoder().encode('verified-export')

function report(): Report {
  return Schema.decodeUnknownSync(Schema.typeSchema(Report))({
    id: reportId,
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [id('7')],
    findingIds: [id('8')],
    titleRevisions: [{
      id: id('9'),
      revision: 0,
      content: 'Draft',
      authorship: {
        kind: 'generated',
        runId,
        model: 'fixture',
        promptVersion: 'v1',
      },
      idempotencyKey: 'title',
      createdAt: 1n,
    }],
    currentTitleRevision: 0,
    claims: [{
      id: claimId,
      claimSignature: hash('1'),
      citation: {
        citationId: id('10'),
        state: 'draft',
        revision: 0,
        supersededBy: null,
        lastIdempotencyKey: null,
        updatedAt: 1n,
      },
      origin: { kind: 'research-run', runId },
      revisions: [{
        id: revisionId,
        revision: 0,
        content: 'Draft claim',
        authorship: {
          kind: 'generated',
          runId,
          model: 'fixture',
          promptVersion: 'v1',
        },
        idempotencyKey: 'claim',
        createdAt: 1n,
      }],
      currentRevision: 0,
      support: { kind: 'unsupported', reason: 'fixture' },
      createdAt: 1n,
    }],
    sections: [{
      id: id('11'),
      ordinal: 0,
      heading: 'Summary',
      revisions: [{
        id: id('12'),
        revision: 0,
        content: 'Draft claim',
        authorship: {
          kind: 'generated',
          runId,
          model: 'fixture',
          promptVersion: 'v1',
        },
        idempotencyKey: 'section',
        createdAt: 1n,
      }],
      currentRevision: 0,
      findingIds: [id('8')],
      claimIds: [claimId],
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

function provenance(): ProvenanceGraph {
  const edgeIds = [hash('2'), hash('3')]
  return Schema.decodeUnknownSync(Schema.typeSchema(ProvenanceGraph))({
    id: id('13'),
    workspaceId,
    projectId,
    reportId,
    reportRevision: 0,
    revalidationKey: 'fixture',
    trigger: { kind: 'export' },
    edges: [{
      id: edgeIds[0],
      kind: 'report-claim',
      reportId,
      reportRevision: 0,
      claimId,
      claimRevisionId: revisionId,
      claimRevision: 0,
      evidenceMode: null,
      expectedEvidenceCount: 0,
    }, {
      id: edgeIds[1],
      kind: 'claim-run-output',
      reportId,
      reportRevision: 0,
      claimId,
      claimRevisionId: revisionId,
      claimRevision: 0,
      runId,
    }],
    validations: edgeIds.map((edgeId) => ({
      claimId,
      edgeId,
      evidenceId: null,
      reportId,
      reportRevision: 0,
      status: 'valid',
      reason: 'validated',
      checkedAt: 1n,
    })),
    createdAt: 1n,
  })
}

function status() {
  return Schema.decodeUnknownSync(
    Schema.typeSchema(ExportBundleStatus),
  )({
    status: 'completed',
    workspaceId,
    projectId,
    reportId,
    reportRevision: 0,
    digest,
    artifactRef: `artifact://sha256/${digest.slice(7)}`,
    byteLength: bytes.byteLength,
    mediaType: 'application/vnd.struct.report-bundle+json',
  })
}

interface Overrides {
  readonly authorize?: 'allow' | 'deny'
  readonly sources?: 'allow' | 'deny'
  readonly read?: 'allow' | 'deny'
}

function deps(overrides: Overrides = {}) {
  return {
    producerVersion: '0.0.1',
    authorize: () => overrides.authorize === 'deny'
      ? Effect.fail({ _tag: 'AuthorizationError' as const })
      : Effect.void,
    findReportRevision: () => Effect.succeed(report()),
    findProvenance: () => Effect.succeed(provenance()),
    authorizeSources: () => overrides.sources === 'deny'
      ? Effect.fail({ _tag: 'AuthorizationError' as const })
      : Effect.void,
    prepare: () => Effect.succeed({ bytes, digest }),
    publish: () => Effect.succeed(status()),
    read: () => overrides.read === 'deny'
      ? Effect.fail({ _tag: 'StorageReadError' as const })
      : Effect.succeed({ bytes, byteLength: bytes.byteLength }),
  }
}

function postRequest(key: string, token = 'token') {
  return new Request(
    `http://local/api/projects/${projectId}/reports/${reportId}/exports`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify({ workspaceId, reportRevision: 0 }),
    },
  )
}

describe('report export route', () => {
  it('starts an authorized export with the exact deterministic key', async () => {
    const response = await Effect.runPromise(reportExportRoute(
      postRequest(`export:${reportId}:0:0.0.1`),
      deps(),
    ))
    expect(response?.status).toBe(201)
    expect(await response?.json()).toMatchObject({
      status: 'completed',
      digest,
    })
  })

  it('rejects missing credentials and keys reused for another identity', async () => {
    const unauthenticated = new Request(
      `http://local/api/projects/${projectId}/reports/${reportId}/exports`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `export:${reportId}:0:0.0.1`,
        },
        body: JSON.stringify({ workspaceId, reportRevision: 0 }),
      },
    )
    const missing = await Effect.runPromise(
      reportExportRoute(unauthenticated, deps()),
    )
    const conflict = await Effect.runPromise(reportExportRoute(
      postRequest(`export:${reportId}:0:old-producer`),
      deps(),
    ))
    expect(missing?.status).toBe(401)
    expect(conflict?.status).toBe(400)
  })

  it('blocks revoked evidence visibility before publication', async () => {
    const response = await Effect.runPromise(reportExportRoute(
      postRequest(`export:${reportId}:0:0.0.1`),
      deps({ sources: 'deny' }),
    ))
    expect(response?.status).toBe(409)
    expect(await response?.json()).toEqual({
      error: 'ReportExportBlockedError',
    })
  })

  it('maps deterministic bundle limits to a non-retryable response', async () => {
    const base = deps()
    const response = await Effect.runPromise(reportExportRoute(
      postRequest(`export:${reportId}:0:0.0.1`),
      {
        ...base,
        publish: () => Effect.fail({
          _tag: 'ExportBundleLimitError' as const,
        }),
      },
    ))
    expect(response?.status).toBe(413)
    expect(await response?.json()).toEqual({
      error: 'ExportBundleLimitError',
    })
  })

  it('rejects malformed digests and cross-workspace scope', async () => {
    const malformed = await Effect.runPromise(reportExportRoute(
      new Request(
        `http://local/api/projects/${projectId}/reports/${reportId}/exports/not-a-digest?workspaceId=${workspaceId}&reportRevision=0`,
        { headers: { authorization: 'Bearer token' } },
      ),
      deps(),
    ))
    const denied = await Effect.runPromise(reportExportRoute(
      new Request(
        `http://local/api/projects/${projectId}/reports/${reportId}/exports/${digest}?workspaceId=${workspaceId}&reportRevision=0`,
        { headers: { authorization: 'Bearer token' } },
      ),
      deps({ authorize: 'deny' }),
    ))
    const emptyRevision = await Effect.runPromise(reportExportRoute(
      new Request(
        `http://local/api/projects/${projectId}/reports/${reportId}/exports/${digest}?workspaceId=${workspaceId}&reportRevision=`,
        { headers: { authorization: 'Bearer token' } },
      ),
      deps(),
    ))
    expect(malformed?.status).toBe(400)
    expect(denied?.status).toBe(404)
    expect(emptyRevision?.status).toBe(400)
  })

  it('returns verified status and download bytes and fails closed when revoked', async () => {
    const base =
      `http://local/api/projects/${projectId}/reports/${reportId}/exports/${digest}?workspaceId=${workspaceId}&reportRevision=0`
    const response = await Effect.runPromise(reportExportRoute(
      new Request(base, { headers: { authorization: 'Bearer token' } }),
      deps(),
    ))
    const download = await Effect.runPromise(reportExportRoute(
      new Request(`${base}&download=1`, {
        headers: { authorization: 'Bearer token' },
      }),
      deps(),
    ))
    const revoked = await Effect.runPromise(reportExportRoute(
      new Request(base, { headers: { authorization: 'Bearer token' } }),
      deps({ read: 'deny' }),
    ))
    expect(response?.status).toBe(200)
    expect(await response?.json()).toMatchObject({ digest })
    expect(download?.headers.get('content-type')).toBe(
      'application/vnd.struct.report-bundle+json',
    )
    expect(new Uint8Array(await download!.arrayBuffer())).toEqual(bytes)
    expect(revoked?.status).toBe(404)
  })
})
