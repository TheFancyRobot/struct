import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'

const origin = 'http://127.0.0.1:4183'
const projectId = 'f50e8400-e29b-41d4-a716-446655440001'
const sourceId = 'f50e8400-e29b-41d4-a716-446655440002'
const sourceVersionId = 'f50e8400-e29b-41d4-a716-446655440003'
const threadId = 'f50e8400-e29b-41d4-a716-446655440004'
const firstRunId = 'f50e8400-e29b-41d4-a716-446655440005'
const followUpRunId = 'f50e8400-e29b-41d4-a716-446655440006'
const jobId = 'f50e8400-e29b-41d4-a716-446655440007'
const citationId = 'f50e8400-e29b-41d4-a716-446655440008'
const noteId = 'f50e8400-e29b-41d4-a716-446655440009'
const workspaceId = 'f50e8400-e29b-41d4-a716-446655440010'
const eventId = 'f50e8400-e29b-41d4-a716-446655440011'
const contentHash = `sha256:${'a'.repeat(64)}`

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

beforeAll(async () => {
  web = await startAppServer(4183)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('v1 browser journey', () => {
  it('takes a first-time user through a durable source-grounded workspace and back', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    let projectCreated = false
    let sourceAccepted = false
    let researchStarted = false
    let continued = false
    let noteCreated = false
    let noteTitle = 'Renewal risk is concentrated in Acme.'
    let noteBody = noteTitle
    let noteRevision = 1

    const project = {
      id: projectId,
      name: 'Renewal research',
      createdAt: 1,
      updatedAt: 2,
    }
    const source = {
      sourceId,
      name: 'renewals.md',
      kind: 'document',
      mediaType: 'text/markdown',
      latestVersionId: sourceVersionId,
      latestVersion: 1,
      readiness: 'ready',
      updatedAt: 3,
      job: {
        id: jobId,
        status: 'completed',
        attempts: 1,
        maxAttempts: 3,
        updatedAt: 3,
      },
    }
    const originEvidence = {
      threadId,
      runId: firstRunId,
      citations: [{
        kind: 'document',
        id: citationId,
        sourceVersionId,
        locator: 'lines:1-2',
      }],
    }
    const note = () => ({
      id: noteId,
      workspaceId,
      projectId,
      authorId: workspaceId,
      origin: originEvidence,
      current: {
        revision: noteRevision,
        title: noteTitle,
        body: noteBody,
        authorId: workspaceId,
        contentHash,
        createdAt: 5,
      },
      archived: false,
      createdAt: 5,
      updatedAt: 5 + noteRevision,
    })
    const completed = {
      id: eventId,
      cursor: '1',
      runId: firstRunId,
      createdAt: 4,
      type: 'research-completed',
      data: {
        jobId,
        attempt: 1,
        answer: 'Renewal risk is concentrated in Acme.',
        citations: [{ id: citationId, sourceVersionId, locator: 'lines:1-2' }],
        datasetCitations: [],
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

      if (pathname === '/api/projects' && request.method() === 'GET') {
        return json({ items: projectCreated ? [project] : [], nextCursor: null })
      }
      if (pathname === '/api/projects' && request.method() === 'POST') {
        expect(JSON.parse(request.postData() ?? '{}')).toEqual({ name: project.name })
        expect(await request.headerValue('idempotency-key')).toBeTruthy()
        projectCreated = true
        return json(project, 201)
      }
      if (pathname === `/api/projects/${projectId}`) return json(project)
      if (pathname === `/api/projects/${projectId}/sources` && request.method() === 'GET') {
        return json({ cursor: sourceAccepted ? '1' : '0', items: sourceAccepted ? [source] : [] })
      }
      if (pathname === `/api/projects/${projectId}/sources` && request.method() === 'POST') {
        const body = request.postDataBuffer()?.toString() ?? ''
        expect(body).toContain('renewals.md')
        sourceAccepted = true
        return json({ accepted: [{ sourceId, jobId, name: source.name }], rejected: [] }, 202)
      }
      if (pathname === `/api/projects/${projectId}/source-activity`) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: ': heartbeat\n\n',
        })
      }
      if (pathname === `/api/projects/${projectId}/research` && request.method() === 'GET') {
        return json({
          items: researchStarted
            ? [{ id: threadId, projectId, title: 'Where is renewal risk?', createdAt: 4, updatedAt: 6 }]
            : [],
        })
      }
      if (pathname === `/api/projects/${projectId}/research` && request.method() === 'POST') {
        expect(JSON.parse(request.postData() ?? '{}')).toEqual({
          question: 'Where is renewal risk?',
          sourceVersionIds: [sourceVersionId],
        })
        researchStarted = true
        return json({ threadId, runId: firstRunId, jobId, status: 'pending' }, 202)
      }
      if (pathname === `/api/projects/${projectId}/research/${threadId}` && request.method() === 'GET') {
        return json({
          thread: { id: threadId, projectId, title: 'Where is renewal risk?', createdAt: 4, updatedAt: 6 },
          runs: [
            { id: firstRunId, threadId, question: 'Where is renewal risk?', status: 'completed', createdAt: 4, updatedAt: 5 },
            ...(continued
              ? [{ id: followUpRunId, threadId, question: 'What should we do next?', status: 'pending', createdAt: 6, updatedAt: 6 }]
              : []),
          ],
        })
      }
      if (pathname === `/api/projects/${projectId}/research/${threadId}` && request.method() === 'POST') {
        expect(JSON.parse(request.postData() ?? '{}')).toEqual({
          question: 'What should we do next?',
          sourceVersionIds: [sourceVersionId],
        })
        continued = true
        return json({ threadId, runId: followUpRunId, jobId, status: 'pending' }, 202)
      }
      if (pathname.endsWith('/recursive-analysis')) return json({}, 404)
      if (pathname === `/api/projects/${projectId}/runs/${firstRunId}/events`) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `id: 1\nevent: research-completed\ndata: ${JSON.stringify(completed)}\n\n`,
        })
      }
      if (pathname === `/api/projects/${projectId}/runs/${followUpRunId}/events`) {
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
      }
      if (pathname.endsWith(`/evidence/document/${citationId}`)) {
        return json({
          kind: 'document',
          evidence: {
            id: citationId,
            runId: firstRunId,
            sourceVersionId,
            sourceName: source.name,
            sourceVersion: 1,
            locator: 'lines:1-2',
            contextLines: [
              { lineNumber: 1, segments: [{ text: 'Acme renewal is at risk.', cited: true }] },
              { lineNumber: 2, segments: [{ text: 'Contact the account owner.', cited: true }] },
            ],
            startLine: 1,
            endLine: 2,
          },
        })
      }
      if (pathname === `/api/projects/${projectId}/notes` && request.method() === 'GET') {
        return json(noteCreated ? [note()] : [])
      }
      if (pathname === `/api/projects/${projectId}/notes` && request.method() === 'POST') {
        const body = JSON.parse(request.postData() ?? '{}')
        expect(body.origin).toEqual(originEvidence)
        noteCreated = true
        return json(note(), 201)
      }
      if (pathname === `/api/projects/${projectId}/notes/${noteId}` && request.method() === 'GET') {
        return json(note())
      }
      if (pathname === `/api/projects/${projectId}/notes/${noteId}` && request.method() === 'PATCH') {
        const body = JSON.parse(request.postData() ?? '{}')
        expect(body.expectedRevision).toBe(noteRevision)
        noteTitle = body.title
        noteBody = body.body
        noteRevision += 1
        return json(note())
      }
      return route.fallback()
    })

    await page.goto(origin)
    await page.getByLabel('Project name').fill(project.name)
    await page.getByRole('button', { name: 'Create project' }).click()
    await page.waitForURL(`**/projects/${projectId}`)
    await page.getByRole('heading', { level: 1, name: project.name }).waitFor()

    await page.getByRole('link', { name: 'Sources' }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: source.name,
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Renewals\nAcme renewal is at risk.'),
    })
    await page.getByRole('button', { name: 'Add sources' }).click()
    await page.getByText(source.name).waitFor()
    await page.getByText('ready', { exact: true }).waitFor()

    await page.getByRole('link', { name: 'Conversation' }).click()
    await page.getByRole('checkbox', { name: source.name }).waitFor()
    await page.getByRole('textbox', { name: 'Ask your sources' }).fill('Where is renewal risk?')
    await page.getByRole('button', { name: 'Start research' }).click()
    await page.waitForURL(`**/projects/${projectId}/research/${threadId}/runs/${firstRunId}`)
    await page.getByText('Renewal risk is concentrated in Acme.').waitFor()

    await page.getByRole('button', { name: 'Open citation 1' }).click()
    await page.getByText('Acme renewal is at risk.').waitFor()
    expect(await page.locator('#evidence-heading').evaluate(
      (element) => element === document.activeElement,
    )).toBe(true)
    await page.getByRole('button', { name: 'Close evidence' }).click()

    await page.getByRole('button', { name: 'Save as note' }).click()
    await page.getByRole('link', { name: 'Open note' }).click()
    await page.waitForURL(`**/projects/${projectId}/notes/${noteId}`)
    await page.getByLabel('Title').fill('Acme renewal follow-up')
    await page.getByRole('status').filter({ hasText: 'Saved' }).waitFor()
    await page.reload()
    await page.getByLabel('Title').waitFor()
    expect(await page.getByLabel('Title').inputValue()).toBe('Acme renewal follow-up')
    await page.getByRole('link', { name: 'Open citation 1' }).click()
    await page.getByText('Acme renewal is at risk.').waitFor()
    await page.getByRole('button', { name: 'Close evidence' }).click()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Open workspace navigation' }).click()
    const navigation = page.getByRole('navigation', { name: 'Workspace navigation' })
    await navigation.getByRole('heading', { name: 'Workspace' }).waitFor()
    await navigation.getByRole('button', { name: 'Close workspace navigation' }).click()
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    expect(await page.locator('html').getAttribute('data-theme')).toBe('struct-dark')
    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: window.innerWidth,
    }))
    expect(widths.body).toBeLessThanOrEqual(widths.viewport)

    await page.goto(`${origin}/projects/${projectId}/research/${threadId}`)
    await page.getByText('Where is renewal risk?').first().waitFor()
    await page.getByRole('textbox', { name: 'Ask your sources' }).fill('What should we do next?')
    await page.getByRole('button', { name: 'Ask follow-up' }).click()
    await page.waitForURL(`**/projects/${projectId}/research/${threadId}/runs/${followUpRunId}`)
    expect(continued).toBe(true)
    await page.close()
  })
})
