import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'

const origin = 'http://127.0.0.1:4201'
const projectId = 'c50e8400-e29b-41d4-a716-446655440001'
const sourceId = 'c50e8400-e29b-41d4-a716-446655440002'
const jobId = 'c50e8400-e29b-41d4-a716-446655440003'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

beforeAll(async () => {
  web = await startAppServer(4201)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('source import browser path', () => {
  it('accepts a file, returns to the persistent source view, and hydrates background activity', async () => {
    const page = await browser.newPage()
    let accepted = false
    await page.route(`**/api/projects/${projectId}/sources`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            cursor: accepted ? '2' : '0',
            items: accepted
              ? [{
                  sourceId,
                  name: 'notes.md',
                  kind: 'document',
                  mediaType: 'text/markdown',
                  latestVersionId: null,
                  latestVersion: null,
                  readiness: 'pending',
                  updatedAt: 1_700_000_000_000,
                  job: {
                    id: jobId,
                    status: 'pending',
                    attempts: 0,
                    maxAttempts: 3,
                    updatedAt: 1_700_000_000_000,
                  },
                }]
              : [],
          }),
        })
        return
      }
      const body = route.request().postDataBuffer()?.toString() ?? ''
      expect(body).toContain('name="mode"')
      expect(body).toContain('files')
      expect(body).toContain('notes.md')
      const clientBatchId = /name="clientBatchId"\r\n\r\n([^\r\n]+)/.exec(body)?.[1]
      if (clientBatchId === undefined) throw new Error('missing client batch ID')
      accepted = true
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          clientBatchId,
          replayed: false,
          accepted: [{
            sourceId,
            jobId,
            name: 'notes.md',
            kind: 'document',
          }],
          rejected: [],
        }),
      })
    })
    await page.route(`**/api/projects/${projectId}/source-activity**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      })
    })

    await page.goto(`${origin}/projects/${projectId}/sources`)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'notes.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Notes'),
    })
    await page.getByRole('button', { name: 'Add sources' }).click()

    await page.getByRole('region', { name: 'Background source activity' }).waitFor()
    expect(await page.locator('input[type="file"]').evaluate((input) => (input as HTMLInputElement).files?.length)).toBe(0)
    expect(await page.getByText('notes.md').count()).toBeGreaterThan(0)
    expect(await page.locator('[role="dialog"]').count()).toBe(0)
    await page.close()
  })

  it('shows a reload action when source activity cannot remain live', async () => {
    const page = await browser.newPage()
    await page.route(`**/api/projects/${projectId}/sources`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cursor: '0', items: [] }),
      })
    })
    await page.route(`**/api/projects/${projectId}/source-activity**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: stream-error\ndata: {"error":"SourceActivityUnavailable"}\n\n',
      })
    })

    await page.goto(`${origin}/projects/${projectId}/sources`)
    await page.getByRole('alert').filter({ hasText: 'Live progress became unavailable' }).waitFor()
    expect(await page.getByRole('button', { name: 'Reload' }).count()).toBe(1)
    await page.close()
  })

  it('keeps a failed job actionable when its retry request fails', async () => {
    const page = await browser.newPage()
    await page.route(`**/api/projects/${projectId}/sources`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cursor: '0',
          items: [{
            sourceId,
            name: 'notes.md',
            kind: 'document',
            mediaType: 'text/markdown',
            latestVersionId: null,
            latestVersion: null,
            readiness: 'failed',
            updatedAt: 1_700_000_000_000,
            job: {
              id: jobId,
              status: 'failed',
              attempts: 1,
              maxAttempts: 3,
              updatedAt: 1_700_000_000_000,
            },
          }],
        }),
      })
    })
    await page.route(`**/api/projects/${projectId}/source-activity**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
    })
    await page.route(`**/api/projects/${projectId}/source-jobs/${jobId}/retry`, async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SourceJobControlUnavailable"}' })
    })

    await page.goto(`${origin}/projects/${projectId}/sources`)
    await page.getByRole('button', { name: 'Retry' }).click()
    await page.getByRole('alert').filter({ hasText: 'The source job could not be updated' }).waitFor()
    expect(await page.getByRole('button', { name: 'Retry' }).count()).toBe(1)
    await page.close()
  })

  it('aligns the source-library notice and content to the shared responsive gutter at desktop and compact widths', async () => {
    for (const width of [1440, 375] as const) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      try {
        await page.route('**/api/projects', (route) => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], nextCursor: null }),
        }))
        await page.route('**/api/sources', (route) => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ cursor: '0', items: [] }),
        }))

        await page.goto(`${origin}/sources`)
        const importPanel = page.locator('section[aria-labelledby="source-import-heading"]')
        await importPanel.waitFor()
        await page.getByRole('heading', { name: 'Source library' }).waitFor()
        await page.getByText('No sources loaded.').waitFor()
        const attachmentNotice = page.getByTestId('source-library-attachment-notice')
        await attachmentNotice.waitFor()

        const { importLeft, headingLeft, contentLeft, contentTop } = await page.evaluate(() => {
          const content = document.querySelector('main .overflow-auto')! as HTMLElement
          const panel = document.querySelector('section[aria-labelledby="source-import-heading"]')! as HTMLElement
          const heading = document.querySelector('#workspace-source-library-heading')! as HTMLElement
          return {
            importLeft: panel.getBoundingClientRect().left,
            headingLeft: heading.getBoundingClientRect().left,
            contentLeft: content.getBoundingClientRect().left,
            contentTop: content.getBoundingClientRect().top,
          }
        })
        const noticeTop = (await attachmentNotice.boundingBox())!.y

        // The notice and the source-library heading share the same responsive content gutter.
        expect(Math.abs(importLeft - headingLeft)).toBeLessThanOrEqual(1)
        // Neither touches the workspace edge: both are inset by the gutter (16px compact, 24px desktop).
        expect(importLeft - contentLeft).toBeGreaterThanOrEqual(12)
        expect(headingLeft - contentLeft).toBeGreaterThanOrEqual(12)
        // The attachment notice is inset from the workspace top edge by the same responsive gutter
        // (16px compact, 24px desktop), so it cannot render flush at the central viewport edge.
        const expectedTopInset = width === 1440 ? 24 : 16
        expect(Math.abs((noticeTop - contentTop) - expectedTopInset)).toBeLessThanOrEqual(1)
        // Accessible feedback semantics are preserved on the import notice.
        expect(await importPanel.getAttribute('aria-labelledby')).toBe('source-import-heading')
      } finally {
        await page.close()
      }
    }
  })

  it('renders the source import error toast above the submit button inside the form, matching the add-project screen', async () => {
    const page = await browser.newPage()
    try {
      await page.route(`**/api/projects/${projectId}/sources`, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ cursor: '0', items: [] }),
          })
          return
        }
        await route.fulfill({
          status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'SourceImportUnavailable' }) })
      })
      await page.route(`**/api/projects/${projectId}/source-activity**`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
      })

      await page.goto(`${origin}/projects/${projectId}/sources`)
      await page.locator('input[type="file"]').setInputFiles({
        name: 'notes.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from('# Notes'),
      })
      await page.locator('section[aria-labelledby="source-import-heading"]')
        .getByRole('button', { name: 'Add sources' })
        .click()
      const error = page.locator('section[aria-labelledby="source-import-heading"]')
        .getByRole('alert')
        .filter({ hasText: 'Sources could not be accepted' })
      await error.waitFor()

      const { errorBottom, buttonTop, errorInsideForm } = await page.evaluate(() => {
        const panel = document.querySelector('section[aria-labelledby="source-import-heading"]')!
        const alert = Array.from(panel.querySelectorAll('[role="alert"]'))
          .find((element) => element.textContent?.includes('Sources could not be accepted'))!
        const button = panel.querySelector('button[type="submit"]')!
        const form = button.closest('form')!
        return {
          errorBottom: alert.getBoundingClientRect().bottom,
          buttonTop: button.getBoundingClientRect().top,
          errorInsideForm: form.contains(alert),
        }
      })
      // The error toast shares the add-project screen's canonical position: inside the form,
      // above the submit button, so the feedback precedes the retry action.
      expect(errorInsideForm).toBe(true)
      expect(errorBottom).toBeLessThanOrEqual(buttonTop)
    } finally {
      await page.close()
    }
  })

  it('renders the add-source form fields and options even when the source catalog cannot be loaded', async () => {
    const page = await browser.newPage()
    try {
      await page.route(`**/api/projects/${projectId}/sources`, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'SourceCatalogUnavailable' }),
          })
          return
        }
        await route.fulfill({
          status: 202, contentType: 'application/json',
          body: JSON.stringify({ clientBatchId: 'c0000000-0000-0000-0000-000000000001', replayed: false, accepted: [], rejected: [] }) })
      })
      await page.route(`**/api/projects/${projectId}/source-activity**`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
      })

      await page.goto(`${origin}/projects/${projectId}/sources`)
      const panel = page.locator('section[aria-labelledby="source-import-heading"]')
      await panel.waitFor()

      // The catalog failure surfaces as a non-blocking banner with a retry, not as a
      // full-page replacement that hides the form.
      await page.getByRole('alert').filter({ hasText: 'Sources could not be loaded.' }).waitFor()
      expect(await page.getByRole('button', { name: 'Retry' }).count()).toBe(1)

      // Every expected field and option still renders alongside the error.
      expect(await page.locator('input[type="file"]').count()).toBe(1)
      expect(await panel.getByRole('button', { name: 'Files' }).count()).toBe(1)
      expect(await panel.getByRole('button', { name: 'Paste' }).count()).toBe(1)
      expect(await panel.getByRole('button', { name: 'Dataset' }).count()).toBe(1)
      expect(await panel.getByRole('button', { name: 'Add sources' }).count()).toBe(1)
    } finally {
      await page.close()
    }
  })
})
