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
    // The desktop-pane regression later reloads this page with a 503 response.
    // Keep this setup response out of Chromium's HTTP cache so that reload
    // reliably exercises the unavailable-projects layout instead of restoring
    // a stale successful list.
    headers: { 'cache-control': 'no-store' },
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
    await addSource.click()
    await page.waitForURL(`${origin}/sources#source-import-heading`)
    const sourceImportHeading = page.getByRole('heading', { name: 'Add sources' })
    await sourceImportHeading.waitFor()
    await page.waitForFunction(() => document.activeElement?.id === 'source-import-heading')
    expect(await sourceImportHeading.evaluate((element) => element === document.activeElement)).toBe(true)

    // BUG-0071: repeating the current-route action must refocus the import
    // target rather than leaving focus on the activating navigation link.
    await addSource.click()
    await page.waitForFunction(() => document.activeElement?.id === 'source-import-heading')
    expect(await sourceImportHeading.evaluate((element) => element === document.activeElement)).toBe(true)

    await page.goto(`${origin}/projects/${projectId}`)
    await page.setViewportSize({ width: 375, height: 844 })
    await page.getByRole('button', { name: 'Open workspace navigation' }).click()
    await addProject.waitFor()
    expect((await addProject.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await addSource.boundingBox())!.height).toBeGreaterThanOrEqual(44)

    // BUG-0095: the top-bar switch is covered by the mobile sheet backdrop, so
    // the drawer itself must expose a working global theme action.
    const navigationSheet = page.getByRole('dialog', { name: 'Workspace navigation' })
    const drawerThemeToggle = navigationSheet.getByRole('button', { name: 'Switch to dark theme' })
    expect(await drawerThemeToggle.count()).toBe(1)
    await drawerThemeToggle.click()
    expect(await page.locator('html').getAttribute('data-theme')).toBe('struct-dark')

    // BUG-0071: ordinary mobile activation closes the sheet before the
    // deferred focus is moved to the import heading.
    await addSource.click()
    await page.waitForURL(`${origin}/sources#source-import-heading`)
    await sourceImportHeading.waitFor()
    await page.waitForFunction(() => document.activeElement?.id === 'source-import-heading')
    expect(await navigationSheet.count()).toBe(0)

    // Opening the sheet again and repeating the same-route action must still
    // close the sheet before returning focus to the target.
    await page.getByRole('button', { name: 'Open workspace navigation' }).click()
    const mobileAddSource = page
      .getByRole('dialog', { name: 'Workspace navigation' })
      .getByRole('link', { name: 'Add source' })
    await mobileAddSource.click()
    await page.waitForFunction(() => document.activeElement?.id === 'source-import-heading')
    expect(await navigationSheet.count()).toBe(0)
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
    await navigation.getByRole('button', { name: 'Open project search' }).click()
    const projectSearch = navigation.getByLabel('Search projects')
    await projectSearch.fill('beta')
    expect(await projectSearch.evaluate((element) => element === document.activeElement)).toBe(true)
    const projectSection = navigation.getByRole('region', { name: 'Projects' })
    expect(await projectSection.getByRole('link', { name: 'Alpha research' }).count()).toBe(0)
    expect(await projectSection.getByRole('link', { name: 'Beta notebook' }).count()).toBe(1)
    // BUG-0078: project search has one scope; it must not leave a
    // nonmatching recently visited project visible above its filtered list.
    expect(await navigation.getByRole('heading', { name: 'Recents' }).count()).toBe(0)
    expect(await navigation.getByRole('link', { name: 'Alpha research' }).count()).toBe(0)

    await page.goto(`${origin}/projects/${projectId}`)
    expect(await navigation.getByRole('heading', { name: 'Recents' }).count()).toBe(0)
    await navigation.getByRole('link', { name: 'Market brief.md' }).waitFor()
    expect(await navigation.getByRole('link', { name: 'Metrics.csv' }).count()).toBe(0)
    await page.goto(`${origin}/projects/${projectId}/sources`)
    const currentLinks = navigation.locator('a[aria-current="page"]')
    expect(await currentLinks.count()).toBe(1)
    expect(await currentLinks.textContent()).toBe('Sources')
    await navigation.getByRole('button', { name: 'Open source search' }).click()
    const sourceSearch = navigation.getByLabel('Search sources')
    await sourceSearch.fill('missing')
    expect(await navigation.getByRole('link', { name: 'Market brief.md' }).count()).toBe(0)
    await sourceSearch.press('Escape')
    expect(await navigation.getByLabel('Search sources').count()).toBe(0)
    expect(await navigation.getByRole('link', { name: 'Market brief.md' }).count()).toBe(1)
    await page.close()
  })

  it('keeps the project name input at the mobile touch-target baseline and separated from its action', async () => {
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
    expect(inputBox!.height).toBeGreaterThanOrEqual(44)
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

  // BUG-0067: mobile sheets must isolate keyboard focus. The open sheet is a
  // dialog (role/aria-modal), the background is inert, and Tab/Shift+Tab wrap
  // inside the sheet so focus cannot reach the underlying top bar or content.
  it('isolates keyboard focus inside mobile sheets with dialog semantics and an inert background', async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } })
    await openWorkspace(page, 'struct-light')

    const main = page.getByRole('main')
    const evidenceAside = page.locator('aside[aria-labelledby="evidence-heading"]')

    const navigationOpener = page.getByRole('button', { name: 'Open workspace navigation' })
    await navigationOpener.click()
    const navigationDialog = page.getByRole('dialog', { name: 'Workspace navigation' })
    await navigationDialog.waitFor()
    expect(await navigationDialog.getAttribute('aria-modal')).toBe('true')
    expect(await navigationDialog.getAttribute('inert')).toBeNull()
    expect(await main.getAttribute('inert')).not.toBeNull()
    expect(await evidenceAside.getAttribute('inert')).not.toBeNull()
    const navigationFocusables = await navigationDialog.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.getClientRects().length > 0).length)
    expect(navigationFocusables).toBeGreaterThan(0)
    await navigationDialog.evaluate((element) => {
      const focusable = [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.getClientRects().length > 0)
      focusable.at(-1)?.focus()
    })
    await page.keyboard.press('Tab')
    expect(await navigationDialog.evaluate((element) => {
      const first = [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].find((node) => node.getClientRects().length > 0)
      return document.activeElement === first
    })).toBe(true)
    await page.keyboard.press('Shift+Tab')
    expect(await navigationDialog.evaluate((element) => {
      const focusable = [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.getClientRects().length > 0)
      return document.activeElement === focusable.at(-1)
    })).toBe(true)
    await page.keyboard.press('Escape')
    expect(await navigationOpener.evaluate((element) => element === document.activeElement))
      .toBe(true)

    const evidenceOpener = page.getByRole('button', { name: 'Open evidence' })
    await evidenceOpener.click()
    const evidenceDialog = page.getByRole('dialog', { name: 'Evidence' })
    await evidenceDialog.waitFor()
    expect(await evidenceDialog.getAttribute('aria-modal')).toBe('true')
    expect(await evidenceDialog.getAttribute('inert')).toBeNull()
    expect(await main.getAttribute('inert')).not.toBeNull()
    const evidenceFocusables = await evidenceDialog.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.getClientRects().length > 0).length)
    expect(evidenceFocusables).toBeGreaterThan(0)
    await evidenceDialog.evaluate((element) => {
      const focusable = [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.getClientRects().length > 0)
      focusable.at(-1)?.focus()
    })
    await page.keyboard.press('Tab')
    expect(await evidenceDialog.evaluate((element) => {
      const first = [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].find((node) => node.getClientRects().length > 0)
      return document.activeElement === first
    })).toBe(true)
    await page.keyboard.press('Shift+Tab')
    expect(await evidenceDialog.evaluate((element) => {
      const focusable = [...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.getClientRects().length > 0)
      return document.activeElement === focusable.at(-1)
    })).toBe(true)
    await page.keyboard.press('Escape')
    expect(await evidenceOpener.evaluate((element) => element === document.activeElement))
      .toBe(true)
    await page.close()
  })

  // BUG-0067 follow-up: SHEET_FOCUSABLE_SELECTOR excluded disabled buttons but
  // not disabled input/select/textarea, so a disabled form control at a sheet
  // boundary became the trap's endpoint. The browser skips disabled controls in
  // the tab order, so the trap's wrap guard (active === last/first) never matched
  // and the trap stopped intercepting Tab/Shift+Tab at that boundary, deferring to
  // the native tab order instead of managing focus itself.
  it('treats disabled input/select/textarea as non-endpoints of the sheet focus trap', async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } })
    await openWorkspace(page, 'struct-light')

    const navigationOpener = page.getByRole('button', { name: 'Open workspace navigation' })
    await navigationOpener.click()
    const navigationDialog = page.getByRole('dialog', { name: 'Workspace navigation' })
    await navigationDialog.waitFor()

    await navigationDialog.evaluate((root) => {
      const disabled = (tag: string, label: string) => {
        const el = document.createElement(tag)
        el.setAttribute('aria-label', label)
        el.setAttribute('disabled', '')
        el.style.display = 'block'
        return el
      }
      const enabled = (label: string) => {
        const el = document.createElement('button')
        el.setAttribute('type', 'button')
        el.setAttribute('aria-label', label)
        el.style.display = 'block'
        return el
      }
      const head = document.createElement('div')
      head.append(
        disabled('input', 'disabled-lead-input'),
        disabled('select', 'disabled-lead-select'),
        disabled('textarea', 'disabled-lead-textarea'),
        enabled('trap-marker-first'),
      )
      root.prepend(head)
      const tail = document.createElement('div')
      tail.append(
        enabled('trap-marker-last'),
        disabled('input', 'disabled-trail-input'),
        disabled('select', 'disabled-trail-select'),
        disabled('textarea', 'disabled-trail-textarea'),
      )
      root.append(tail)
    })

    const preventDefaultOn = async (key: 'Tab' | 'Shift+Tab') => {
      await page.evaluate(() => {
        (window as any).__tabPrevented = null
        const listener = (event: KeyboardEvent) => {
          // Playwright fires a Shift keydown before the Tab keydown for
          // Shift+Tab; only record the Tab keydown itself.
          if (event.key === 'Tab') (window as any).__tabPrevented = event.defaultPrevented
        }
        window.addEventListener('keydown', listener)
        ;(window as any).__removeTabListener = () => window.removeEventListener('keydown', listener)
      })
      await page.keyboard.press(key)
      return page.evaluate(() => {
        ;(window as any).__removeTabListener?.()
        return (window as any).__tabPrevented as boolean | null
      })
    }

    // Forward Tab at the real last focusable is intercepted: the trailing
    // disabled controls must not be treated as the boundary.
    await navigationDialog.getByRole('button', { name: 'trap-marker-last' }).focus()
    expect(await preventDefaultOn('Tab')).toBe(true)

    // Backward Shift+Tab at the real first focusable is intercepted: the leading
    // disabled controls must not be treated as the boundary.
    await navigationDialog.getByRole('button', { name: 'trap-marker-first' }).focus()
    expect(await preventDefaultOn('Shift+Tab')).toBe(true)

    await page.keyboard.press('Escape')
    expect(await navigationOpener.evaluate((element) => element === document.activeElement))
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

    await page.unroute('**/api/projects')
    await page.route('**/api/projects', (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify({ error: 'ProjectListUnavailable' }),
    }))
    const unavailableProjectsResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('/api/projects') && response.status() === 503)
    await page.reload()
    await unavailableProjectsResponse
    const projectAlert = page.getByRole('alert').filter({
      hasText: 'Projects could not be loaded. Try again.',
    })
    await projectAlert.waitFor()

    await page.getByRole('button', { name: 'Collapse workspace navigation' }).click()
    const navigationOpener = page.getByRole('button', { name: 'Open workspace navigation' })
    await navigationOpener.waitFor()
    expect(await visibleThemeControlCount()).toBe(1)
    const themeBounds = await page
      .locator('button[aria-label="Switch to dark theme"]:visible')
      .boundingBox()
    const alertBounds = await projectAlert.boundingBox()
    expect(themeBounds).not.toBeNull()
    expect(alertBounds).not.toBeNull()
    expect(themeBounds!.y + themeBounds!.height).toBeLessThanOrEqual(alertBounds!.y)
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
