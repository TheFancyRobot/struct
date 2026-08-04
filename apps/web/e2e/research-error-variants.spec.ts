import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
/* eslint-disable no-unused-vars -- Type-only import is consumed by TypeScript. */
import { chromium, type Page as typePage } from 'playwright'
import {
  startAppServer,
  stopAppServer,
} from './support/app-server'
import { waitForThemeStyles } from './support/theme-readiness'
/* eslint-enable no-unused-vars */

const projectId = '760e8400-e29b-41d4-a716-446655440001'
const threadId = '760e8400-e29b-41d4-a716-446655440002'
const runId = '760e8400-e29b-41d4-a716-446655440003'
const nextRunId = '760e8400-e29b-41d4-a716-446655440004'
const jobId = '760e8400-e29b-41d4-a716-446655440005'
const eventId = '760e8400-e29b-41d4-a716-446655440006'
const sourceId = '760e8400-e29b-41d4-a716-446655440007'
const sourceVersionId = '760e8400-e29b-41d4-a716-446655440008'
const origin = 'http://127.0.0.1:4183'
const runUrl = `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`
const screenshotRoot = path.resolve(
  new URL('../../..', import.meta.url).pathname,
  'docs/demos/research-error-variants',
)

const failures = [
  {
    errorTag: 'EvidenceContradictionError',
    guidance: 'The selected documents conflict on this question. Review the evidence before drawing a conclusion.',
    screenshotName: 'evidence-contradiction',
  },
  {
    errorTag: 'ResearchCitationValidationError',
    guidance: 'The answer was withheld because its supporting citation could not be verified.',
    screenshotName: 'citation-validation',
  },
  {
    errorTag: 'RetrievalQueryError',
    guidance: 'The selected document evidence could not be retrieved. Retry the run.',
    screenshotName: 'retrieval-query',
  },
] as const

type ResearchFailure = (typeof failures)[number]

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

async function installFailureApi(
  page: typePage,
  failure: ResearchFailure,
  submissions: unknown[] = [],
): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
    if (pathname === `/api/projects/${projectId}/sources`) {
      return json({
        cursor: '0',
        items: [{
          sourceId,
          name: 'recovery-ready.md',
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
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      })
    }
    if (pathname === `/api/projects/${projectId}/research/${threadId}`) {
      if (request.method() === 'POST') {
        submissions.push(JSON.parse(request.postData() ?? '{}'))
        return json({ threadId, runId: nextRunId, jobId, status: 'pending' }, 202)
      }
      return json({
        thread: { id: threadId, projectId, title: 'Failed research', createdAt: 1, updatedAt: 1 },
        runs: [{ id: runId, threadId, question: 'What does the source say?', status: 'failed', createdAt: 1, updatedAt: 1 }],
      })
    }
    if (pathname === `/api/projects/${projectId}/runs/${runId}/recursive-analysis`) {
      return json({ error: 'NotFound' }, 404)
    }
    if (pathname === `/api/projects/${projectId}/runs/${runId}/events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'id: 1',
          'event: research-failed',
          `data: ${JSON.stringify({
            id: eventId,
            cursor: '1',
            runId,
            createdAt: 1,
            type: 'research-failed',
            data: {
              jobId,
              attempt: 0,
              errorTag: failure.errorTag,
              message: 'Research failed',
            },
          })}`,
          '',
          '',
        ].join('\n'),
      })
    }
    if (pathname === `/api/projects/${projectId}/runs/${nextRunId}/events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      })
    }
    return route.fallback()
  })
}

async function openFailure(
  page: typePage,
  failure: ResearchFailure,
): Promise<void> {
  await page.goto(runUrl)
  await page.getByRole('alert').filter({ hasText: failure.guidance }).waitFor()
}

beforeAll(async () => {
  await mkdir(screenshotRoot, { recursive: true })
  web = await startAppServer(4183)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('research failure browser recovery', () => {
  it('renders each typed failure and keeps keyboard follow-up recovery available', async () => {
    for (const failure of failures) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      const submissions: unknown[] = []
      await installFailureApi(page, failure, submissions)
      await openFailure(page, failure)

      expect(await page.locator('#research-progress-title').locator('..')
        .getByText('Failed', { exact: true }).count()).toBe(1)
      const recovery = page.getByRole('textbox', { name: 'Ask your sources' })
      await recovery.focus()
      expect(await recovery.evaluate((element) => element === document.activeElement)).toBe(true)
      await recovery.fill(`Try again after ${failure.errorTag}`)
      await page.getByRole('button', { name: 'Ask follow-up' }).press('Enter')
      await page.waitForURL(`**/projects/${projectId}/research/${threadId}/runs/${nextRunId}`)
      expect(submissions).toEqual([{
        question: `Try again after ${failure.errorTag}`,
        sourceVersionIds: [sourceVersionId],
      }])
      await page.close()
    }
  })

  it('captures every typed failure at approved light/dark responsive breakpoints', async () => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]
    for (const failure of failures) {
      for (const theme of ['light', 'dark'] as const) {
        for (const viewport of viewports) {
          const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
          await page.addInitScript((selectedTheme) => {
            window.localStorage.setItem('struct-theme', `struct-${selectedTheme}`)
          }, theme)
          await installFailureApi(page, failure)
          await openFailure(page, failure)
          await waitForThemeStyles(page, theme)
          expect(await page.locator('.app-shell').getAttribute('data-theme'))
            .toBe(`struct-${theme}`)
          expect(await page.locator('html').getAttribute('data-theme'))
            .toBe(`struct-${theme}`)
          await assertNoOverflow(page)
          await page.screenshot({
            path: path.join(
              screenshotRoot,
              `${failure.screenshotName}-${viewport.width}x${viewport.height}-${theme}.png`,
            ),
            fullPage: false,
          })
          await page.close()
        }
      }
    }
  })
})
