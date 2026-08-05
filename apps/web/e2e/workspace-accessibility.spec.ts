import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'
import { waitForThemeStyles } from './support/theme-readiness'

const origin = 'http://127.0.0.1:4186/struct'
const projectId = 'a50e8400-e29b-41d4-a716-446655440001'
const sourceId = 'a50e8400-e29b-41d4-a716-446655440002'
const jobId = 'a50e8400-e29b-41d4-a716-446655440003'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>
let page: import('playwright').Page | undefined

async function installApi(page: import('playwright').Page) {
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname.replace(/^\/struct/, '')
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
    if (pathname === '/api/projects') {
      return json({
        items: [{ id: projectId, name: 'Accessible project', createdAt: 1, updatedAt: 2 }],
        nextCursor: null,
      })
    }
    if (pathname === `/api/projects/${projectId}`) {
      return json({ id: projectId, name: 'Accessible project', createdAt: 1, updatedAt: 2 })
    }
    if (pathname === `/api/projects/${projectId}/sources`) {
      return json({
        cursor: '0',
        items: [{
          sourceId,
          name: 'renewals.md',
          kind: 'document',
          mediaType: 'text/markdown',
          latestVersionId: null,
          latestVersion: null,
          readiness: 'failed',
          updatedAt: 1,
          job: {
            id: jobId,
            status: 'failed',
            attempts: 1,
            maxAttempts: 3,
            updatedAt: 1,
          },
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
    if (pathname === `/api/projects/${projectId}/research`) {
      return json({ items: [] })
    }
    return route.fulfill({ status: 404, body: '' })
  })
}

beforeAll(async () => {
  web = await startAppServer(4186, { BASE_PATH: '/struct', BASE_URL: '/struct/' })
  browser = await chromium.launch({ headless: true, timeout: 15_000 })
})

afterAll(async () => {
  await page?.close()
  await browser?.close()
  await stopAppServer(web)
})

describe('workspace accessibility browser contract', () => {
  it('keeps mobile source failures visible, operable, and focus-safe', async () => {
    page = await browser.newPage({
      viewport: { width: 375, height: 812 },
      reducedMotion: 'reduce',
    })
    await installApi(page)
    await page.goto(`${origin}/projects/${projectId}`)
    await page.getByRole('heading', { name: 'Accessible project' }).waitFor()
    await waitForThemeStyles(page, 'light')

    // BUG-0113: the visually hidden link remains in the mobile accessibility
    // audit, so its focused hit area must meet the same 44px baseline as the
    // visible controls. Its main-content destination must stay unchanged.
    const skipLink = page.getByRole('link', { name: 'Skip to main content' })
    await skipLink.focus()
    const skipLinkBox = await skipLink.boundingBox()
    expect(skipLinkBox).not.toBeNull()
    expect(skipLinkBox!.width).toBeGreaterThanOrEqual(44)
    expect(skipLinkBox!.height).toBeGreaterThanOrEqual(44)
    expect(await skipLink.getAttribute('href')).toBe('#workspace-main')
    await page.locator('#workspace-main').focus()

    const activity = page.getByRole('button', { name: /Source activity/ })
    const composer = page.getByRole('textbox', { name: 'Ask your sources' })
    await expect(await activity.innerText()).toContain('1 import needs attention')
    expect(await activity.boundingBox()).not.toBeNull()
    expect((await activity.boundingBox())!.y + (await activity.boundingBox())!.height)
      .toBeLessThanOrEqual((await composer.boundingBox())!.y)

    await activity.click()
    const progress = page.getByRole('dialog', { name: 'Source progress' })
    await progress.waitFor()
    expect(await progress.getByText('failed', { exact: true }).count()).toBe(1)
    expect(await progress.evaluate((element) =>
      element === document.activeElement || element.contains(document.activeElement)))
      .toBe(true)
    await page.keyboard.press('Escape')
    expect(await activity.evaluate((element) => element === document.activeElement))
      .toBe(true)

    await page.setViewportSize({ width: 320, height: 640 })
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '125%'
    })
    const audit = await page.evaluate(() => {
      const visible = (element: HTMLElement) => {
        const style = getComputedStyle(element)
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && element.getClientRects().length > 0
      }
      const unnamed = [...document.querySelectorAll<HTMLElement>(
        'button, a[href], input, textarea, select, summary',
      )].filter(visible).filter((element) => {
        const label = [
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.innerText,
          element.id === ''
            ? ''
            : document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent,
          element.closest('label')?.textContent,
        ].find((candidate) => typeof candidate === 'string' && candidate.trim() !== '')
        return label === undefined
      }).map((element) => element.outerHTML.slice(0, 160))
      const undersized = [...document.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href]',
      )].filter(visible).filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      }).map((element) => element.getAttribute('aria-label') ?? element.innerText.trim())
      return {
        htmlWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        unnamed,
        undersized,
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        transitionDuration: getComputedStyle(
          document.querySelector<HTMLElement>('aside[aria-labelledby="evidence-heading"]')!,
        ).transitionDuration,
      }
    })
    expect(audit.htmlWidth).toBeLessThanOrEqual(audit.viewportWidth)
    expect(audit.unnamed).toEqual([])
    expect(audit.undersized).toEqual([])
    expect(audit.scrollBehavior).toBe('auto')
    expect(Number.parseFloat(audit.transitionDuration)).toBeLessThanOrEqual(0.01)

    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await waitForThemeStyles(page, 'dark')
    await page.reload()
    await page.getByRole('heading', { name: 'Accessible project' }).waitFor()
    await waitForThemeStyles(page, 'dark')
    await page.close()
  })

  it('captures workspace dashboard screenshots and brand contrast in both themes', async () => {
    const screenshotRoot = path.resolve(
      new URL('../../..', import.meta.url).pathname,
      'docs/demos/workspace-brand',
    )
    await mkdir(screenshotRoot, { recursive: true })
    for (const theme of ['light', 'dark'] as const) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      })
      await page.addInitScript((selected) => {
        window.localStorage.setItem(
          'struct-theme',
          selected === 'dark' ? 'struct-dark' : 'struct-light',
        )
      }, theme)
      await installApi(page)
      await page.goto(`${origin}/projects/${projectId}`)
      await page.getByRole('heading', { name: 'Accessible project' }).waitFor()
      await waitForThemeStyles(page, theme)

      // Brand lockup sits in the top-left corner of the workspace navigation.
      const lockup = page.getByLabel('Workspace navigation', { exact: true })
        .getByRole('img', { name: 'Struct' })
      await lockup.waitFor({ state: 'visible' })
      const box = await lockup.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeLessThan(120)
      expect(box!.y).toBeLessThan(120)

      // Brand readability: workspace text on its surface meets AA contrast.
      const contrast = await page.locator('.app-shell').evaluate((root) => {
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
        const style = getComputedStyle(root)
        return ratio(style.color, style.backgroundColor)
      })
      expect(contrast).toBeGreaterThanOrEqual(4.5)

      await page.screenshot({
        path: path.join(screenshotRoot, `workspace-${theme}.png`),
        fullPage: false,
      })
      await page.close()
    }
  })
})
