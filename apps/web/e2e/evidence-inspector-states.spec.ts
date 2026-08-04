import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
/* eslint-disable no-unused-vars -- Type-only import is consumed by TypeScript. */
import { chromium, type Page as typePage } from 'playwright'
/* eslint-enable no-unused-vars */
import { startAppServer, stopAppServer } from './support/app-server'
import { waitForThemeStyles } from './support/theme-readiness'

const origin = 'http://127.0.0.1:4188'
const projectId = '940e8400-e29b-41d4-a716-446655440001'
const threadId = '940e8400-e29b-41d4-a716-446655440002'
const runId = '940e8400-e29b-41d4-a716-446655440003'
const jobId = '940e8400-e29b-41d4-a716-446655440004'
const sourceVersionId = '940e8400-e29b-41d4-a716-446655440005'
const citationId = '940e8400-e29b-41d4-a716-446655440006'
const eventId = '940e8400-e29b-41d4-a716-446655440007'
const runUrl = `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`
const screenshotRoot = path.resolve(
  new URL('../../..', import.meta.url).pathname,
  'docs/demos/evidence-inspector-states',
)
const sha = (digit: string) => `sha256:${digit.repeat(64)}`

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

function assertNoOverflow(page: typePage): Promise<void> {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  })).then((overflow) => {
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport)
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport)
  })
}

async function installEvidenceApi(page: typePage): Promise<{
  releaseLoading: () => void
  allowRetry: () => void
}> {
  let resolveLoading: (() => void) | undefined
  let retryAllowed = false
  let evidenceRequests = 0

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
    if (pathname === '/api/projects') return json({ items: [], nextCursor: null })
    if (pathname === `/api/projects/${projectId}`) {
      return json({ id: projectId, name: 'Evidence states', createdAt: 1, updatedAt: 1 })
    }
    if (pathname === `/api/projects/${projectId}/sources`) return json({ cursor: '0', items: [] })
    if (pathname === `/api/projects/${projectId}/source-activity`) {
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': heartbeat\n\n' })
    }
    if (pathname === `/api/projects/${projectId}/research/${threadId}`) {
      return json({
        thread: { id: threadId, projectId, title: 'Evidence loading', createdAt: 1, updatedAt: 1 },
        runs: [{ id: runId, threadId, question: 'Evidence loading', status: 'completed', createdAt: 1, updatedAt: 1 }],
      })
    }
    if (pathname.endsWith('/recursive-analysis')) return json({}, 404)
    if (pathname === `/api/projects/${projectId}/runs/${runId}/events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'id: 1',
          'event: research-completed',
          `data: ${JSON.stringify({
            id: eventId,
            cursor: '1',
            runId,
            createdAt: 1,
            type: 'research-completed',
            data: {
              jobId,
              attempt: 1,
              answer: 'Evidence can be opened.',
              citations: [{ id: citationId, sourceVersionId, locator: 'lines:1-1' }],
              datasetCitations: [],
            },
          })}`,
          '',
          '',
        ].join('\n'),
      })
    }
    if (pathname.endsWith(`/evidence/document/${citationId}`)) {
      evidenceRequests += 1
      if (evidenceRequests === 1) {
        await new Promise<void>((resolve) => { resolveLoading = resolve })
      } else if (!retryAllowed) {
        return json({ error: 'unavailable' }, 503)
      }
      return json({
        kind: 'document',
        validation: 'validated',
        evidence: {
          id: citationId,
          runId,
          sourceVersionId,
          sourceName: 'evidence.md',
          sourceVersion: 1,
          originalContentHash: sha('a'),
          normalizedContentHash: sha('b'),
          locator: 'lines:1-1',
          contextLines: [{ lineNumber: 1, segments: [{ text: 'Exact evidence is ready.', cited: true }] }],
          startLine: 1,
          endLine: 1,
        },
      })
    }
    return route.fallback()
  })

  return {
    releaseLoading: () => resolveLoading?.(),
    allowRetry: () => {
      retryAllowed = true
    },
  }
}

beforeAll(async () => {
  await mkdir(screenshotRoot, { recursive: true })
  web = await startAppServer(4188)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('evidence inspector loading and recovery', () => {
  it('renders loading and retryable error states across responsive light and dark themes', async () => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]
    for (const theme of ['light', 'dark'] as const) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
        await page.addInitScript((selectedTheme) => {
          window.localStorage.setItem('struct-theme', `struct-${selectedTheme}`)
        }, theme)
        const api = await installEvidenceApi(page)
        await page.goto(runUrl)
        const opener = page.getByRole('button', { name: 'Open citation 1' })
        await opener.click()
        await page.getByText('Loading exact evidence…', { exact: true }).waitFor()
        await waitForThemeStyles(page, theme)
        expect(await page.locator('#evidence-heading').evaluate(
          (element) => element === document.activeElement,
        )).toBe(true)
        await assertNoOverflow(page)
        await page.screenshot({
          path: path.join(screenshotRoot, `loading-${viewport.width}x${viewport.height}-${theme}.png`),
          fullPage: false,
        })

        api.releaseLoading()
        await page.getByText('Exact evidence is ready.').waitFor()
        await page.keyboard.press('Escape')
        expect(await opener.evaluate((element) => element === document.activeElement)).toBe(true)

        await opener.click()
        await page.getByRole('alert').filter({ hasText: 'Evidence could not be loaded. Try again.' }).waitFor()
        await assertNoOverflow(page)
        await page.screenshot({
          path: path.join(screenshotRoot, `error-${viewport.width}x${viewport.height}-${theme}.png`),
          fullPage: false,
        })

        api.allowRetry()
        await page.getByRole('button', { name: 'Try again' }).evaluate((button) => {
          (button as HTMLButtonElement).click()
        })
        await page.getByText('Exact evidence is ready.').waitFor()
        expect(await page.getByRole('alert').count()).toBe(0)
        await page.keyboard.press('Escape')
        expect(await opener.evaluate((element) => element === document.activeElement)).toBe(true)
        await page.close()
      }
    }
  })
})
