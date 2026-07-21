import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir } from 'node:fs/promises'
/* eslint-disable no-unused-vars -- Type-only import is consumed by TypeScript. */
import { chromium, type Page as typePage } from 'playwright'
import {
  startAppServer,
  stopAppServer,
} from './support/app-server'
import { waitForThemeStyles } from './support/theme-readiness'
/* eslint-enable no-unused-vars */

const projectId = 'e80e8400-e29b-41d4-a716-446655440001'
const threadId = 'e80e8400-e29b-41d4-a716-446655440002'
const runId = 'e80e8400-e29b-41d4-a716-446655440003'
const workspaceId = 'e80e8400-e29b-41d4-a716-446655440004'
const citationId = 'e80e8400-e29b-41d4-a716-446655440005'
const sourceVersionId = 'e80e8400-e29b-41d4-a716-446655440006'
const origin = 'http://127.0.0.1:4174'
const runUrl = `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`
const sha = (digit: string) => `sha256:${digit.repeat(64)}`
const screenshotRoot = '/tmp/struct-step-06-05'

const partialProgress = {
  runId,
  workspaceId,
  requestId: sha('1'),
  planId: sha('2'),
  status: 'partial',
  cancellation: 'none',
  recoveryCount: 1,
  expectedPartitions: 3,
  committedPartitions: 1,
  failedPartitions: 0,
  partitions: [{
    id: sha('3'),
    nodeId: sha('4'),
    ordinal: 0,
    status: 'committed',
    attempt: 2,
    batches: [{
      id: sha('5'),
      status: 'committed',
      attempt: 2,
      evidenceIds: [sha('6'), sha('7')],
      updatedAt: 1_700_000_000_100,
    }],
    failureTag: null,
    startedAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_100,
  }, {
    id: sha('8'),
    nodeId: sha('4'),
    ordinal: 1,
    status: 'retrying',
    attempt: 2,
    batches: [{
      id: sha('9'),
      status: 'retrying',
      attempt: 2,
      evidenceIds: [],
      updatedAt: 1_700_000_000_200,
    }],
    failureTag: null,
    startedAt: 1_700_000_000_150,
    updatedAt: 1_700_000_000_200,
  }],
  result: {
    status: 'partial',
    coverage: {
      id: sha('a'),
      expectedItems: 12,
      examinedItems: 7,
      missingItems: 4,
      excludedItems: 1,
      expectedPartitions: 3,
      examinedPartitions: 1,
      status: 'partial',
    },
    findings: [{
      id: sha('b'),
      claimSignature: sha('c'),
      claim: 'Customer escalations cluster around handoff delays, not initial response time.',
      evidence: [{
        id: sha('6'),
        sourceVersionId,
        artifact: {
          digest: sha('d'),
          byteLength: 512,
          mediaType: 'application/vnd.struct.recursive-batch-evidence+json',
        },
        locator: 'document:lines:12-14',
      }, {
        id: sha('7'),
        sourceVersionId,
        artifact: {
          digest: sha('e'),
          byteLength: 320,
          mediaType: 'application/vnd.struct.recursive-batch-evidence+json',
        },
        locator: 'document:lines:20-21',
      }],
      confidence: 0.84,
      importance: 0.91,
      coverage: {
        id: sha('a'),
        expectedItems: 12,
        examinedItems: 7,
        missingItems: 4,
        excludedItems: 1,
        expectedPartitions: 3,
        examinedPartitions: 1,
        status: 'partial',
      },
      supportingExamples: [sha('6')],
      counterEvidence: [sha('7')],
      contradictions: [{
        id: sha('f'),
        claimSignature: sha('c'),
        supportingEvidence: [sha('6')],
        conflictingEvidence: [sha('7')],
        status: 'unresolved',
        limitations: ['The counterexample covers a smaller account cohort.'],
      }],
      limitations: ['Four records remain unavailable.'],
      tags: ['customer-operations'],
    }],
    contradictions: [{
      id: sha('f'),
      claimSignature: sha('c'),
      supportingEvidence: [sha('6')],
      conflictingEvidence: [sha('7')],
      status: 'unresolved',
      limitations: ['The counterexample covers a smaller account cohort.'],
    }],
    missingEvidence: ['partition-3'],
    excludedEvidence: ['unsupported/binary.dat'],
    limitations: ['One partition is retrying.', 'Four records remain unavailable.'],
    citations: [{
      citationId,
      evidenceId: sha('6'),
      sourceVersionId,
      locator: 'document:lines:12-14',
    }],
    updatedAt: 1_700_000_000_200,
  },
  updatedAt: 1_700_000_000_200,
}

const completeCoverage = {
  id: sha('0'),
  expectedItems: 12,
  examinedItems: 12,
  missingItems: 0,
  excludedItems: 0,
  expectedPartitions: 3,
  examinedPartitions: 3,
  status: 'complete',
}

const completeProgress = {
  ...partialProgress,
  status: 'completed',
  committedPartitions: 3,
  result: {
    ...partialProgress.result,
    status: 'complete',
    coverage: completeCoverage,
    findings: partialProgress.result.findings.map((finding) => ({
      ...finding,
      coverage: completeCoverage,
    })),
    missingEvidence: [],
    limitations: [],
  },
}

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

async function routeProgress(page: typePage): Promise<void> {
  await page.route(`**/api/projects/${projectId}/runs/${runId}/recursive-analysis`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(partialProgress),
    }))
  await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: ': heartbeat\n\n',
    }))
}

async function assertNoOverflow(page: typePage): Promise<void> {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport)
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport)
}

beforeAll(async () => {
  await mkdir(screenshotRoot, { recursive: true })
  web = await startAppServer(4174)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('recursive analysis browser workflow', () => {
  it('renders responsive light and dark workbenches without overflow', async () => {
    for (const width of [1440, 1024, 390]) {
      for (const theme of ['light', 'dark'] as const) {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 900 },
          reducedMotion: 'reduce',
        })
        const consoleErrors: string[] = []
        const pageErrors: string[] = []
        const failedRequests: string[] = []
        page.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text())
        })
        page.on('pageerror', (error) => pageErrors.push(error.message))
        page.on('requestfailed', (request) => {
          failedRequests.push(`${request.method()} ${request.url()}`)
        })
        await page.addInitScript((selected) => {
          window.localStorage.setItem('struct-theme', `struct-${selected}`)
        }, theme)
        await routeProgress(page)
        await page.goto(runUrl)
        await page.getByRole('heading', { name: 'Partial findings' }).waitFor()
        await waitForThemeStyles(page, theme)
        expect(await page.locator('.app-shell[data-theme]').getAttribute('data-theme'))
          .toBe(`struct-${theme}`)
        expect(await page.locator('html').getAttribute('data-theme'))
          .toBe(`struct-${theme}`)
        expect(await page.locator('html').evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        )).toBe(theme === 'light' ? 'rgb(247, 249, 253)' : 'rgb(16, 23, 37)')
        await assertNoOverflow(page)
        await page.screenshot({
          path: `${screenshotRoot}/${width}-${theme}.png`,
          fullPage: true,
        })
        expect(consoleErrors).toEqual([])
        expect(pageErrors).toEqual([])
        expect(failedRequests).toEqual([])
        await page.close()
      }
    }
  })

  it('supports keyboard drilldown and exact citation navigation', async () => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 900 } })
    await routeProgress(page)
    await page.route(
      `**/api/projects/${projectId}/research/${threadId}/citation/${citationId}`,
      (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: citationId,
          runId,
          sourceVersionId,
          sourceName: 'support-operations.md',
          sourceVersion: 3,
          locator: 'document:lines:12-14',
          contextLines: [{
            lineNumber: 12,
            segments: [{ text: 'Escalations followed delayed ownership handoffs.', cited: true }],
          }],
          startLine: 12,
          endLine: 14,
        }),
      }),
    )
    await page.goto(runUrl)
    const partition = page.locator('details.partition-row').first()
    const summary = partition.locator('summary')
    await summary.focus()
    await page.keyboard.press('Enter')
    expect(await partition.getAttribute('open')).not.toBeNull()
    const citation = page.getByRole('link', { name: 'Open exact citation' })
    await citation.focus()
    expect(await citation.evaluate((element) => element === document.activeElement))
      .toBe(true)
    await page.keyboard.press('Enter')
    await page.waitForURL(`**/citation/${citationId}`)
    const citationHeading = page.getByRole('heading', {
      name: 'support-operations.md',
    })
    await citationHeading.waitFor()
    expect(await citationHeading.count()).toBe(1)
    await page.close()
  })

  it('distinguishes a complete recursive result from partial caveats', async () => {
    const page = await browser.newPage()
    await page.route(`**/api/projects/${projectId}/runs/${runId}/recursive-analysis`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(completeProgress),
      }))
    await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      }))
    await page.goto(runUrl)
    await page.getByRole('heading', { name: 'Findings', exact: true }).waitFor()
    expect(await page.getByText('Use with care.').count()).toBe(0)
    expect(await page.getByRole('button', { name: 'Cancel analysis' }).isDisabled())
      .toBe(true)
    expect(await page.locator('[data-result-status="complete"]').count()).toBe(1)
    await page.close()
  })

  it('requests durable cancellation once and reflects requested state', async () => {
    const page = await browser.newPage()
    await routeProgress(page)
    let cancelRequests = 0
    await page.route(`**/api/projects/${projectId}/runs/${runId}/cancel*`, async (route) => {
      cancelRequests += 1
      expect(new URL(route.request().url()).searchParams.get('workspaceId'))
        .toBe(workspaceId)
      expect(route.request().headers()['idempotency-key']).toBe(`web-cancel-${runId}`)
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'cancelled', replayed: false }),
      })
    })
    await page.goto(runUrl)
    const cancel = page.getByRole('button', { name: 'Cancel analysis' })
    await cancel.click()
    await page.getByRole('button', { name: 'Cancellation requested' }).waitFor()
    expect(await page.getByRole('button', { name: 'Cancellation requested' }).isDisabled())
      .toBe(true)
    expect(cancelRequests).toBe(1)
    await page.close()
  })

  it('shows loading, reconnect, and recoverable read-error states', async () => {
    const loading = await browser.newPage()
    let finishRead: () => void = () => undefined
    const readGate = new Promise<void>((resolve) => {
      finishRead = resolve
    })
    await loading.route(/\/recursive-analysis$/, async (route) => {
      await readGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(partialProgress),
      })
    })
    await loading.route(/\/events(?:\?.*)?$/, (route) => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: '{}',
    }))
    await loading.goto(runUrl)
    await loading.locator('.loading-panel').waitFor()
    finishRead()
    await loading.getByRole('heading', { name: 'Partial findings' }).waitFor()
    await loading.getByText('Reconnecting').first().waitFor()
    await loading.close()

    const errored = await browser.newPage()
    await errored.route(/\/recursive-analysis$/, (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"RecursiveAnalysisUnavailable"}',
    }))
    await errored.route(/\/events(?:\?.*)?$/, (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"ResearchEventsUnavailable"}',
    }))
    await errored.goto(runUrl)
    const alert = errored.getByRole('alert').filter({
      hasText: 'Recursive analysis could not be loaded',
    })
    await alert.waitFor()
    expect(await alert.getByRole('button', { name: 'Try again' }).count()).toBe(1)
    await errored.close()
  })

  it('persists the selected theme across navigation and reload', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(origin)
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await page.reload()
    expect(await page.locator('.app-shell[data-theme]').getAttribute('data-theme'))
      .toBe('struct-dark')
    await context.close()
  })
})
