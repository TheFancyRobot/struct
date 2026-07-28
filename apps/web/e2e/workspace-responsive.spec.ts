/* eslint-disable no-unused-vars -- Imported Playwright types are used only by TypeScript. */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium, type Page } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'

const origin = 'http://127.0.0.1:4180'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

async function openWorkspace(page: Page, theme: 'struct-light' | 'struct-dark') {
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem('struct-theme', selectedTheme)
  }, theme)
  await page.route('**/api/projects', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [], nextCursor: null }),
  }))
  await page.goto(origin)
  await page.getByRole('heading', { name: 'Choose a project' }).waitFor()
}

beforeAll(async () => {
  web = await startAppServer(4180)
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('responsive workspace browser contract', () => {
  it('exposes creation actions with workspace-scoped source availability on desktop and mobile', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111'
    const project = { id: projectId, name: 'Alpha research', createdAt: 1, updatedAt: 2 }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.route('**/api/projects', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [project], nextCursor: null }),
    }))
    await page.route(`**/api/projects/${projectId}`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(project),
    }))
    await page.route(`**/api/projects/${projectId}/sources`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cursor: '0', items: [] }),
    }))

    await page.goto(origin)
    const navigation = page.getByRole('navigation', { name: 'Workspace navigation' })
    const addProject = navigation.getByRole('link', { name: 'Add project' })
    // Source registration is workspace-scoped (STEP-10-09 / BUG-0046): "Add source" is always
    // an enabled link to the global source library, never a project-gated disabled button.
    const addSource = navigation.getByRole('link', { name: 'Add source' })
    expect(await addProject.getAttribute('href')).toBe('/#project-create')
    expect(await addSource.getAttribute('href')).toBe('/sources#source-import-heading')
    expect(await navigation.getByRole('button', { name: 'Add source' }).count()).toBe(0)
    expect(await navigation.locator('#add-source-requirement').count()).toBe(0)
    expect((await addProject.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await addSource.boundingBox())!.height).toBeGreaterThanOrEqual(44)

    await page.goto(`${origin}/projects/${projectId}`)
    // The Add source link stays pointed at the global library even with a project open.
    expect(await addSource.getAttribute('href')).toBe('/sources#source-import-heading')

    await page.waitForFunction(
      ([storageKey, expectedProjectId]) => window.localStorage.getItem(storageKey) === expectedProjectId,
      ['struct:last-project-id', projectId],
    )
    await addProject.click()
    await page.waitForURL(`${origin}/#project-create`)
    const projectName = page.getByLabel('Project name')
    await projectName.waitFor()
    expect(await projectName.evaluate((element) => element === document.activeElement)).toBe(true)

    await page.goto(`${origin}/projects/${projectId}`)
    await page.setViewportSize({ width: 375, height: 844 })
    await page.getByRole('button', { name: 'Open workspace navigation' }).click()
    await addProject.waitFor()
    expect((await addProject.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await addSource.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.close()
  })

  it('filters projects and current-project documents while hiding recents in a project', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const projectId = '11111111-1111-4111-8111-111111111111'
    const otherProjectId = '22222222-2222-4222-8222-222222222222'
    const project = { id: projectId, name: 'Alpha research', createdAt: 1, updatedAt: 2 }
    const otherProject = { id: otherProjectId, name: 'Beta notebook', createdAt: 1, updatedAt: 1 }
    await page.addInitScript((id) => {
      window.localStorage.removeItem('struct:last-project-id')
      window.localStorage.setItem('struct:recent-project-ids', JSON.stringify([id]))
    }, projectId)
    await page.route('**/api/projects', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [project, otherProject], nextCursor: null }),
    }))
    await page.route(`**/api/projects/${projectId}`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(project),
    }))
    await page.route(`**/api/projects/${projectId}/sources`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cursor: '0',
        items: [
          {
            sourceId: '33333333-3333-4333-8333-333333333333',
            name: 'Market brief.md',
            kind: 'document',
            mediaType: 'text/markdown',
            latestVersionId: null,
            latestVersion: null,
            readiness: 'ready',
            updatedAt: 20,
            job: null,
          },
          {
            sourceId: '44444444-4444-4444-8444-444444444444',
            name: 'Metrics.csv',
            kind: 'dataset',
            mediaType: 'text/csv',
            latestVersionId: null,
            latestVersion: null,
            readiness: 'ready',
            updatedAt: 30,
            job: null,
          },
        ],
      }),
    }))

    await page.goto(origin)
    const navigation = page.getByRole('navigation', { name: 'Workspace navigation' })
    await navigation.getByRole('heading', { name: 'Recents' }).waitFor()
    await navigation.getByLabel('Search projects').fill('beta')
    const projectSection = navigation.getByRole('region', { name: 'Projects' })
    expect(await projectSection.getByRole('link', { name: 'Alpha research' }).count()).toBe(0)
    expect(await projectSection.getByRole('link', { name: 'Beta notebook' }).count()).toBe(1)

    await page.goto(`${origin}/projects/${projectId}`)
    expect(await navigation.getByRole('heading', { name: 'Recents' }).count()).toBe(0)
    await navigation.getByRole('link', { name: 'Market brief.md' }).waitFor()
    expect(await navigation.getByRole('link', { name: 'Metrics.csv' }).count()).toBe(0)
    await page.goto(`${origin}/projects/${projectId}/sources`)
    const currentLinks = navigation.locator('a[aria-current="page"]')
    expect(await currentLinks.count()).toBe(1)
    expect(await currentLinks.textContent()).toBe('Sources')
    await navigation.getByLabel('Search sources').fill('missing')
    expect(await navigation.getByRole('link', { name: 'Market brief.md' }).count()).toBe(0)
    await page.close()
  })

  it('keeps the focused project name input separated from its action', async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } })
    await openWorkspace(page, 'struct-light')

    const input = page.getByLabel('Project name')
    const action = page.getByRole('button', { name: 'Create project' })
    await input.focus()

    const [inputBox, actionBox] = await Promise.all([
      input.boundingBox(),
      action.boundingBox(),
    ])
    expect(inputBox).not.toBeNull()
    expect(actionBox).not.toBeNull()
    expect(actionBox!.y - (inputBox!.y + inputBox!.height)).toBeGreaterThanOrEqual(8)
    await page.close()
  })

  it('renders the center as one unframed workspace surface', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await openWorkspace(page, 'struct-light')

    expect(await page.getByText('Research workspace', { exact: true }).count()).toBe(0)
    const surface = await page.evaluate(() => {
      const main = document.querySelector('main')!
      const content = main.lastElementChild as HTMLElement
      const project = content.querySelector('section')!
      const mainBox = main.getBoundingClientRect()
      const contentBox = content.getBoundingClientRect()
      const projectStyle = getComputedStyle(project)
      return {
        contentInset: {
          x: contentBox.x - mainBox.x,
          y: contentBox.y - mainBox.y,
        },
        projectBorderWidth: projectStyle.borderWidth,
        projectBackground: projectStyle.backgroundColor,
      }
    })
    expect(surface.contentInset).toEqual({ x: 0, y: 0 })
    expect(surface.projectBorderWidth).toBe('0px')
    expect(surface.projectBackground).toBe('rgba(0, 0, 0, 0)')
    await page.close()
  })

  it('keeps one ordered, overflow-free shell at every target width and theme', async () => {
    for (const width of [375, 768, 1024, 1440]) {
      for (const theme of ['struct-light', 'struct-dark'] as const) {
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        await openWorkspace(page, theme)

        expect(await page.locator('nav[aria-label="Workspace navigation"]').count())
          .toBe(1)
        expect(await page.getByRole('main').count()).toBe(1)
        expect(await page.locator('aside[aria-labelledby="evidence-heading"]').count())
          .toBe(1)
        expect(await page.getByText('Grounded analysis').count()).toBe(0)
        expect(await page.locator('.brand, .breadcrumbs, .drawer').count()).toBe(0)
        expect(await page.locator('html').getAttribute('data-theme')).toBe(theme)
        expect(await page.locator('.app-shell').getAttribute('data-theme')).toBe(theme)

        const layout = await page.evaluate(() => ({
          viewport: window.innerWidth,
          html: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          undersizedControls: [...document.querySelectorAll<HTMLElement>(
            '.app-shell button:not([disabled]), .app-shell a[href]',
          )].filter((element) => {
            const { width: controlWidth, height: controlHeight } = element.getBoundingClientRect()
            return element.offsetParent !== null && (controlWidth < 44 || controlHeight < 44)
          }).map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim()),
        }))
        expect(layout.html).toBeLessThanOrEqual(layout.viewport)
        expect(layout.body).toBeLessThanOrEqual(layout.viewport)
        expect(layout.undersizedControls).toEqual([])
        await page.close()
      }
    }
  }, 60_000)

  it('moves focus into mobile sheets and restores it on Escape', async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } })
    await openWorkspace(page, 'struct-light')

    const navigationOpener = page.getByRole('button', { name: 'Open workspace navigation' })
    await navigationOpener.click()
    await page.getByRole('heading', { name: 'Workspace' }).waitFor()
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Workspace')
    await page.keyboard.press('Escape')
    expect(await navigationOpener.evaluate((element) => element === document.activeElement))
      .toBe(true)

    const evidenceOpener = page.getByRole('button', { name: 'Open evidence' })
    await evidenceOpener.click()
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Evidence')
    await page.keyboard.press('Escape')
    expect(await evidenceOpener.evaluate((element) => element === document.activeElement))
      .toBe(true)
    await page.close()
  })

  it('collapses and restores desktop panes independently', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await openWorkspace(page, 'struct-light')

    const visibleThemeControlCount = () => page
      .getByRole('button', { name: /Switch to (?:dark|light) theme/ })
      .evaluateAll((elements) => elements.filter((element) => {
        const bounds = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return bounds.width > 0 && bounds.height > 0
          && style.display !== 'none' && style.visibility !== 'hidden'
      }).length)

    expect(await visibleThemeControlCount()).toBe(1)
    await page.getByRole('button', { name: 'Collapse workspace navigation' }).click()
    const navigationOpener = page.getByRole('button', { name: 'Open workspace navigation' })
    await navigationOpener.waitFor()
    expect(await visibleThemeControlCount()).toBe(1)
    expect(await page.getByRole('complementary', { name: 'Evidence' }).isVisible()).toBe(true)
    await navigationOpener.click()
    expect(await page.getByRole('heading', { name: 'Workspace' }).evaluate(
      (element) => element === document.activeElement,
    )).toBe(true)
    expect(await visibleThemeControlCount()).toBe(1)

    await page.getByRole('button', { name: 'Collapse evidence' }).click()
    const evidenceOpener = page.getByRole('button', { name: 'Open evidence' })
    await evidenceOpener.waitFor()
    expect(await page.getByRole('navigation', { name: 'Workspace navigation' }).isVisible())
      .toBe(true)
    await evidenceOpener.click()
    expect(await page.getByRole('heading', { name: 'Evidence' }).evaluate(
      (element) => element === document.activeElement,
    )).toBe(true)
    await page.close()
  })
})
