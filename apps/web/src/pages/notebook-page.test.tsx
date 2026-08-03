/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { afterEach, describe, expect, it } from 'bun:test'
import { Report } from '@struct/domain'
import { Schema } from 'effect'
import { renderToString } from 'solid-js/web'
import { setRouterParams } from '../test/mock-solid-router'

const { NotebookPage, loadNotebookReport } = await import('./NotebookPage')

const originalFetch = globalThis.fetch
const projectId = 'b80e8400-e29b-41d4-a716-446655440001'
const workspaceId = 'b80e8400-e29b-41d4-a716-446655440002'
const reportId = 'b80e8400-e29b-41d4-a716-446655440003'
const runId = 'b80e8400-e29b-41d4-a716-446655440004'
const sourceVersionId = 'b80e8400-e29b-41d4-a716-446655440005'
const findingId = 'b80e8400-e29b-41d4-a716-446655440006'
const claimId = 'b80e8400-e29b-41d4-a716-446655440007'

const report = Schema.decodeUnknownSync(Report)({
  id: reportId,
  workspaceId,
  projectId,
  runId,
  sourceVersionIds: [sourceVersionId],
  findingIds: [findingId],
  titleRevisions: [{
    id: 'b80e8400-e29b-41d4-a716-446655440008',
    revision: 0,
    content: 'Report title',
    authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
    idempotencyKey: 'title',
    createdAt: 1,
  }],
  currentTitleRevision: 0,
  claims: [{
    id: claimId,
    claimSignature: `sha256:${'a'.repeat(64)}`,
    citation: {
      citationId: 'b80e8400-e29b-41d4-a716-446655440009',
      state: 'draft',
      revision: 0,
      supersededBy: null,
      lastIdempotencyKey: null,
      updatedAt: 1,
    },
    origin: { kind: 'research-run', runId },
    revisions: [{
      id: 'b80e8400-e29b-41d4-a716-446655440010',
      revision: 0,
      content: 'Report claim',
      authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
      idempotencyKey: 'claim',
      createdAt: 1,
    }],
    currentRevision: 0,
    support: { kind: 'unsupported', reason: 'Test fixture' },
    createdAt: 1,
  }],
  sections: [{
    id: 'b80e8400-e29b-41d4-a716-446655440011',
    ordinal: 0,
    heading: 'Section',
    revisions: [{
      id: 'b80e8400-e29b-41d4-a716-446655440012',
      revision: 0,
      content: 'Section content',
      authorship: { kind: 'generated', runId, model: 'test', promptVersion: 'v1' },
      idempotencyKey: 'section',
      createdAt: 1,
    }],
    currentRevision: 0,
    findingIds: [findingId],
    claimIds: [claimId],
    lastRegenerationKey: null,
  }],
  revision: 0,
  publicationState: 'draft',
  supersededBy: null,
  lastPublicationKey: null,
  createdAt: 1,
  updatedAt: 1,
})

afterEach(() => {
  globalThis.fetch = originalFetch
  setRouterParams({})
})

describe('NotebookPage', () => {
  it('loads the requested report in its workspace without reloading the public project summary', async () => {
    const requests: string[] = []
    globalThis.fetch = Object.assign(async (input: RequestInfo | URL) => {
      requests.push(typeof input === 'string' ? input : input.toString())
      return new Response(JSON.stringify(Schema.encodeSync(Report)(report)), {
        headers: { 'content-type': 'application/json' },
      })
    }, { preconnect: originalFetch.preconnect })
    setRouterParams({ projectId, workspaceId, reportId })

    const html = renderToString(() => <NotebookPage />)
    await loadNotebookReport(report.workspaceId, report.projectId, report.id)

    expect(html).toContain('Opening report workspace…')
    expect(requests).toContain(
      `/api/projects/${projectId}/reports/${reportId}?workspaceId=${workspaceId}`,
    )
    expect(requests).not.toContain(`/api/projects/${projectId}`)
  })

  it('requires workspace scope in every notebook URL', () => {
    setRouterParams({ projectId })

    expect(renderToString(() => <NotebookPage />)).toContain(
      'This project notebook link is invalid.',
    )
  })
})
