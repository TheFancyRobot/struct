import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'
import { waitForThemeStyles } from './support/theme-readiness'

const origin = 'http://127.0.0.1:4186/struct'
const projectId = 'a50e8400-e29b-41d4-a716-446655440001'
const sourceId = 'a50e8400-e29b-41d4-a716-446655440002'
const jobId = 'a50e8400-e29b-41d4-a716-446655440003'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

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
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('workspace accessibility browser contract', () => {
  it('keeps mobile source failures visible, operable, and focus-safe', async () => {
    const page = await browser.newPage({
      viewport: { width: 375, height: 812 },
      reducedMotion: 'reduce',
    })
    await installApi(page)
    await page.goto(`${origin}/projects/${projectId}`)
    await page.getByRole('heading', { name: 'Accessible project' }).waitFor()
    await waitForThemeStyles(page, 'light')

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
})
