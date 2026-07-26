/* eslint-disable no-unused-vars -- Imported Playwright types are used only by TypeScript. */
import { expect, it } from 'bun:test'
import { chromium, type Browser, type Page } from 'playwright'
import { startAppServer, stopAppServer, type AppServerProcess } from './support/app-server'
import {
  isExpectedRequestAbort,
  waitForNoteSaveAndRefresh,
} from './support/note-save'

it('waits for the BASE_PATH notes refresh to finish before reloading', async () => {
  const projectId = '33333333-3333-4333-8333-333333333333'
  const noteId = '44444444-4444-4444-8444-444444444444'
  const workspaceId = '55555555-5555-4555-8555-555555555555'
  const threadId = '66666666-6666-4666-8666-666666666666'
  const runId = '77777777-7777-4777-8777-777777777777'
  const citationId = '88888888-8888-4888-8888-888888888888'
  const requestFailures: string[] = []
  let title = 'Saved note'
  let revision = 1
  let releaseNotesRefresh: (() => void) | undefined
  const notesRefreshStarted = Promise.withResolvers<void>()
  let web: AppServerProcess | undefined
  let browser: Browser | undefined
  let page: Page | undefined

  try {
    web = await startAppServer(4188, { BASE_PATH: '/struct', BASE_URL: '/struct/' })
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()
    const note = () => ({
      id: noteId,
      workspaceId,
      projectId,
      authorId: workspaceId,
      origin: {
        threadId,
        runId,
        answerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        citations: [{ kind: 'document', id: citationId, sourceVersionId: '99999999-9999-4999-8999-999999999999', locator: 'lines:1-1' }],
      },
      current: {
        revision,
        title,
        body: 'Body text',
        authorId: workspaceId,
        contentHash: `sha256:${'a'.repeat(64)}`,
        createdAt: 1,
      },
      archived: false,
      createdAt: 1,
      updatedAt: 1,
    })

    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? 'failed'
      const url = request.url()
      if (!isExpectedRequestAbort(failure, request.method(), url)) {
        requestFailures.push(`${request.method()} ${url} ${failure}`)
      }
    })
    await page.route(`**/api/projects/${projectId}/notes`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }
      if (revision > 1) {
        notesRefreshStarted.resolve()
        await new Promise<void>((resolve) => {
          releaseNotesRefresh = resolve
        })
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [note()], nextCursor: null }),
      })
    })
    await page.route(`**/api/projects/${projectId}/notes/${noteId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        title = 'Acme renewal follow-up'
        revision = 2
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(note()),
      })
    })

    await page.goto(`http://127.0.0.1:4188/struct/projects/${projectId}/notes/${noteId}`)
    await page.getByLabel('Title').waitFor()
    const { noteUpdate, notesRefresh } = waitForNoteSaveAndRefresh(page, projectId, noteId)
    await page.getByLabel('Title').fill('Acme renewal follow-up')
    await noteUpdate
    await page.getByRole('status').filter({ hasText: 'Saved' }).waitFor()
    await notesRefreshStarted.promise
    releaseNotesRefresh?.()
    await notesRefresh
    await page.reload()
    await page.getByLabel('Title').waitFor()

    expect(requestFailures).toEqual([])
  } finally {
    releaseNotesRefresh?.()
    await page?.close()
    await browser?.close()
    await stopAppServer(web)
  }
})
