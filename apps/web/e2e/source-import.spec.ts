import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'

const origin = 'http://127.0.0.1:4180'
const projectId = 'c50e8400-e29b-41d4-a716-446655440001'
const sourceId = 'c50e8400-e29b-41d4-a716-446655440002'
const jobId = 'c50e8400-e29b-41d4-a716-446655440003'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

beforeAll(async () => {
  web = await startAppServer(4180)
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
      accepted = true
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted: [{ sourceId, jobId, name: 'notes.md' }],
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
})
