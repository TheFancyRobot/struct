import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import {
  startAppServer,
  stopAppServer,
} from './support/app-server'

const projectId = '750e8400-e29b-41d4-a716-446655440001'
const threadId = '750e8400-e29b-41d4-a716-446655440002'
const runId = '750e8400-e29b-41d4-a716-446655440003'
const citationId = '750e8400-e29b-41d4-a716-446655440004'
const jobId = '750e8400-e29b-41d4-a716-446655440005'
const eventId = '750e8400-e29b-41d4-a716-446655440006'
const sourceVersionId = '750e8400-e29b-41d4-a716-446655440007'
const origin = 'http://127.0.0.1:4173'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

beforeAll(async () => {
  web = await startAppServer(4173)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('walking-skeleton browser path', () => {
  it('detects the OS theme without persisting it and saves only an explicit selection', async () => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    await page.goto(origin)

    const appRoot = page.locator('.app-shell[data-theme]')
    const htmlRoot = page.locator('html')
    expect(await appRoot.getAttribute('data-theme')).toBe('struct-dark')
    expect(await htmlRoot.getAttribute('data-theme')).toBe('struct-dark')
    expect(await page.evaluate(() => window.localStorage.getItem('struct-theme')))
      .toBeNull()
    const darkBackground = await htmlRoot.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )

    await page.getByRole('button', { name: 'Switch to light theme' }).click()

    expect(await appRoot.getAttribute('data-theme')).toBe('struct-light')
    expect(await htmlRoot.getAttribute('data-theme')).toBe('struct-light')
    expect(await htmlRoot.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )).not.toBe(darkBackground)
    expect(await page.evaluate(() => window.localStorage.getItem('struct-theme')))
      .toBe('struct-light')
    expect(await page.getByRole('button', { name: 'Switch to dark theme' }).count())
      .toBe(1)

    await page.reload()
    expect(await appRoot.getAttribute('data-theme')).toBe('struct-light')
    expect(await htmlRoot.getAttribute('data-theme')).toBe('struct-light')
    await context.close()
  })

  it('opens a completed answer citation with the keyboard', async () => {
    const page = await browser.newPage()
    await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
      route.fulfill({
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
              attempt: 0,
              answer: 'The source confirms the walking slice.',
              citations: [{
                id: citationId,
                sourceVersionId,
                locator: 'lines 1-1',
              }],
              datasetCitations: [],
            },
          })}`,
          '',
          '',
        ].join('\n'),
      }))
    await page.route(
      `**/api/projects/${projectId}/research/${threadId}/citation/${citationId}`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: citationId,
            runId,
            sourceVersionId,
            sourceName: 'walking-skeleton.txt',
            sourceVersion: 1,
            locator: 'lines 1-1',
            contextLines: [{
              lineNumber: 1,
              segments: [{
                text: 'The source confirms the walking slice.',
                cited: true,
              }],
            }],
            startLine: 1,
            endLine: 1,
          }),
        }),
    )

    await page.goto(
      `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`,
    )
    await page.getByText('The source confirms the walking slice.').waitFor()

    const citationLink = page.getByRole('link', {
      name: 'Open citation 1 in source version',
    })
    await citationLink.focus()
    expect(await citationLink.evaluate((element) => element === document.activeElement))
      .toBe(true)
    await page.keyboard.press('Enter')

    await page.waitForURL(`**/citation/${citationId}`)
    expect(await page.getByRole('heading', { name: 'walking-skeleton.txt' }).textContent())
      .toBe('walking-skeleton.txt')
    expect(await page.getByRole('heading', { name: 'Source preview' }).textContent())
      .toBe('Source preview')
    expect(await page.locator('span.bg-warning\\/40').textContent())
      .toBe('The source confirms the walking slice.')

    await page.close()
  })

  it('shows an explicit insufficient-evidence state without an uncited answer', async () => {
    const page = await browser.newPage()
    await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'id: 1',
          'event: retrieval-completed',
          `data: ${JSON.stringify({
            id: eventId,
            cursor: '1',
            runId,
            createdAt: 1,
            type: 'retrieval-completed',
            data: {
              jobId,
              attempt: 0,
              evidenceCount: 0,
              sourceVersionIds: [],
            },
          })}`,
          '',
          'id: 2',
          'event: research-failed',
          `data: ${JSON.stringify({
            id: '750e8400-e29b-41d4-a716-446655440008',
            cursor: '2',
            runId,
            createdAt: 2,
            type: 'research-failed',
            data: {
              jobId,
              attempt: 0,
              errorTag: 'EvidenceInsufficientError',
              message: 'Evidence was insufficient',
            },
          })}`,
          '',
          '',
        ].join('\n'),
      }))

    await page.goto(
      `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`,
    )

    await page.getByText('No evidence matched the selected documents').waitFor()
    expect(await page.getByRole('alert').textContent()).toContain(
      'did not contain enough support',
    )
    expect(await page.getByRole('link', { name: /Open citation/ }).count()).toBe(0)

    await page.close()
  })

  it('shows loading and tenant-safe not-found citation states', async () => {
    const loadingPage = await browser.newPage()
    await loadingPage.route(
      `**/api/projects/${projectId}/research/${threadId}/citation/${citationId}`,
      () => undefined,
    )
    await loadingPage.goto(
      `${origin}/projects/${projectId}/research/${threadId}/citation/${citationId}`,
    )
    await loadingPage.getByText('Loading citation…').waitFor()
    await loadingPage.close()

    const missingPage = await browser.newPage()
    await missingPage.route(
      `**/api/projects/${projectId}/research/${threadId}/citation/${citationId}`,
      (route) => route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'CitationNotFound' }),
      }),
    )
    await missingPage.goto(
      `${origin}/projects/${projectId}/research/${threadId}/citation/${citationId}`,
    )
    await missingPage.getByRole('alert').waitFor()
    expect(await missingPage.getByRole('alert').textContent()).toContain(
      'no longer available',
    )

    await missingPage.close()
  })

  it('shows empty progress and an explicit supported typed-format failure', async () => {
    const page = await browser.newPage()
    let finishStream: () => void = () => undefined
    const streamGate = new Promise<void>((resolve) => {
      finishStream = resolve
    })
    await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, async (route) => {
      await streamGate
      await route.fulfill({
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
              errorTag: 'UnsupportedSourceTypeError',
              message: 'Source type is unsupported',
            },
          })}`,
          '',
          '',
        ].join('\n'),
      })
    })

    await page.goto(
      `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`,
    )
    await page.getByText('Waiting for persisted progress…').waitFor()
    expect(await page.getByRole('status').textContent()).toContain(
      'Waiting for persisted progress',
    )
    finishStream()
    await page.getByRole('alert').waitFor()
    expect(await page.getByRole('alert').textContent()).toContain(
      'format that document research does not support',
    )

    await page.close()
  })
})
