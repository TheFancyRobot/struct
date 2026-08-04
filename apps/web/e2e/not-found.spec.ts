import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'

const origin = 'http://127.0.0.1:4204/struct'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>

beforeAll(async () => {
  web = await startAppServer(4204, { BASE_PATH: '/struct', BASE_URL: '/struct/' })
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
})

describe('unknown workspace route', () => {
  it('renders an accessible recovery state with the correct title', async () => {
    const page = await browser.newPage()
    await page.goto(`${origin}/does-not-exist`)

    await page.getByRole('heading', { name: 'Page not found' }).waitFor()
    expect(await page.title()).toBe('Page Not Found — Struct')
    expect(await page.getByRole('navigation', { name: 'Not found recovery' })
      .getByRole('link', { name: 'Back to projects' }).getAttribute('href'))
      .toBe('/struct/')
    expect(await page.getByRole('link', { name: 'Browse sources' }).getAttribute('href'))
      .toBe('/struct/sources')

    await page.close()
  })
})
