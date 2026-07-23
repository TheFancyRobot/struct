import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chromium } from 'playwright'
import { startAppServer, stopAppServer } from './support/app-server'

const origin = 'http://127.0.0.1:4174'
const basePathOrigin = 'http://127.0.0.1:4179/struct'
const projectId = '5b0e8400-e29b-41d4-a716-446655440010'
const betaProjectId = '5b0e8400-e29b-41d4-a716-446655440011'

let browser: Awaited<ReturnType<typeof chromium.launch>>
let web: Awaited<ReturnType<typeof startAppServer>>
let basePathWeb: Awaited<ReturnType<typeof startAppServer>>

beforeAll(async () => {
  web = await startAppServer(4174)
  basePathWeb = await startAppServer(4179, { BASE_PATH: '/struct', BASE_URL: '/struct/' })
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
  await stopAppServer(web)
  await stopAppServer(basePathWeb)
})

describe('project lifecycle browser path', () => {
  it('keeps the home chooser in a loading state until the initial project list settles', async () => {
    const page = await browser.newPage()
    let releaseList!: () => void
    const listGate = new Promise<void>((resolve) => {
      releaseList = resolve
    })

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() !== 'GET') {
        throw new Error('create should not run in initial loading test')
      }
      await listGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextCursor: null }),
      })
    })

    await page.goto(origin)
    await page.getByText('Loading projects…').waitFor()
    expect(await page.getByRole('status').count()).toBeGreaterThan(0)
    expect(await page.getByText('Create your first project').count()).toBe(0)

    releaseList()
    await page.getByText('Create your first project to establish the workspace foundation.').waitFor()
    await page.close()
  })

  it('keeps the project switcher in a loading state until the initial project list settles', async () => {
    const page = await browser.newPage()
    let releaseList!: () => void
    const listGate = new Promise<void>((resolve) => {
      releaseList = resolve
    })

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() !== 'GET') {
        throw new Error('create should not run in project-route loading test')
      }
      await listGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: projectId, name: 'Café roadmap', createdAt: 1, updatedAt: 2 }],
          nextCursor: null,
        }),
      })
    })
    await page.route(`**/api/projects/${projectId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: projectId,
          name: 'Café roadmap',
          createdAt: 1,
          updatedAt: 2,
        }),
      })
    })

    await page.goto(`${origin}/projects/${projectId}`)
    await page.getByRole('heading', { level: 1, name: 'Café roadmap' }).waitFor()
    await page.getByText('Loading projects…').waitFor()
    expect(await page.getByRole('status').count()).toBeGreaterThan(0)
    expect(await page.getByText('Create your first project').count()).toBe(0)

    releaseList()
    await page.getByRole('link', { name: 'Café roadmap' }).waitFor()
    await page.close()
  })

  it('creates a project, lands on the canonical route, reloads, and stores only the project id', async () => {
    const page = await browser.newPage()
    let listCalls = 0
    let createCalls = 0
    let getCalls = 0

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() === 'GET') {
        listCalls += 1
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], nextCursor: null }),
        })
        return
      }
      createCalls += 1
      expect(route.request().headerValue('idempotency-key')).toBeTruthy()
      expect(JSON.parse(route.request().postData() ?? '{}')).toEqual({ name: 'Café roadmap' })
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: projectId,
          name: 'Café roadmap',
          createdAt: 1,
          updatedAt: 2,
        }),
      })
    })
    await page.route(`**/api/projects/${projectId}`, async (route) => {
      getCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: projectId,
          name: 'Café roadmap',
          createdAt: 1,
          updatedAt: 2,
        }),
      })
    })

    await page.goto(origin)
    await page.getByLabel('Project name').fill('Café roadmap')
    await page.getByRole('button', { name: 'Create project' }).click()

    await page.waitForURL(`**/projects/${projectId}`)
    await page.getByRole('heading', { level: 1, name: 'Café roadmap' }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(projectId)

    await page.reload()
    await page.getByRole('heading', { level: 1, name: 'Café roadmap' }).waitFor()

    expect(createCalls).toBe(1)
    expect(listCalls).toBeGreaterThanOrEqual(1)
    expect(getCalls).toBeGreaterThanOrEqual(1)
    await page.close()
  })

  it('reuses one create idempotency key across repeated submits, retries, and reloads until success', async () => {
    const page = await browser.newPage()
    const createKeys: string[] = []
    let allowSuccess = false

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], nextCursor: null }),
        })
        return
      }

      createKeys.push(await route.request().headerValue('idempotency-key') ?? '')
      if (!allowSuccess) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'ProjectCreateUnavailable' }),
        })
        return
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: projectId,
          name: 'Retry roadmap',
          createdAt: 1,
          updatedAt: 2,
        }),
      })
    })
    await page.route(`**/api/projects/${projectId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: projectId,
          name: 'Retry roadmap',
          createdAt: 1,
          updatedAt: 2,
        }),
      })
    })

    await page.goto(origin)
    await page.getByLabel('Project name').fill('Retry roadmap')
    await page.evaluate(() => {
      const form = document.querySelector('form')
      form?.requestSubmit()
      form?.requestSubmit()
    })
    await page.getByText('The project could not be created. Try again.').waitFor()

    await page.getByRole('button', { name: 'Create project' }).click()
    await page.getByText('The project could not be created. Try again.').waitFor()

    await page.reload()
    if ((await page.getByLabel('Project name').inputValue()) !== 'Retry roadmap') {
      await page.getByLabel('Project name').fill('Retry roadmap')
    }

    allowSuccess = true
    await page.getByRole('button', { name: 'Create project' }).click()

    await page.waitForURL(`**/projects/${projectId}`)
    expect(createKeys.length).toBeGreaterThanOrEqual(3)
    expect(new Set(createKeys)).toEqual(new Set([createKeys[0]!]))
    await page.close()
  })

  it('keeps a cached last project during read and list outages and offers a retry path', async () => {
    const page = await browser.newPage()
    let recover = false

    await page.addInitScript((cachedProjectId) => {
      window.localStorage.setItem('struct:last-project-id', cachedProjectId)
    }, projectId)

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() !== 'GET') {
        throw new Error('create should not run in outage retry test')
      }
      await route.fulfill(recover
        ? {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [{ id: projectId, name: 'Café roadmap', createdAt: 1, updatedAt: 2 }],
              nextCursor: null,
            }),
          }
        : {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'ProjectListUnavailable' }),
          })
    })
    await page.route(`**/api/projects/${projectId}`, async (route) => {
      await route.fulfill(recover
        ? {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: projectId, name: 'Café roadmap', createdAt: 1, updatedAt: 2 }),
          }
        : {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'ProjectReadUnavailable' }),
          })
    })

    await page.goto(origin)
    await page.getByRole('button', { name: 'Retry opening last project' }).waitFor()
    await page.getByRole('button', { name: 'Retry loading projects' }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(projectId)

    recover = true
    await page.getByRole('button', { name: 'Retry opening last project' }).click()
    await page.waitForURL(`**/projects/${projectId}`)
    await page.getByRole('heading', { level: 1, name: 'Café roadmap' }).waitFor()
    await page.close()
  })

  it('renders a retryable unavailable view for direct project reads instead of treating them as missing', async () => {
    const page = await browser.newPage()
    let recover = false

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() !== 'GET') {
        throw new Error('create should not run in read retry test')
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: projectId, name: 'Café roadmap', createdAt: 1, updatedAt: 2 }],
          nextCursor: null,
        }),
      })
    })
    await page.route(`**/api/projects/${projectId}`, async (route) => {
      await route.fulfill(recover
        ? {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: projectId, name: 'Café roadmap', createdAt: 1, updatedAt: 2 }),
          }
        : {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'ProjectReadUnavailable' }),
          })
    })

    await page.goto(`${origin}/projects/${projectId}`)
    await page.getByRole('button', { name: 'Retry opening project' }).waitFor()
    expect(await page.getByText('This project is no longer available.').count()).toBe(0)
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBeNull()

    recover = true
    await page.getByRole('button', { name: 'Retry opening project' }).click()
    await page.getByRole('heading', { level: 1, name: 'Café roadmap' }).waitFor()
    await page.close()
  })

  it('updates the cached last project only after successful route loads and preserves the last known good id during outages', async () => {
    const page = await browser.newPage()
    const alphaProject = { id: projectId, name: 'Alpha roadmap', createdAt: 1, updatedAt: 2 }
    const betaProject = { id: betaProjectId, name: 'Beta archive', createdAt: 1, updatedAt: 2 }
    let alphaAvailable = true

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() !== 'GET') {
        throw new Error('create should not run in cache transition test')
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [alphaProject, betaProject], nextCursor: null }),
      })
    })
    await page.route(`**/api/projects/${projectId}`, (route) =>
      route.fulfill(alphaAvailable
        ? {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(alphaProject),
          }
        : {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'ProjectReadUnavailable' }),
          }))
    await page.route(`**/api/projects/${betaProjectId}`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(betaProject),
    }))

    await page.goto(`${origin}/projects/${projectId}`)
    await page.getByRole('heading', { level: 2, name: alphaProject.name }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(alphaProject.id)

    await page.getByRole('link', { name: betaProject.name }).click()
    await page.waitForURL(`**/projects/${betaProjectId}`)
    await page.getByRole('heading', { level: 2, name: betaProject.name }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(betaProject.id)

    await page.goBack()
    await page.waitForURL(`**/projects/${projectId}`)
    await page.getByRole('heading', { level: 2, name: alphaProject.name }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(alphaProject.id)

    await page.goForward()
    await page.waitForURL(`**/projects/${betaProjectId}`)
    await page.getByRole('heading', { level: 2, name: betaProject.name }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(betaProject.id)

    alphaAvailable = false
    await page.goBack()
    await page.waitForURL(`**/projects/${projectId}`)
    await page.getByRole('button', { name: 'Retry opening project' }).waitFor()
    expect(await page.getByText('This project is no longer available.').count()).toBe(0)
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(betaProject.id)

    alphaAvailable = true
    await page.getByRole('button', { name: 'Retry opening project' }).click()
    await page.getByRole('heading', { level: 2, name: alphaProject.name }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(alphaProject.id)
    await page.close()
  })

  it('preserves an unrelated cached last project when a direct project route is not found', async () => {
    const page = await browser.newPage()
    const alphaProject = { id: projectId, name: 'Alpha roadmap', createdAt: 1, updatedAt: 2 }

    await page.addInitScript((cachedProjectId) => {
      window.localStorage.setItem('struct:last-project-id', cachedProjectId)
    }, alphaProject.id)

    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      if (route.request().method() !== 'GET') {
        throw new Error('create should not run in not-found cache preservation test')
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [alphaProject], nextCursor: null }),
      })
    })
    await page.route(`**/api/projects/${betaProjectId}`, (route) => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'ProjectNotFound' }),
    }))

    await page.goto(`${origin}/projects/${betaProjectId}`)
    await page.getByText('This project is no longer available.').waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBe(alphaProject.id)
    await page.close()
  })

  it('treats malformed project route ids as not found without requesting the API', async () => {
    const page = await browser.newPage()
    let malformedRouteRequests = 0

    await page.route('**/api/projects', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null }),
    }))
    await page.route('**/api/projects/not-a-uuid', async (route) => {
      malformedRouteRequests += 1
      await route.fulfill({ status: 500 })
    })

    await page.goto(`${origin}/projects/not-a-uuid`)
    await page.getByText('This project is no longer available.').waitFor()
    expect(malformedRouteRequests).toBe(0)
    await page.close()
  })

  it('clears malformed cached project ids without blocking the chooser', async () => {
    const page = await browser.newPage()
    let malformedCacheRequests = 0

    await page.addInitScript(() => {
      window.localStorage.setItem('struct:last-project-id', 'not-a-uuid')
    })
    await page.route('**/api/projects', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], nextCursor: null }),
    }))
    await page.route('**/api/projects/not-a-uuid', async (route) => {
      malformedCacheRequests += 1
      await route.fulfill({ status: 500 })
    })

    await page.goto(origin)
    await page.getByText('Create your first project to establish the workspace foundation.').waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBeNull()
    expect(malformedCacheRequests).toBe(0)
    await page.close()
  })

  it('clears stale cached ids and serves the canonical route from a BASE_PATH deployment', async () => {
    const page = await browser.newPage()
    await page.addInitScript((staleProjectId) => {
      window.localStorage.setItem('struct:last-project-id', staleProjectId)
    }, '5b0e8400-e29b-41d4-a716-446655440099')

    await page.route('**/api/projects/5b0e8400-e29b-41d4-a716-446655440099', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'ProjectNotFound' }),
      }))
    await page.route('**/api/projects', async (route) => {
      if (!new URL(route.request().url()).pathname.endsWith('/api/projects')) {
        await route.fallback()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ id: projectId, name: 'Café roadmap', createdAt: 1, updatedAt: 2 }], nextCursor: null }),
      })
    })
    await page.route(`**/api/projects/${projectId}`, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: projectId, name: 'Café roadmap', createdAt: 1, updatedAt: 2 }),
    }))

    await page.goto(basePathOrigin)
    await page.getByRole('heading', { name: 'Choose a project' }).waitFor()
    expect(await page.evaluate(() => window.localStorage.getItem('struct:last-project-id')))
      .toBeNull()

    await page.getByRole('link', { name: 'Café roadmap' }).click()
    await page.waitForURL(`**/struct/projects/${projectId}`)
    await page.getByRole('heading', { level: 1, name: 'Café roadmap' }).waitFor()
    await page.close()
  })
})
