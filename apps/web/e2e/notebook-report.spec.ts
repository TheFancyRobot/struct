import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import {
  Finding,
  FindingId,
  Report,
  ResearchRunId,
} from '@struct/domain'
import { Schema } from 'effect'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import { chromium, type Page } from 'playwright'
/* eslint-enable no-unused-vars */

const uuid = (suffix: string) =>
  `d80e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const workspaceId = uuid('1')
const projectId = uuid('2')
const threadId = uuid('3')
const runId = uuid('4')
const citationId = uuid('5')
const sourceVersionId = uuid('6')
const eventId = uuid('7')
const jobId = uuid('8')
const origin = 'http://127.0.0.1:4177'
const runUrl = `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`
  + `?workspaceId=${workspaceId}`
const notebookUrl = `${origin}/projects/${projectId}/notebook`
  + `?workspaceId=${workspaceId}&threadId=${threadId}&runId=${runId}`
const screenshotRoot = path.resolve(
  new URL('../../..', import.meta.url).pathname,
  'docs/demos/durable-notebook',
)

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: ReturnType<typeof Bun.spawn>

async function noOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(sizes.html).toBeLessThanOrEqual(sizes.viewport)
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport)
}

function completedEvent(): string {
  return [
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
        answer: 'The customer evidence supports a focused renewal intervention.',
        citations: [{
          id: citationId,
          sourceVersionId,
          locator: 'lines:1-1',
        }],
        datasetCitations: [],
      },
    })}`,
    '',
    '',
  ].join('\n')
}

async function installNotebookApi(
  page: Page,
  options: {
    readonly initial?: readonly Finding[]
    readonly failReport?: boolean
    readonly malformedReport?: boolean
    readonly delayFindings?: boolean
  } = {},
) {
  let findings = [...(options.initial ?? [])]
  await page.route(`**/api/projects/${projectId}/findings*`, async (route) => {
    if (route.request().method() === 'POST') {
      const finding = JSON.parse(route.request().postData() ?? '{}')
      const decoded = Schema.decodeUnknownSync(Finding)(finding)
      findings = [decoded]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(Schema.encodeSync(Finding)(decoded)),
      })
      return
    }
    if (options.delayFindings) await new Promise((resolve) => setTimeout(resolve, 350))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Schema.encodeSync(Schema.Array(Finding))(findings)),
    })
  })
  await page.route(`**/api/projects/${projectId}/reports`, async (route) => {
    if (options.failReport) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'ArtifactServiceUnavailable' }),
      })
      return
    }
    if (options.malformedReport) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{',
      })
      return
    }
    const body = Schema.decodeUnknownSync(Schema.Struct({
      composition: Schema.Struct({
        id: Schema.UUID,
        title: Schema.String,
        titleRevisionId: Schema.UUID,
        idempotencyKey: Schema.String,
        model: Schema.String,
        promptVersion: Schema.String,
        occurredAt: Schema.Number,
        sections: Schema.Array(Schema.Struct({
          id: Schema.UUID,
          revisionId: Schema.UUID,
          heading: Schema.String,
          findingIds: Schema.Array(Schema.UUID),
        })),
      }),
    }))(JSON.parse(route.request().postData() ?? '{}'))
    const finding = findings[0]!
    const composition = body.composition
    const report = {
      id: composition.id,
      workspaceId,
      projectId,
      runId,
      sourceVersionIds: finding.sourceVersionIds,
      findingIds: [finding.id],
      titleRevisions: [{
        id: composition.titleRevisionId,
        revision: 0,
        content: composition.title,
        authorship: {
          kind: 'generated',
          runId,
          model: composition.model,
          promptVersion: composition.promptVersion,
        },
        idempotencyKey: `${composition.idempotencyKey}:title`,
        createdAt: composition.occurredAt,
      }],
      currentTitleRevision: 0,
      claims: finding.claims,
      sections: composition.sections.map((
        section: Record<string, unknown>,
        ordinal: number,
      ) => ({
        id: section.id,
        ordinal,
        heading: section.heading,
        revisions: [{
          id: section.revisionId,
          revision: 0,
          content: finding.claims[0]!.revisions[0]!.content,
          authorship: {
            kind: 'generated',
            runId,
            model: composition.model,
            promptVersion: composition.promptVersion,
          },
          idempotencyKey: `${composition.idempotencyKey}:section:${ordinal}`,
          createdAt: composition.occurredAt,
        }],
        currentRevision: 0,
        findingIds: section.findingIds,
        claimIds: [finding.claims[0]!.id],
        lastRegenerationKey: null,
      })),
      revision: 0,
      publicationState: 'draft',
      supersededBy: null,
      lastPublicationKey: null,
      createdAt: composition.occurredAt,
      updatedAt: composition.occurredAt,
    }
    const decodedReport = Schema.decodeUnknownSync(Schema.typeSchema(Report))({
      ...report,
      titleRevisions: report.titleRevisions.map((revision) => ({
        ...revision,
        createdAt: BigInt(revision.createdAt),
      })),
      sections: report.sections.map((section) => ({
        ...section,
        revisions: section.revisions.map((revision) => ({
          ...revision,
          createdAt: BigInt(revision.createdAt),
        })),
      })),
      createdAt: BigInt(report.createdAt),
      updatedAt: BigInt(report.updatedAt),
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Schema.encodeSync(Report)(decodedReport)),
    })
  })
  return () => findings
}

beforeAll(async () => {
  await mkdir(screenshotRoot, { recursive: true })
  web = Bun.spawn(
    ['bun', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '4177'],
    {
      cwd: new URL('..', import.meta.url).pathname,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  )
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {
      // Vite is still starting.
    }
    await Bun.sleep(100)
  }
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  web?.kill()
  await web?.exited
})

describe('durable finding and report browser workflow', () => {
  it('saves a completed run, opens its notebook, and composes a draft report', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await installNotebookApi(page)
    await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: completedEvent(),
      }))
    await page.route(`**/api/projects/${projectId}/runs/${runId}/recursive-analysis`, (route) =>
      route.fulfill({ status: 404, body: '' }))
    await page.goto(runUrl)
    await page.getByText('The customer evidence supports').waitFor()
    await page.getByRole('button', { name: 'Save finding' }).click()
    await page.getByRole('link', { name: 'Open project notebook' }).click()
    await page.waitForURL('**/notebook?*')
    await page.getByRole('checkbox', {
      name: /Select The customer evidence supports/,
    }).check()
    await page.getByRole('button', { name: 'Compose report (1)' }).click()
    await page.getByRole('heading', { name: 'Research notebook report' }).waitFor()
    expect(await page.locator('.report-composer').getByText(
      'The customer evidence supports a focused renewal intervention.',
      { exact: true },
    ).count()).toBe(1)
    await page.getByText('Citation needs validation').waitFor()
    await noOverflow(page)
    await page.screenshot({
      path: path.join(screenshotRoot, '1440x900-light.png'),
      fullPage: false,
    })
    await page.close()
  })

  it('is responsive in dark mode and never links a citation to the wrong run', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.addInitScript(() =>
      localStorage.setItem('struct-theme', 'struct-dark'))
    const getFindings = await installNotebookApi(page)
    await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: completedEvent(),
      }))
    await page.route(`**/api/projects/${projectId}/runs/${runId}/recursive-analysis`, (route) =>
      route.fulfill({ status: 404, body: '' }))
    await page.goto(runUrl)
    await page.getByRole('button', { name: 'Save finding' }).click()
    const first = getFindings()[0]!
    const foreignRunId = uuid('91')
    const foreign = Finding.make({
      ...first,
      id: FindingId.make(uuid('90')),
      runId: ResearchRunId.make(foreignRunId),
      titleRevisions: first.titleRevisions.map((revision) => ({
        ...revision,
        content: 'Finding from another run',
        authorship: {
          kind: 'generated',
          runId: ResearchRunId.make(foreignRunId),
          model: 'completed-run',
          promptVersion: 'persisted-output-v1',
        },
      })),
      claims: first.claims.map((claim) => ({
        ...claim,
        origin: {
          kind: 'research-run',
          runId: ResearchRunId.make(foreignRunId),
        },
        revisions: claim.revisions.map((revision) => ({
          ...revision,
          authorship: {
            kind: 'generated',
            runId: ResearchRunId.make(foreignRunId),
            model: 'completed-run',
            promptVersion: 'persisted-output-v1',
          },
        })),
      })),
    })
    await page.unrouteAll()
    await installNotebookApi(page, { initial: [first, foreign] })
    await page.goto(notebookUrl)
    expect(await page.getByRole('link', { name: /Open citation/ }).count()).toBe(1)
    await noOverflow(page)
    await page.screenshot({
      path: path.join(screenshotRoot, '390x844-dark.png'),
      fullPage: false,
    })
    await page.close()
  })

  it('shows loading, empty, invalid-citation, and persistence-failure states', async () => {
    const loading = await browser.newPage()
    await installNotebookApi(loading, { delayFindings: true })
    await loading.goto(notebookUrl)
    await loading.getByText('Loading durable findings…').waitFor()
    await loading.close()

    const empty = await browser.newPage()
    await installNotebookApi(empty)
    await empty.goto(notebookUrl)
    await empty.getByText('No saved findings yet').waitFor()
    await empty.close()

    const failure = await browser.newPage()
    await installNotebookApi(failure, { failReport: true })
    await failure.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: completedEvent(),
      }))
    await failure.route(`**/api/projects/${projectId}/runs/${runId}/recursive-analysis`, (route) =>
      route.fulfill({ status: 404, body: '' }))
    await failure.goto(runUrl)
    await failure.getByRole('button', { name: 'Save finding' }).click()
    await failure.getByRole('link', { name: 'Open project notebook' }).click()
    await failure.getByRole('checkbox').check()
    await failure.getByRole('button', { name: 'Compose report (1)' }).click()
    await failure.getByRole('alert').getByText(
      'The notebook could not be saved. Try again.',
    ).waitFor()
    await failure.close()

    const malformed = await browser.newPage()
    await installNotebookApi(malformed, { malformedReport: true })
    await malformed.route(
      `**/api/projects/${projectId}/runs/${runId}/events*`,
      (route) => route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: completedEvent(),
      }),
    )
    await malformed.route(
      `**/api/projects/${projectId}/runs/${runId}/recursive-analysis`,
      (route) => route.fulfill({ status: 404, body: '' }),
    )
    await malformed.goto(runUrl)
    await malformed.getByRole('button', { name: 'Save finding' }).click()
    await malformed.getByRole('link', { name: 'Open project notebook' }).click()
    await malformed.getByRole('checkbox').check()
    await malformed.getByRole('button', { name: 'Compose report (1)' }).click()
    const malformedAlert = malformed.getByRole('alert')
    await malformedAlert.getByText(
      'The notebook returned an invalid persistence response.',
    ).waitFor()
    expect(await malformedAlert.textContent()).not.toContain('ParseError')
    await malformed.close()
  })
})
