import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'

const projectId = '750e8400-e29b-41d4-a716-446655440001'
const threadId = '750e8400-e29b-41d4-a716-446655440002'
const runId = '750e8400-e29b-41d4-a716-446655440003'
const citationId = '750e8400-e29b-41d4-a716-446655440004'
const jobId = '750e8400-e29b-41d4-a716-446655440005'
const eventId = '750e8400-e29b-41d4-a716-446655440006'
const sourceVersionId = '750e8400-e29b-41d4-a716-446655440007'
const origin = 'http://127.0.0.1:4173'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: ReturnType<typeof Bun.spawn>

beforeAll(async () => {
  web = Bun.spawn(
    ['bun', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'],
    {
      cwd: new URL('..', import.meta.url).pathname,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  )

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {
      await Bun.sleep(100)
    }
  }
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  web?.kill()
  await web?.exited
})

describe('walking-skeleton browser path', () => {
  it('opens a completed answer citation with the keyboard', async () => {
    const page = await browser.newPage()
    await page.route(`**/api/projects/${projectId}/runs/${runId}/events*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
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
              answer: 'The source confirms the walking slice.',
              citations: [{
                id: citationId,
                sourceVersionId,
                locator: 'lines 1-1',
              }],
            },
          })}`,
          '',
          '',
        ].join('\n'),
      }))
    await page.route(
      `**/api/projects/${projectId}/research/${threadId}/citation/${citationId}`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: citationId,
            runId,
            sourceVersionId,
            sourceName: 'walking-skeleton.txt',
            sourceVersion: 1,
            locator: 'lines 1-1',
            contextLines: [{
              lineNumber: 1,
              segments: [{
                text: 'The source confirms the walking slice.',
                cited: true,
              }],
            }],
            startLine: 1,
            endLine: 1,
          }),
        }),
    )

    await page.goto(
      `${origin}/projects/${projectId}/research/${threadId}/runs/${runId}`,
    )
    await page.getByText('The source confirms the walking slice.').waitFor()

    const citationLink = page.getByRole('link', { name: 'Open citation 1' })
    await citationLink.focus()
    expect(await citationLink.evaluate((element) => element === document.activeElement))
      .toBe(true)
    await page.keyboard.press('Enter')

    await page.waitForURL(`**/citation/${citationId}`)
    expect(await page.getByRole('heading', { name: 'walking-skeleton.txt' }).textContent())
      .toBe('walking-skeleton.txt')
    expect(await page.locator('span.bg-warning\\/40').textContent())
      .toBe('The source confirms the walking slice.')

    await page.close()
  })
})
