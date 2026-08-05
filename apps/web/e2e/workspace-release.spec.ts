import { expect, it } from 'bun:test'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import {
  startRealAppStack,
  stopRealAppStack,
} from './support/app-server'
import {
  isExpectedRequestAbort,
  waitForNoteSaveAndRefresh,
} from './support/note-save'

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const folderFixture = resolve(import.meta.dir, 'fixtures/release-folder')
const sourceReadinessTimeoutMs = 60_000
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

async function runReleaseJourney(
  page: import('playwright').Page,
  scenario: (typeof releaseJourneyScenarios)[number],
): Promise<void> {
      const pageErrors: string[] = []
      const requestFailures: string[] = []
      const serverErrors: string[] = []
      const onPageError = (error: Error) => pageErrors.push(String(error))
      const onRequestFailed = (request: import('playwright').Request) => {
        const failure = request.failure()?.errorText ?? 'failed'
        const url = request.url()
        if (!isExpectedRequestAbort(failure, request.method(), url)) {
          requestFailures.push(`${request.method()} ${url} ${failure}`)
        }
      }
      const onResponse = (response: import('playwright').Response) => {
        if (response.status() >= 500) {
          serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
        }
      }
      page.on('pageerror', onPageError)
      page.on('requestfailed', onRequestFailed)
      page.on('response', onResponse)

      try {
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
      const sources = page.getByRole('region', { name: 'Sources' })
      const waitForReadySource = async (name: string | RegExp) => {
        const item = sources.getByRole('listitem').filter({ hasText: name })
        // A source becomes usable only after the worker materializes and
        // indexes its immutable version. Under the full release campaign that
        // can legitimately outlast Playwright's implicit 30-second wait.
        await item.getByText('ready', { exact: true }).waitFor({
          timeout: sourceReadinessTimeoutMs,
        })
      }
      await waitForReadySource(sourceName)

      await page.getByRole('button', { name: 'Paste' }).click()
      await page.getByLabel('Source name').fill('customer-context.md')
      await page.getByLabel('Text or Markdown').fill('The customer asked for a renewal review.')
      await page.getByRole('button', { name: 'Add sources' }).click()
      await waitForReadySource('customer-context.md')

      await page.getByRole('button', { name: 'Folder' }).click()
      await page.locator('input[type="file"]').setInputFiles(folderFixture)
      await page.getByRole('button', { name: 'Add sources' }).click()
      await waitForReadySource(/account-owner\.md/)

      await page.getByRole('button', { name: 'Dataset' }).click()
      await page.locator('input[type="file"]').setInputFiles({
        name: 'renewal-accounts.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('account,risk\nAcme,high\nBeta,low\n'),
      })
      await page.getByRole('button', { name: 'Add sources' }).click()
      await waitForReadySource('renewal-accounts.csv')

      await page.getByRole('link', { name: 'Conversation' }).click()
      await page.getByRole('checkbox', { name: sourceName }).waitFor({
        timeout: sourceReadinessTimeoutMs,
      })
      for (const name of ['customer-context.md', 'renewal-accounts.csv']) {
        await page.getByRole('checkbox', { name }).uncheck()
      }
      await page.getByRole('checkbox', { name: /account-owner\.md/ }).uncheck()
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
      const { noteUpdate, notesRefresh } = waitForNoteSaveAndRefresh(page, projectId, noteId)
      await page.getByLabel('Title').fill('Acme renewal follow-up')
      await noteUpdate
      await page.getByRole('status').filter({ hasText: 'Saved' }).waitFor()
      await notesRefresh
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
      for (const name of ['customer-context.md', 'renewal-accounts.csv']) {
        await page.getByRole('checkbox', { name }).uncheck()
      }
      await page.getByRole('checkbox', { name: /account-owner\.md/ }).uncheck()
      await page.getByRole('textbox', { name: 'Ask your sources' }).fill('What should we do next?')
      await page.getByRole('button', { name: 'Ask follow-up' }).click()
      await page.waitForURL(new RegExp(`/projects/${projectId}/research/${threadId}/runs/${uuidPattern.source}$`, 'i'))
      expect(page.url()).not.toBe(firstRunUrl)
      await page.getByText('Contact the account owner.').waitFor()

      await page.setViewportSize({ width: 1440, height: 900 })
      for (const checkbox of await sources.getByRole('checkbox').all()) {
        await checkbox.uncheck()
      }
      await page.getByRole('checkbox', { name: 'renewal-accounts.csv' }).check()
      await page.getByRole('textbox', { name: 'Ask your sources' }).fill('How many records are in the dataset?')
      await page.getByRole('button', { name: 'Ask follow-up' }).click()
      await page.waitForURL(new RegExp(`/projects/${projectId}/research/${threadId}/runs/${uuidPattern.source}$`, 'i'))
      const datasetAnswer = page.getByText('The dataset contains 2 records.')
      const unavailable = page.getByRole('alert').filter({
        hasText: 'Live progress became unavailable',
      })
      await Promise.race([
        datasetAnswer.waitFor(),
        unavailable.waitFor(),
      ])
      if (await unavailable.isVisible()) {
        await page.reload()
        await datasetAnswer.waitFor()
      }
      await page.getByRole('button', { name: 'Open dataset citation 1' }).click()
      await page.getByRole('heading', { name: 'Deterministic dataset result' }).waitFor()
      await page.getByText(
        'SELECT COUNT(*) AS row_count FROM "records" ORDER BY ALL',
      ).waitFor()
      await page.getByRole('cell', { name: '2', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Close evidence' }).click()

      await page.goto(`${scenario.origin}/projects/${projectId}/notes/${noteId}`)
      await page.getByLabel('Title').waitFor()
      expect(await page.getByLabel('Title').inputValue()).toBe('Acme renewal follow-up')

      expect(pageErrors).toEqual([])
      expect(requestFailures).toEqual([])
      expect(serverErrors).toEqual([])
      } finally {
        page.off('pageerror', onPageError)
        page.off('requestfailed', onRequestFailed)
        page.off('response', onResponse)
      }
}

it('takes a first-time user through root and BASE_PATH durable source-grounded workspaces', async () => {
  const browser = await chromium.launch({ headless: true, timeout: 15_000 })
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    try {
      const page = await context.newPage()
      try {
        for (const scenario of releaseJourneyScenarios) {
          let stack: Awaited<ReturnType<typeof startRealAppStack>> | undefined
          try {
            stack = await withProcessEnvironment(
              scenario.environment,
              () => startRealAppStack(scenario.port),
            )
            await runReleaseJourney(page, scenario)
          } finally {
            await stopRealAppStack(stack)
          }
        }
      } finally {
        await page.close()
      }
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
}, 180_000)
