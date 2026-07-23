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

describe('workspace shell browser contract', () => {
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

        const overflow = await page.evaluate(() => ({
          viewport: window.innerWidth,
          html: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }))
        expect(overflow.html).toBeLessThanOrEqual(overflow.viewport)
        expect(overflow.body).toBeLessThanOrEqual(overflow.viewport)
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

    await page.getByRole('button', { name: 'Collapse workspace navigation' }).click()
    const navigationOpener = page.getByRole('button', { name: 'Open workspace navigation' })
    await navigationOpener.waitFor()
    expect(await page.getByRole('complementary', { name: 'Evidence' }).isVisible()).toBe(true)
    await navigationOpener.click()
    expect(await page.getByRole('heading', { name: 'Workspace' }).evaluate(
      (element) => element === document.activeElement,
    )).toBe(true)

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
