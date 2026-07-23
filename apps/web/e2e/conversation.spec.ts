import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'

const origin = 'http://127.0.0.1:4182'
const projectId = 'd50e8400-e29b-41d4-a716-446655440001'
const sourceId = 'd50e8400-e29b-41d4-a716-446655440002'
const sourceVersionId = 'd50e8400-e29b-41d4-a716-446655440003'
const threadId = 'd50e8400-e29b-41d4-a716-446655440004'
const firstRunId = 'd50e8400-e29b-41d4-a716-446655440005'
const followUpRunId = 'd50e8400-e29b-41d4-a716-446655440006'
const jobId = 'd50e8400-e29b-41d4-a716-446655440007'
const citationId = 'd50e8400-e29b-41d4-a716-446655440008'
const datasetCitationId = 'd50e8400-e29b-41d4-a716-446655440009'
const datasetId = 'd50e8400-e29b-41d4-a716-446655440010'
const datasetSnapshotId = 'd50e8400-e29b-41d4-a716-446655440011'
const querySnapshotId = 'd50e8400-e29b-41d4-a716-446655440012'
const eventId = 'd50e8400-e29b-41d4-a716-446655440013'
const sha = (digit: string) => `sha256:${digit.repeat(64)}`

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

beforeAll(async () => {
  web = await startAppServer(4182)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('source-grounded conversation browser path', () => {
  it('starts, reloads, and continues one durable thread with the selected ready version', async () => {
    const page = await browser.newPage()
    const submitted: unknown[] = []
    let started = false
    let continued = false
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname
      const json = (body: unknown, status = 200) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
      if (pathname === '/api/projects') {
        return json({ items: [{ id: projectId, name: 'Conversation project', createdAt: 1, updatedAt: 2 }], nextCursor: null })
      }
      if (pathname === `/api/projects/${projectId}`) {
        return json({ id: projectId, name: 'Conversation project', createdAt: 1, updatedAt: 2 })
      }
      if (pathname === `/api/projects/${projectId}/sources`) {
        return json({
          cursor: '0',
          items: [{
            sourceId,
            name: 'ready.md',
            kind: 'document',
            mediaType: 'text/markdown',
            latestVersionId: sourceVersionId,
            latestVersion: 1,
            readiness: 'ready',
            updatedAt: 1,
            job: { id: jobId, status: 'completed', attempts: 1, maxAttempts: 3, updatedAt: 1 },
          }],
        })
      }
      if (pathname === `/api/projects/${projectId}/source-activity`) {
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
      }
      if (pathname === `/api/projects/${projectId}/research` && request.method() === 'GET') {
        return json({ items: started ? [{ id: threadId, projectId, title: 'First question', createdAt: 1, updatedAt: 2 }] : [] })
      }
      if (pathname === `/api/projects/${projectId}/research` && request.method() === 'POST') {
        submitted.push(JSON.parse(request.postData() ?? '{}'))
        started = true
        return json({ threadId, runId: firstRunId, jobId, status: 'pending' }, 202)
      }
      if (pathname === `/api/projects/${projectId}/research/${threadId}` && request.method() === 'GET') {
        return json({
          thread: { id: threadId, projectId, title: 'First question', createdAt: 1, updatedAt: 2 },
          runs: [
            { id: followUpRunId, threadId, question: 'Follow up', status: 'pending', createdAt: 2, updatedAt: 2 },
            { id: firstRunId, threadId, question: 'First question', status: 'completed', createdAt: 1, updatedAt: 1 },
          ].slice(0, continued ? 2 : 1),
        })
      }
      if (pathname === `/api/projects/${projectId}/research/${threadId}` && request.method() === 'POST') {
        submitted.push(JSON.parse(request.postData() ?? '{}'))
        continued = true
        return json({ threadId, runId: followUpRunId, jobId, status: 'pending' }, 202)
      }
      if (pathname.startsWith(`/api/projects/${projectId}/runs/`)) {
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
      }
      return route.fallback()
    })

    await page.goto(`${origin}/projects/${projectId}`)
    await page.getByRole('checkbox', { name: 'ready.md' }).waitFor()
    await page.getByRole('textbox', { name: 'Ask your sources' }).fill('First question')
    await page.getByRole('button', { name: 'Start research' }).click()
    await page.waitForURL(`**/projects/${projectId}/research/${threadId}/runs/${firstRunId}`)
    expect(submitted[0]).toEqual({ question: 'First question', sourceVersionIds: [sourceVersionId] })

    await page.reload()
    await page.getByText('First question').first().waitFor()
    await page.locator('input[type="checkbox"]:checked').waitFor()
    await page.getByRole('textbox', { name: 'Ask your sources' }).fill('Follow up')
    await page.getByRole('button', { name: 'Ask follow-up' }).click()
    await page.waitForURL(`**/projects/${projectId}/research/${threadId}/runs/${followUpRunId}`)
    expect(submitted[1]).toEqual({ question: 'Follow up', sourceVersionIds: [sourceVersionId] })
    await page.close()
  })

  it('opens exact document and dataset evidence without leaving the conversation', async () => {
    const page = await browser.newPage()
    const datasetCitation = {
      id: datasetCitationId,
      queryResultSnapshotId: querySnapshotId,
      workspaceId: 'd50e8400-e29b-41d4-a716-446655440014',
      projectId,
      datasetId,
      datasetSnapshotId,
      schemaHash: sha('1'),
      parquetDigest: '2'.repeat(64),
      resultHash: sha('3'),
      resultArtifactHash: sha('4'),
      canonicalSql: 'SELECT account, risk FROM renewal_health',
      selectedColumns: ['account', 'risk'],
      rowStart: 0,
      rowEndExclusive: 1,
      createdAt: 1,
    }
    const completed = {
      id: eventId,
      cursor: '1',
      runId: firstRunId,
      createdAt: 1,
      type: 'research-completed',
      data: {
        jobId,
        attempt: 1,
        answer: 'One account has renewal risk.',
        citations: [{ id: citationId, sourceVersionId, locator: 'lines:1-1' }],
        datasetCitations: [datasetCitation],
      },
    }
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname
      const json = (body: unknown, status = 200) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
      if (pathname === `/api/projects/${projectId}`) {
        return json({ id: projectId, name: 'Evidence project', createdAt: 1, updatedAt: 2 })
      }
      if (pathname === '/api/projects') {
        return json({ items: [], nextCursor: null })
      }
      if (pathname === `/api/projects/${projectId}/sources`) {
        return json({ cursor: '0', items: [] })
      }
      if (pathname === `/api/projects/${projectId}/source-activity`) {
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
      }
      if (pathname === `/api/projects/${projectId}/research/${threadId}`) {
        return json({
          thread: { id: threadId, projectId, title: 'Evidence question', createdAt: 1, updatedAt: 2 },
          runs: [{ id: firstRunId, threadId, question: 'Evidence question', status: 'completed', createdAt: 1, updatedAt: 2 }],
        })
      }
      if (pathname.endsWith('/recursive-analysis')) return json({}, 404)
      if (pathname === `/api/projects/${projectId}/runs/${firstRunId}/events`) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `id: 1\nevent: research-completed\ndata: ${JSON.stringify(completed)}\n\n`,
        })
      }
      if (pathname.endsWith(`/evidence/document/${citationId}`)) {
        return json({
          kind: 'document',
          evidence: {
            id: citationId,
            runId: firstRunId,
            sourceVersionId,
            sourceName: 'ready.md',
            sourceVersion: 1,
            locator: 'lines:1-1',
            contextLines: [{
              lineNumber: 1,
              segments: [{ text: '<script>untrusted()</script>', cited: true }],
            }],
            startLine: 1,
            endLine: 1,
          },
        })
      }
      if (pathname.endsWith(`/evidence/dataset/${datasetCitationId}`)) {
        return json({
          kind: 'dataset',
          evidence: {
            citation: datasetCitation,
            snapshot: {
              id: querySnapshotId,
              workspaceId: datasetCitation.workspaceId,
              projectId,
              requestHash: sha('5'),
              protocolVersion: '1',
              engineVersion: 'duckdb-test',
              engineConfigHash: sha('6'),
              canonicalSql: datasetCitation.canonicalSql,
              snapshots: [{
                alias: 'renewal_health',
                datasetId,
                snapshotId: datasetSnapshotId,
                schemaHash: datasetCitation.schemaHash,
                parquetDigest: datasetCitation.parquetDigest,
              }],
              schemaHash: sha('7'),
              resultHash: datasetCitation.resultHash,
              resultArtifactHash: datasetCitation.resultArtifactHash,
              columns: [
                { ordinal: 0, name: 'account', type: 'VARCHAR' },
                { ordinal: 1, name: 'risk', type: 'BOOLEAN' },
              ],
              rows: [['Acme', true]],
              rowCount: 1,
              truncated: false,
              executedAt: 1,
              createdAt: 1,
            },
            columns: [
              { ordinal: 0, name: 'account', type: 'VARCHAR' },
              { ordinal: 1, name: 'risk', type: 'BOOLEAN' },
            ],
            rows: [['Acme', true]],
          },
        })
      }
      return route.fallback()
    })

    await page.goto(
      `${origin}/projects/${projectId}/research/${threadId}/runs/${firstRunId}`,
    )
    const documentTrigger = page.getByRole('button', { name: 'Open citation 1' })
    await documentTrigger.click()
    await page.getByText('<script>untrusted()</script>').waitFor()
    expect(await page.locator('#evidence-heading').evaluate(
      (element) => element === document.activeElement,
    )).toBe(true)
    expect(page.url()).toContain(`evidence=document%3A${citationId}`)
    await page.getByRole('button', { name: 'Close evidence' }).click()
    expect(await documentTrigger.evaluate(
      (element) => element === document.activeElement,
    )).toBe(true)

    await page.getByRole('button', { name: 'Open dataset citation 1' }).click()
    await page.getByText('duckdb-test').waitFor()
    await page.getByRole('cell', { name: 'Acme' }).waitFor()
    expect(page.url()).toContain(`evidence=dataset%3A${datasetCitationId}`)

    await page.goBack()
    await page.goBack()
    await page.getByText('<script>untrusted()</script>').waitFor()
    await page.close()
  })
})
