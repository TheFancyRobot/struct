import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import {
  Claim,
  Finding,
  Report,
  ReportSection,
} from '@struct/domain'
import { Schema } from 'effect'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import { chromium, type Page } from 'playwright'
import {
  startAppServer,
  stopAppServer,
} from './support/app-server'
import { waitForThemeStyles } from './support/theme-readiness'
/* eslint-enable no-unused-vars */

const uuid = (suffix: string) =>
  `d80e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
const hash = (character: string) => `sha256:${character.repeat(64)}`
const digest = (character: string) => character.repeat(64)
const workspaceId = uuid('1')
const projectId = uuid('2')
const threadId = uuid('3')
const runId = uuid('4')
const sourceVersionId = uuid('5')
const reportId = uuid('6')
const origin = 'http://127.0.0.1:4177'
const notebookUrl = `${origin}/projects/${projectId}/notebook`
  + `?workspaceId=${workspaceId}&threadId=${threadId}&reportId=${reportId}`
const screenshotRoot = path.resolve(
  new URL('../../..', import.meta.url).pathname,
  'docs/demos/report-workspace',
)
const semantics = {
  unit: null,
  timeWindow: null,
  version: '2026-Q2',
  filters: [],
  cohort: null,
  denominator: null,
  joinKeys: [],
}

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

function documentEvidence(suffix: string, claimSignature: string) {
  return {
    id: hash(suffix),
    claimSignature,
    stance: 'supports' as const,
    semantics,
    payload: {
      kind: 'document' as const,
      chunkId: uuid(`${suffix}01`),
      documentId: uuid(`${suffix}02`),
      sourceVersionId,
      chunkingVersion: 'v1',
      ordinal: 0,
      locator: {
        page: 2,
        section: 'Renewal analysis',
        paragraph: 3,
        charStart: 0,
        charEnd: 24,
        byteStart: 0,
        byteEnd: 24,
      },
      citationLocator: 'document:page:2,chars:0-24,bytes:0-24',
      excerpt: 'Implementation delays predict renewal risk.',
      trust: 'untrusted-evidence' as const,
    },
    limitations: [],
  }
}

function datasetEvidence(suffix: string, claimSignature: string) {
  return {
    id: hash(suffix),
    claimSignature,
    stance: 'supports' as const,
    semantics: { ...semantics, unit: 'accounts', denominator: '73 accounts' },
    payload: {
      kind: 'dataset' as const,
      evidence: {
        citation: {
          id: uuid(`${suffix}03`),
          queryResultSnapshotId: uuid(`${suffix}04`),
          workspaceId,
          projectId,
          datasetId: uuid(`${suffix}05`),
          datasetSnapshotId: uuid(`${suffix}06`),
          schemaHash: hash('c'),
          parquetDigest: digest('d'),
          resultHash: hash('e'),
          resultArtifactHash: hash('f'),
          canonicalSql: 'SELECT COUNT(*) AS accounts FROM renewal_risk',
          selectedColumns: ['accounts'],
          rowStart: 0,
          rowEndExclusive: 1,
          createdAt: 1n,
        },
        snapshot: {
          id: uuid(`${suffix}04`),
          workspaceId,
          projectId,
          requestHash: hash('1'),
          protocolVersion: '1' as const,
          engineVersion: 'duckdb-1.5.4',
          engineAdapterVersion: '@duckdb/node-api@1.5.4-r.1',
          executionPolicyVersion: 1,
          engineConfigHash: hash('2'),
          canonicalSql: 'SELECT COUNT(*) AS accounts FROM renewal_risk',
          snapshots: [{
            alias: 'renewal_risk',
            datasetId: uuid(`${suffix}05`),
            snapshotId: uuid(`${suffix}06`),
            schemaHash: hash('c'),
            parquetDigest: digest('d'),
          }],
          schemaHash: hash('3'),
          resultHash: hash('e'),
          resultArtifactHash: hash('f'),
          columns: [{ ordinal: 0, name: 'accounts', type: 'BIGINT' }],
          rows: [['18']],
          rowCount: 1,
          truncated: false,
          executedAt: 1n,
          createdAt: 1n,
        },
        columns: [{ ordinal: 0, name: 'accounts', type: 'BIGINT' }],
        rows: [['18']],
      },
      exactness: 'exact-immutable-query-result' as const,
    },
    limitations: [],
  }
}

function recursiveEvidence(suffix: string, claimSignature: string) {
  return {
    id: hash(suffix),
    claimSignature,
    stance: 'supports' as const,
    semantics,
    payload: {
      kind: 'recursive' as const,
      reference: {
        id: hash('9'),
        sourceVersionId,
        artifact: {
          digest: hash('8'),
          byteLength: 284,
          mediaType: 'application/json',
        },
        locator: 'partition:enterprise/summary',
      },
      excerpt: 'Four partitions independently identify delayed handoffs.',
      trust: 'untrusted-evidence' as const,
    },
    limitations: [],
  }
}

function claim(
  suffix: string,
  mode: 'document' | 'dataset' | 'recursive' | 'hybrid',
  state: 'publishable' | 'stale' = 'publishable',
): Claim {
  const signature = hash(String.fromCharCode(96 + Number(suffix)))
  const evidence = mode === 'document'
    ? [documentEvidence(suffix, signature)]
    : mode === 'dataset'
      ? [datasetEvidence(suffix, signature)]
      : mode === 'recursive'
        ? [recursiveEvidence(suffix, signature)]
        : [
          documentEvidence(suffix, signature),
          datasetEvidence(String(Number(suffix) + 1), signature),
        ]
  return Schema.decodeUnknownSync(Schema.typeSchema(Claim))({
    id: uuid(`${suffix}10`),
    claimSignature: signature,
    citation: {
      citationId: uuid(`${suffix}11`),
      state,
      revision: 0,
      supersededBy: null,
      lastIdempotencyKey: null,
      updatedAt: 1n,
    },
    origin: { kind: 'research-run', runId },
    revisions: [{
      id: uuid(`${suffix}12`),
      revision: 0,
      content: `${mode[0]?.toUpperCase()}${mode.slice(1)} evidence establishes the retained finding.`,
      authorship: {
        kind: 'generated',
        runId,
        model: 'fixture',
        promptVersion: 'v1',
      },
      idempotencyKey: `claim:${suffix}`,
      createdAt: 1n,
    }],
    currentRevision: 0,
    support: { kind: 'supported', mode, evidence },
    createdAt: 1n,
  })
}

function finding(
  suffix: string,
  title: string,
  claims: ReadonlyArray<Claim>,
): Finding {
  return Schema.decodeUnknownSync(Schema.typeSchema(Finding))({
    id: uuid(`${suffix}20`),
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId],
    titleRevisions: [{
      id: uuid(`${suffix}21`),
      revision: 0,
      content: title,
      authorship: {
        kind: 'generated',
        runId,
        model: 'fixture',
        promptVersion: 'v1',
      },
      idempotencyKey: `finding:${suffix}`,
      createdAt: 1n,
    }],
    currentRevision: 0,
    claims,
    supersededBy: null,
    createdAt: 1n,
    updatedAt: 1n,
  })
}

const documentClaim = claim('1', 'document')
const datasetClaim = claim('2', 'dataset')
const recursiveClaim = claim('3', 'recursive')
const hybridClaim = claim('4', 'hybrid')
const staleClaim = claim('5', 'document', 'stale')
const replacementClaim = claim('6', 'document')
const findings = [
  finding('1', 'Customer narrative', [documentClaim]),
  finding('2', 'Affected cohort', [datasetClaim]),
  finding('3', 'Corpus-wide pattern', [recursiveClaim]),
  finding('4', 'Reconciled conclusion', [hybridClaim]),
  finding('5', 'Evidence requiring repair', [staleClaim, replacementClaim]),
]

function initialReport(): Report {
  const visibleClaims = [
    documentClaim,
    datasetClaim,
    recursiveClaim,
    hybridClaim,
    staleClaim,
  ]
  return Schema.decodeUnknownSync(Schema.typeSchema(Report))({
    id: reportId,
    workspaceId,
    projectId,
    runId,
    sourceVersionIds: [sourceVersionId],
    findingIds: findings.map((item) => item.id),
    titleRevisions: [{
      id: uuid('70'),
      revision: 0,
      content: 'Enterprise renewal risk brief',
      authorship: {
        kind: 'generated',
        runId,
        model: 'fixture',
        promptVersion: 'v1',
      },
      idempotencyKey: 'report:title',
      createdAt: 1n,
    }],
    currentTitleRevision: 0,
    claims: visibleClaims,
    sections: findings.map((item, ordinal) => {
      const currentClaim = visibleClaims[ordinal]!
      return {
        id: uuid(String(80 + ordinal)),
        ordinal,
        heading: item.titleRevisions[0]!.content,
        revisions: [{
          id: uuid(String(90 + ordinal)),
          revision: 0,
          content: currentClaim.revisions[0]!.content,
          authorship: {
            kind: 'generated' as const,
            runId,
            model: 'fixture',
            promptVersion: 'v1',
          },
          idempotencyKey: `section:${ordinal}`,
          createdAt: 1n,
        }],
        currentRevision: 0,
        findingIds: [item.id],
        claimIds: [currentClaim.id],
        lastRegenerationKey: null,
      }
    }),
    revision: 0,
    publicationState: 'draft',
    supersededBy: null,
    lastPublicationKey: null,
    createdAt: 1n,
    updatedAt: 1n,
  })
}

function encoded(value: Report): string {
  return JSON.stringify(Schema.encodeSync(Report)(value))
}

function appendSectionRevision(
  report: Report,
  section: ReportSection,
  content: string,
  authorship: 'user' | 'generated',
): ReportSection {
  const nextRevision = section.currentRevision + 1
  return Schema.decodeUnknownSync(Schema.typeSchema(ReportSection))({
    ...section,
    revisions: [...section.revisions, {
      id: uuid(String(200 + report.revision)),
      revision: nextRevision,
      content,
      authorship: authorship === 'user'
        ? { kind: 'user', actorId: workspaceId }
        : {
          kind: 'generated',
          runId,
          model: 'deterministic-report-repair',
          promptVersion: 'immutable-claims-v1',
        },
      idempotencyKey: `mutation:${report.revision + 1}`,
      createdAt: BigInt(10 + report.revision),
    }],
    currentRevision: nextRevision,
    lastRegenerationKey: `mutation:${report.revision + 1}`,
  })
}

async function installApi(page: Page, options: {
  readonly failExport?: boolean
  readonly staleEdit?: boolean
} = {}) {
  let current = initialReport()
  const snapshots = new Map<number, Report>([[0, current]])
  const save = (next: Report) => {
    current = next
    snapshots.set(next.revision, next)
  }
  await page.route(`**/api/projects/${projectId}/findings*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Schema.encodeSync(Schema.Array(Finding))(findings)),
    }))
  await page.route(`**/api/projects/${projectId}/reports`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: encoded(current),
    }))
  await page.route(
    `**/api/projects/${projectId}/research/${threadId}/citation/*`,
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: documentClaim.citation.citationId,
        runId,
        sourceVersionId,
        sourceName: 'customer-success-review.md',
        sourceVersion: 4,
        locator: 'lines:118-123',
        contextLines: [{
          lineNumber: 118,
          segments: [{
            text: 'Implementation delays predict renewal risk.',
            cited: true,
          }],
        }],
        startLine: 118,
        endLine: 123,
      }),
    }),
  )
  await page.route(`**/api/projects/${projectId}/reports/${reportId}**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/exports')) {
      if (options.failExport) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'ReportExportBlockedError' }),
        })
        return
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          workspaceId,
          projectId,
          reportId,
          reportRevision: current.revision,
          digest: hash('a'),
          artifactRef: `artifact://sha256/${'a'.repeat(64)}`,
          byteLength: 4096,
          mediaType: 'application/vnd.struct.report-bundle+json',
        }),
      })
      return
    }
    if (url.pathname.includes('/exports/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.struct.report-bundle+json',
        body: '{}',
      })
      return
    }
    if (request.method() === 'GET') {
      const revision = url.searchParams.get('revision')
      const selected = revision === null ? current : snapshots.get(Number(revision))
      await route.fulfill({
        status: selected === undefined ? 404 : 200,
        contentType: 'application/json',
        body: selected === undefined
          ? JSON.stringify({ error: 'ArtifactNotFound' })
          : encoded(selected),
      })
      return
    }
    const body = JSON.parse(request.postData() ?? '{}')
    if (options.staleEdit && body.kind === 'edit') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'StaleReportRevisionError' }),
      })
      return
    }
    let next = current
    if (body.kind === 'edit') {
      next = Report.make({
        ...current,
        sections: current.sections.map((section) =>
          section.id === body.input.sectionId
            ? appendSectionRevision(current, section, body.input.content, 'user')
            : section),
        revision: current.revision + 1,
        publicationState: 'draft',
        updatedAt: BigInt(body.input.occurredAt),
      })
    } else if (body.kind === 'reorder') {
      next = Report.make({
        ...current,
        sections: body.orderedSectionIds.map((id: string, ordinal: number) => ({
          ...current.sections.find((section) => section.id === id)!,
          ordinal,
        })),
        revision: current.revision + 1,
        publicationState: 'draft',
        updatedAt: BigInt(body.occurredAt),
      })
    } else if (body.kind === 'replace-claim') {
      const section = current.sections.find((item) =>
        item.claimIds.includes(body.claimId))!
      next = Report.make({
        ...current,
        claims: current.claims.map((item) =>
          item.id === body.claimId ? replacementClaim : item),
        sections: current.sections.map((item) => item.id === section.id
          ? appendSectionRevision(
            current,
            { ...item, claimIds: [replacementClaim.id] },
            replacementClaim.revisions[0]!.content,
            'generated',
          )
          : item),
        revision: current.revision + 1,
        publicationState: 'draft',
        updatedAt: BigInt(body.occurredAt),
      })
    } else if (body.kind === 'prepare-publication') {
      next = Report.make({
        ...current,
        revision: current.revision + 1,
        publicationState: 'publishable',
        lastPublicationKey: request.headers()['idempotency-key'] ?? null,
        updatedAt: BigInt(body.occurredAt),
      })
    } else if (body.kind === 'publish') {
      next = Report.make({
        ...current,
        revision: current.revision + 1,
        publicationState: 'published',
        lastPublicationKey: request.headers()['idempotency-key'] ?? null,
        updatedAt: BigInt(body.occurredAt),
      })
    }
    save(next)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: encoded(next),
    })
  })
  return { current: () => current }
}

async function noOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(width.html).toBeLessThanOrEqual(width.viewport)
  expect(width.body).toBeLessThanOrEqual(width.viewport)
  for (const selector of [
    '.notebook-hero',
    '.notebook-compose',
    '.report-workspace',
    '.report-primary-actions',
    '.report-editor-canvas',
  ]) {
    const box = await page.locator(selector).boundingBox()
    expect(box).not.toBeNull()
    if (box !== null) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width.viewport + 0.5)
    }
  }
}

beforeAll(async () => {
  await rm(screenshotRoot, { recursive: true, force: true })
  await mkdir(screenshotRoot, { recursive: true })
  web = await startAppServer(4177)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('report workspace browser workflow', () => {
  it('creates a report from the finding picker and preserves its reload identity', async () => {
    const page = await browser.newPage()
    await installApi(page)
    await page.goto(
      `${origin}/projects/${projectId}/notebook`
      + `?workspaceId=${workspaceId}&threadId=${threadId}`,
    )
    const checks = page.getByRole('checkbox')
    for (let index = 0; index < await checks.count(); index += 1) {
      await checks.nth(index).check()
    }
    await page.getByRole('button', { name: 'Compose report (5)' }).click()
    await page.getByRole('heading', {
      name: 'Enterprise renewal risk brief',
    }).waitFor()
    expect(new URL(page.url()).searchParams.get('reportId')).toBe(reportId)
    await page.reload()
    await page.getByText('Revision 0 · draft').waitFor()
    await page.close()
  })

  it('opens, repairs, edits, reorders, reloads, navigates history, publishes, and exports', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const api = await installApi(page)
    await page.goto(notebookUrl)
    await page.getByRole('heading', { name: 'Enterprise renewal risk brief' }).waitFor()
    await page.getByText('Stale citation').waitFor()

    for (const name of [
      'document · publishable',
      'dataset · publishable',
      'recursive · publishable',
      'hybrid · publishable',
    ]) {
      await page.getByRole('button', { name }).first().click()
      await page.locator('.report-evidence-drawer')
        .getByRole('heading', { name: /evidence/i }).waitFor()
      await page.getByRole('button', { name: 'Close evidence' }).click()
    }
    await page.getByRole('button', { name: 'document · publishable' })
      .first().click()
    const sourceLink = page.getByRole('link', { name: 'Open source citation' })
    await sourceLink.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('link', { name: 'Back to report' }).waitFor()
    expect(new URL(page.url()).searchParams.get('returnTo')).toContain(
      `/projects/${projectId}/notebook`,
    )
    expect(new URL(page.url()).searchParams.get('returnTo')).toContain(
      `reportId=${reportId}`,
    )
    await page.getByRole('link', { name: 'Back to report' }).press('Enter')
    await page.getByRole('heading', {
      name: 'Enterprise renewal risk brief',
    }).waitFor()

    const repairButton = page.getByRole('button', {
      name: 'Repair',
      exact: true,
    })
    await repairButton.focus()
    await repairButton.press('Enter')
    let dialog = page.getByRole('dialog', { name: 'Resolve this claim' })
    await dialog.waitFor()
    await page.keyboard.press('Escape')
    expect(await repairButton.evaluate(
      (element) => element === document.activeElement,
    )).toBe(true)
    await repairButton.press('Enter')
    dialog = page.getByRole('dialog', { name: 'Resolve this claim' })
    await dialog.waitFor()
    expect(await dialog.getByRole('button', { name: /Remove claim/ }).count()).toBe(1)
    expect(await dialog.getByRole('button', { name: /Regenerate this section/ }).count()).toBe(1)
    expect(await dialog.getByText('Newly validated evidence').count()).toBe(1)
    await dialog.getByRole('button', {
      name: /Document evidence establishes the retained finding/,
    }).click()
    await page.getByText('Saved revision 1').waitFor()
    expect(await page.getByRole('status').filter({
      hasText: 'Saved revision 1',
    }).evaluate((element) => element === document.activeElement)).toBe(true)
    expect(api.current().claims.some((item) => item.id === staleClaim.id)).toBe(false)

    const section = page.locator('.editable-report-section').first()
    await section.click()
    const editor = section.getByRole('textbox')
    await editor.fill('A focused user-authored executive summary.')
    await section.getByRole('button', { name: 'Save user revision' }).click()
    await page.getByText('Saved revision 2').waitFor()

    await page.getByRole('button', { name: 'Move Customer narrative down' }).click()
    await page.getByText('Saved revision 3').waitFor()
    await page.reload()
    await page.getByText('A focused user-authored executive summary.').waitFor()

    await page.getByRole('button', { name: 'Revision 0 Immutable snapshot' }).click()
    await page.getByText('read-only history').waitFor()
    expect(await page.getByRole('button', {
      name: 'Publish',
      exact: true,
    }).isDisabled()).toBe(true)
    expect(await page.getByRole('button', { name: 'Export' }).isDisabled()).toBe(true)
    await page.getByRole('button', { name: 'Return to current report' }).click()

    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page.getByText('Saved revision 5').waitFor()
    expect(api.current().publicationState).toBe('published')
    await page.getByRole('button', { name: 'Export' }).click()
    await page.getByText(/Export ready/).waitFor()

    await page.keyboard.press('Shift+Tab')
    await noOverflow(page)
    await page.close()
  })

  it('surfaces offline, stale-write, and export blockers', async () => {
    const offline = await browser.newPage()
    await installApi(offline)
    await offline.goto(notebookUrl)
    const offlineSection = offline.locator('.editable-report-section').first()
    await offlineSection.click()
    await offlineSection.getByRole('textbox').fill('Pending offline edit')
    await offline.getByRole('button', {
      name: 'Repair',
      exact: true,
    }).click()
    await offline.context().setOffline(true)
    await offline.getByRole('alert').getByText(
      'Offline. Editing, repair, publish, and export are paused.',
    ).waitFor()
    expect(await offline.getByRole('button', {
      name: 'Publish',
      exact: true,
    }).isDisabled()).toBe(true)
    expect(await offline.getByRole('button', { name: 'Export' }).isDisabled()).toBe(true)
    expect(await offline.getByRole('button', {
      name: 'Save user revision',
    }).isDisabled()).toBe(true)
    expect(await offline.getByRole('button', {
      name: 'Move Customer narrative down',
    }).isDisabled()).toBe(true)
    const offlineDialog = offline.getByRole('dialog')
    expect(await offlineDialog.getByRole('button', {
      name: /Remove claim/,
    }).isDisabled()).toBe(true)
    expect(await offlineDialog.getByRole('button', {
      name: /Regenerate this section/,
    }).isDisabled()).toBe(true)
    expect(await offlineDialog.getByRole('button', {
      name: /Document evidence establishes/,
    }).isDisabled()).toBe(true)
    expect(await offline.getByRole('button', {
      name: 'Repair',
      exact: true,
    }).isDisabled()).toBe(true)
    await offline.context().setOffline(false)
    await offline.close()

    const stale = await browser.newPage()
    await installApi(stale, { staleEdit: true })
    await stale.goto(notebookUrl)
    const section = stale.locator('.editable-report-section').first()
    await section.click()
    await section.getByRole('textbox').fill('Conflicting edit')
    await section.getByRole('button', { name: 'Save user revision' }).click()
    await stale.getByRole('alert').getByText(
      'The report changed. Reload before editing again.',
    ).waitFor()
    await stale.close()

    const failedExport = await browser.newPage()
    await installApi(failedExport, { failExport: true })
    await failedExport.goto(notebookUrl)
    await failedExport.getByRole('button', {
      name: 'Repair',
      exact: true,
    }).click()
    await failedExport.getByRole('dialog').getByRole('button', {
      name: /Document evidence establishes/,
    }).click()
    await failedExport.getByText('Saved revision 1').waitFor()
    await failedExport.getByRole('button', { name: 'Export' }).click()
    await failedExport.getByRole('alert').getByText(
      'Publication is blocked by the claim states listed in the report.',
    ).waitFor()
    await failedExport.close()
  }, 15_000)

  it('meets the release accessibility contract', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const page = await browser.newPage({
        viewport: { width: 320, height: 844 },
        reducedMotion: 'reduce',
      })
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem(
          'struct-theme',
          selectedTheme === 'dark' ? 'struct-dark' : 'struct-light',
        )
      }, theme)
      await installApi(page)
      await page.goto(notebookUrl)
      await page.getByRole('heading', {
        name: 'Enterprise renewal risk brief',
      }).waitFor()
      await waitForThemeStyles(page, theme)

      expect(await page.getByRole('main').count()).toBe(1)
      expect(await page.getByRole('region', { name: 'Report sections' }).count())
        .toBe(1)
      expect(await page.getByRole('textbox', { name: 'Edit Customer narrative' }).count())
        .toBe(1)
      expect(await page.getByRole('button', { name: 'Switch to dark theme' }).count())
        .toBe(theme === 'light' ? 1 : 0)
      expect(await page.getByRole('button', { name: 'Switch to light theme' }).count())
        .toBe(theme === 'dark' ? 1 : 0)

      const unnamedControls = await page.locator(
        'button, a[href], input, textarea, select, summary',
      ).evaluateAll((elements) => elements.flatMap((element) => {
        const html = element as HTMLElement
        const style = getComputedStyle(html)
        if (
          style.display === 'none'
          || style.visibility === 'hidden'
          || html.getClientRects().length === 0
        ) return []
        const label = [
          html.getAttribute('aria-label'),
          html.getAttribute('title'),
          html.innerText,
          html.id === ''
            ? ''
            : document.querySelector(`label[for="${CSS.escape(html.id)}"]`)?.textContent,
          html.closest('label')?.textContent,
        ].find((candidate) => typeof candidate === 'string' && candidate.trim() !== '') ?? ''
        return label.trim() === '' ? [html.outerHTML.slice(0, 160)] : []
      }))
      expect(unnamedControls).toEqual([])

      const contrast = await page.locator('.report-workspace').evaluate((root) => {
        const channel = (value: number) => {
          const normalized = value / 255
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4
        }
        const luminance = (value: string) => {
          const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []
          if (channels.length !== 3) throw new Error(`Unsupported color: ${value}`)
          return 0.2126 * channel(channels[0]!)
            + 0.7152 * channel(channels[1]!)
            + 0.0722 * channel(channels[2]!)
        }
        const ratio = (foreground: string, background: string) => {
          const lighter = Math.max(luminance(foreground), luminance(background))
          const darker = Math.min(luminance(foreground), luminance(background))
          return (lighter + 0.05) / (darker + 0.05)
        }
        const rootStyle = getComputedStyle(root)
        const titleStyle = getComputedStyle(root.querySelector('h1')!)
        return {
          text: ratio(rootStyle.color, rootStyle.backgroundColor),
          title: ratio(titleStyle.color, rootStyle.backgroundColor),
          scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        }
      })
      expect(contrast.text).toBeGreaterThanOrEqual(4.5)
      expect(contrast.title).toBeGreaterThanOrEqual(4.5)
      expect(contrast.scrollBehavior).toBe('auto')

      const repairButton = page.getByRole('button', { name: 'Repair', exact: true })
      await repairButton.focus()
      await repairButton.press('Enter')
      const dialog = page.getByRole('dialog', { name: 'Resolve this claim' })
      await dialog.waitFor()
      const dialogButtons = dialog.getByRole('button')
      const firstButton = dialogButtons.first()
      const lastButton = dialogButtons.last()
      expect(await firstButton.evaluate((element) => element === document.activeElement))
        .toBe(true)
      await firstButton.press('Shift+Tab')
      expect(await lastButton.evaluate((element) => element === document.activeElement))
        .toBe(true)
      await lastButton.press('Tab')
      expect(await firstButton.evaluate((element) => element === document.activeElement))
        .toBe(true)
      await page.keyboard.press('Escape')
      expect(await repairButton.evaluate((element) => element === document.activeElement))
        .toBe(true)

      await noOverflow(page)
      await page.close()
    }
  })

  it('retains exactly six reviewed responsive light/dark screenshots', async () => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]
    for (const theme of ['light', 'dark'] as const) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport })
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem(
            'struct-theme',
            selectedTheme === 'dark' ? 'struct-dark' : 'struct-light',
          )
        }, theme)
        await installApi(page)
        await page.goto(notebookUrl)
        await page.getByRole('heading', {
          name: 'Enterprise renewal risk brief',
        }).waitFor()
        await waitForThemeStyles(page, theme)
        await page.evaluate(() => {
          document.documentElement.style.setProperty('scroll-behavior', 'auto')
        })
        await noOverflow(page)
        const contrast = await page.locator('.report-workspace').evaluate((root) => ({
          background: getComputedStyle(root).backgroundColor,
          text: getComputedStyle(root).color,
          focus: getComputedStyle(
            root.querySelector<HTMLButtonElement>('.report-publish')!,
          ).color,
        }))
        expect(contrast.background).not.toBe('rgba(0, 0, 0, 0)')
        expect(contrast.text).not.toBe(contrast.background)
        await page.screenshot({
          path: path.join(
            screenshotRoot,
            `${viewport.width}x${viewport.height}-${theme}.png`,
          ),
          fullPage: false,
        })
        await page.close()
      }
    }
  })
})
