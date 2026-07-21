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

const projectId = 'f80e8400-e29b-41d4-a716-446655440001'
const threadId = 'f80e8400-e29b-41d4-a716-446655440002'
const runId = 'f80e8400-e29b-41d4-a716-446655440003'
const origin = 'http://127.0.0.1:4175'
const baseUrl = `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`
const screenshotRoot = path.resolve(
  new URL('../../..', import.meta.url).pathname,
  'docs/demos/mixed-source-research',
)

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

interface PageFailures {
  readonly consoleErrors: string[]
  readonly pageErrors: string[]
  readonly requestFailures: string[]
  readonly badResponses: string[]
}

function observeFailures(page: typePage): PageFailures {
  const failures: PageFailures = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    badResponses: [],
  }
  page.on('console', (message) => {
    if (message.type() === 'error') failures.consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => failures.pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    failures.requestFailures.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
    )
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failures.badResponses.push(`${response.status()} ${response.url()}`)
    }
  })
  return failures
}

function expectNoFailures(failures: PageFailures): void {
  expect(failures.consoleErrors).toEqual([])
  expect(failures.pageErrors).toEqual([])
  expect(failures.requestFailures).toEqual([])
  expect(failures.badResponses).toEqual([])
}

async function openDemo(
  page: typePage,
  state = 'complete',
): Promise<void> {
  const response = await page.goto(
    `${baseUrl}?demo=mixed-source&state=${state}`,
    { waitUntil: 'commit' },
  )
  expect(response?.status()).toBe(200)
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
  web = await startAppServer(4175)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('mixed-source report browser workflow', () => {
  it('renders and captures the exact responsive light/dark matrix', async () => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]
    for (const viewport of viewports) {
      for (const theme of ['light', 'dark'] as const) {
        const page = await browser.newPage({
          viewport,
          reducedMotion: 'reduce',
        })
        const failures = observeFailures(page)
        await page.addInitScript((selected) => {
          window.localStorage.setItem('struct-theme', `struct-${selected}`)
        }, theme)
        await openDemo(page)
        await page.getByRole('heading', { name: 'Renewal risk synthesis' }).waitFor()
        await waitForThemeStyles(page, theme)
        expect(await page.locator('.app-shell').getAttribute('data-theme'))
          .toBe(`struct-${theme}`)
        expect(await page.locator('html').getAttribute('data-theme'))
          .toBe(`struct-${theme}`)
        const surfaces = await page.evaluate(() => ({
          html: getComputedStyle(document.documentElement).backgroundColor,
          shell: getComputedStyle(document.querySelector('.app-shell')!).backgroundColor,
          report: getComputedStyle(document.querySelector('.mixed-report')!).backgroundColor,
          heading: getComputedStyle(document.querySelector('.mixed-report-header h2')!).color,
        }))
        expect(surfaces.html).toBe(
          theme === 'light' ? 'rgb(243, 243, 239)' : 'rgb(25, 31, 42)',
        )
        expect(surfaces.heading).toBe(
          theme === 'light' ? 'rgb(32, 36, 44)' : 'rgb(237, 240, 245)',
        )
        expect(surfaces.shell).not.toBe('rgba(0, 0, 0, 0)')
        expect(surfaces.report).not.toBe('rgba(0, 0, 0, 0)')
        await assertNoOverflow(page)
        await page.screenshot({
          path: path.join(
            screenshotRoot,
            `${viewport.width}x${viewport.height}-${theme}.png`,
          ),
          fullPage: false,
        })
        expectNoFailures(failures)
        await page.close()
      }
    }
  })

  it('supports keyboard exploration of citations, source spans, SQL, and rows', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const failures = observeFailures(page)
    await openDemo(page)
    const source = page.locator('details.source-item').first()
    await source.locator('summary').focus()
    await page.keyboard.press('Enter')
    expect(await source.getAttribute('open')).not.toBeNull()

    const sql = page.getByText('View canonical SQL')
    await sql.focus()
    await page.keyboard.press('Enter')
    await page.getByText('SELECT handoff_risk').waitFor()
    expect(await page.getByRole('table').getByRole('columnheader').count()).toBe(3)
    expect(await page.getByRole('table').getByRole('row').count()).toBe(3)

    await page.getByRole('link', { name: '[D1]' }).focus()
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => window.location.hash)).toBe('#document-evidence')
    expectNoFailures(failures)
    await page.close()
  })

  it('provides a focused keyboard-operable mobile section flow', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const failures = observeFailures(page)
    await openDemo(page)
    expect(await page.locator('.synthesis-pane').evaluate(
      (element) => getComputedStyle(element).display,
    )).toBe('block')
    const evidence = page.getByRole('button', { name: 'Evidence' })
    await page.getByRole('link', { name: '[D1]' }).focus()
    await page.keyboard.press('Enter')
    expect(await evidence.getAttribute('aria-pressed')).toBe('true')
    expect(await page.evaluate(() => window.location.hash)).toBe('#document-evidence')
    expect(await page.locator('.evidence-explorer').evaluate(
      (element) => getComputedStyle(element).display,
    )).toBe('block')
    await assertNoOverflow(page)
    expectNoFailures(failures)
    await page.close()
  })

  it('exposes loading, error, empty, reconnecting, and cancelled states', async () => {
    const cases = [
      ['loading', 'Loading committed evidence'],
      ['error', 'Research result unavailable'],
      ['empty', 'No evidence matched this question'],
      ['reconnecting', 'Reconnecting to live progress'],
      ['cancelled', 'This run was cancelled'],
    ] as const
    for (const [state, expected] of cases) {
      const page = await browser.newPage()
      const failures = observeFailures(page)
      await openDemo(page, state)
      await page.getByText(expected, { exact: false }).first().waitFor()
      await assertNoOverflow(page)
      expectNoFailures(failures)
      await page.close()
    }
  })

  it('persists only an explicit theme selection across reloads', async () => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    const failures = observeFailures(page)
    await openDemo(page)
    expect(await page.locator('.app-shell').getAttribute('data-theme'))
      .toBe('struct-dark')
    expect(await page.evaluate(() => localStorage.getItem('struct-theme')))
      .toBeNull()
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    expect(await page.evaluate(() => localStorage.getItem('struct-theme')))
      .toBe('struct-light')
    await page.reload({ waitUntil: 'commit' })
    expect(await page.locator('.app-shell').getAttribute('data-theme'))
      .toBe('struct-light')
    expectNoFailures(failures)
    await context.close()
  })
})
