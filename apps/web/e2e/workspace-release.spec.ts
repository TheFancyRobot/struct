import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import {
  startRealAppStack,
  stopRealAppStack,
} from './support/app-server'

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const notesListUrlPattern = /\/projects\/([0-9a-f-]{36})\/notes(?:\?.*)?$/i
const noteDetailUrlPattern = /\/projects\/([0-9a-f-]{36})\/notes\/[0-9a-f-]{36}(?:\?.*)?$/i
const releaseJourneyScenarios = [
  {
    name: 'root deployment',
    origin: 'http://127.0.0.1:4183',
    port: 4183,
    environment: {},
  },
  {
    name: 'BASE_PATH deployment',
    origin: 'http://127.0.0.1:4187/struct',
    port: 4187,
    environment: {
      BASE_PATH: '/struct',
      BASE_URL: '/struct/',
    },
  },
] as const

function requireMatch(value: string, pattern: RegExp, message: string): RegExpMatchArray {
  const match = value.match(pattern)
  if (!match) throw new Error(message)
  return match
}

function isExpectedRequestAbort(
  failure: string,
  requestMethod: string,
  requestUrl: string,
  currentPageUrl: string,
): boolean {
  if (failure !== 'net::ERR_ABORTED') return false
  if (/\/source-activity\b/.test(requestUrl) || /\/events\b/.test(requestUrl)) return true
  if (requestMethod !== 'GET') return false

  const notesListProjectId = requestUrl.match(notesListUrlPattern)?.[1]
  const noteDetailProjectId = currentPageUrl.match(noteDetailUrlPattern)?.[1]
  return notesListProjectId !== undefined && notesListProjectId === noteDetailProjectId
}

async function withProcessEnvironment<T>(
  environment: Readonly<Record<string, string>>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(environment)) {
    previous.set(key, process.env[key])
    process.env[key] = value
  }
  try {
    return await run()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

it('does not stub browser API traffic at the page boundary', async () => {
  const source = await Bun.file(new URL(import.meta.url)).text()
  expect(source).not.toMatch(/await page\.route\(['"]\*\*\/api\/\*\*['"]/)
})

it('accepts only intentional aborts in the release journey failure capture', () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const noteId = '22222222-2222-2222-2222-222222222222'

  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/source-activity?cursor=1`,
    `http://127.0.0.1:4187/struct/projects/${projectId}/sources`,
  )).toBe(true)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/runs/${noteId}/events`,
    `http://127.0.0.1:4187/struct/projects/${projectId}/research/${noteId}`,
  )).toBe(true)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes`,
    `http://127.0.0.1:4187/struct/projects/${projectId}/notes/${noteId}`,
  )).toBe(true)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'GET',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes`,
    `http://127.0.0.1:4187/struct/projects/${projectId}/sources`,
  )).toBe(false)
  expect(isExpectedRequestAbort(
    'net::ERR_ABORTED',
    'PATCH',
    `http://127.0.0.1:4187/struct/api/projects/${projectId}/notes/${noteId}`,
    `http://127.0.0.1:4187/struct/projects/${projectId}/notes/${noteId}`,
  )).toBe(false)
})

for (const scenario of releaseJourneyScenarios) {
  describe(`v1 browser journey (${scenario.name})`, () => {
    let browser: Awaited<ReturnType<typeof chromium.launch>>
    let stack: Awaited<ReturnType<typeof startRealAppStack>> | undefined

    beforeAll(async () => {
      stack = await withProcessEnvironment(
        scenario.environment,
        () => startRealAppStack(scenario.port),
      )
      browser = await chromium.launch({ headless: true })
    })

    afterAll(async () => {
      await browser?.close()
      await stopRealAppStack(stack)
    })

    it('takes a first-time user through a durable source-grounded workspace and back', async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      const pageErrors: string[] = []
      const requestFailures: string[] = []
      const serverErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(String(error)))
      page.on('requestfailed', (request) => {
        const failure = request.failure()?.errorText ?? 'failed'
        const url = request.url()
        if (!isExpectedRequestAbort(failure, request.method(), url, page.url())) {
          requestFailures.push(`${request.method()} ${url} ${failure}`)
        }
      })
      page.on('response', (response) => {
        if (response.status() >= 500) {
          serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
        }
      })

      const sourceName = 'renewals.md'

      await page.goto(scenario.origin)
      await page.getByLabel('Project name').fill('Renewal research')
      await page.getByRole('button', { name: 'Create project' }).click()
      await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/i)
      const projectId = requireMatch(
        page.url(),
        /\/projects\/([0-9a-f-]{36})$/i,
        'project id missing from created project url',
      )[1]!
      await page.getByRole('heading', { level: 1, name: 'Renewal research' }).waitFor()

      await page.getByRole('link', { name: 'Sources' }).click()
      await page.locator('input[type="file"]').setInputFiles({
        name: sourceName,
        mimeType: 'text/markdown',
        buffer: Buffer.from('# Renewals\nAcme renewal is at risk.\nContact the account owner.'),
      })
      await page.getByRole('button', { name: 'Add sources' }).click()
      await page.getByLabel('Sources', { exact: true }).getByText(sourceName).waitFor()
      await page.getByText('ready', { exact: true }).waitFor()

      await page.getByRole('link', { name: 'Conversation' }).click()
      await page.getByRole('checkbox', { name: sourceName }).waitFor()
      await page.getByRole('textbox', { name: 'Ask your sources' }).fill('Where is renewal risk?')
      await page.getByRole('button', { name: 'Start research' }).click()
      await page.waitForURL(new RegExp(`/projects/${projectId}/research/${uuidPattern.source}/runs/${uuidPattern.source}$`, 'i'))
      const threadId = requireMatch(
        page.url(),
        /\/research\/([0-9a-f-]{36})\/runs\/[0-9a-f-]{36}$/i,
        'thread id missing from research run url',
      )[1]!
      const firstRunUrl = page.url()
      await page.getByText('Renewal risk is concentrated in Acme.').waitFor()

      await page.getByRole('button', { name: 'Open citation 1' }).click()
      await page.getByText('Acme renewal is at risk.').waitFor()
      expect(await page.locator('#evidence-heading').evaluate(
        (element) => element === document.activeElement,
      )).toBe(true)
      await page.getByRole('button', { name: 'Close evidence' }).click()

      await page.getByRole('button', { name: 'Save as note' }).click()
      await page.getByRole('link', { name: 'Open note' }).click()
      await page.waitForURL(new RegExp(`/projects/${projectId}/notes/${uuidPattern.source}$`, 'i'))
      const noteId = requireMatch(
        page.url(),
        /\/notes\/([0-9a-f-]{36})$/i,
        'note id missing from note url',
      )[1]!
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

      await page.goto(`${scenario.origin}/projects/${projectId}/research/${threadId}`)
      await page.getByText('Where is renewal risk?').first().waitFor()
      await page.getByRole('textbox', { name: 'Ask your sources' }).fill('What should we do next?')
      await page.getByRole('button', { name: 'Ask follow-up' }).click()
      await page.waitForURL(new RegExp(`/projects/${projectId}/research/${threadId}/runs/${uuidPattern.source}$`, 'i'))
      expect(page.url()).not.toBe(firstRunUrl)
      await page.getByText('Contact the account owner.').waitFor()

      await page.goto(`${scenario.origin}/projects/${projectId}/notes/${noteId}`)
      await page.getByLabel('Title').waitFor()
      expect(await page.getByLabel('Title').inputValue()).toBe('Acme renewal follow-up')

      expect(pageErrors).toEqual([])
      expect(requestFailures).toEqual([])
      expect(serverErrors).toEqual([])
      await page.close()
    })
  })
}
