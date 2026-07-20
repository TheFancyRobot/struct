import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const token = 'http-boundary-test-token'
const workspaceId = '910e8400-e29b-41d4-a716-446655440000'
const guessedProjectId = '910e8400-e29b-41d4-a716-446655440099'
const root = mkdtempSync(`${tmpdir()}/struct-api-auth-`)
let origin = ''
let child: ReturnType<typeof Bun.spawn> | undefined

const availablePort = (): Promise<number> => new Promise((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      reject(new Error('Could not allocate an API auth test port'))
      return
    }
    server.close((error) => error ? reject(error) : resolvePort(address.port))
  })
})

beforeAll(async () => {
  const port = await availablePort()
  origin = `http://127.0.0.1:${port}`
  child = Bun.spawn(['bun', resolve(import.meta.dirname, 'main.ts')], {
    env: {
      ...process.env,
      API_PORT: String(port),
      API_AUTH_TOKEN: token,
      API_WORKSPACE_ID: workspaceId,
      DATABASE_URL: 'postgres://struct:struct@127.0.0.1:1/struct',
      ARTIFACT_STORAGE_ROOT: root,
    },
    stdout: 'ignore',
    stderr: 'pipe',
  })
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/healthz`)
      if (response.ok) return
    } catch {
      // The listener is still starting.
    }
    await Bun.sleep(50)
  }
  throw new Error('API auth test server did not start')
})

afterAll(() => {
  child?.kill()
  rmSync(root, { recursive: true, force: true })
})

describe('API HTTP authentication boundary', () => {
  const protectedRequests = [
    ['GET', '/metrics'],
    ['POST', `/api/projects/${guessedProjectId}/directories`],
    ['GET', `/api/projects/${guessedProjectId}/directory-jobs/job`],
    ['POST', `/api/projects/${guessedProjectId}/directory-jobs/job/pause`],
    ['GET', `/api/projects/${guessedProjectId}/directory-jobs/job/events`],
    ['POST', `/api/projects/${guessedProjectId}/sources`],
    ['POST', `/api/projects/${guessedProjectId}/research`],
    ['GET', `/api/projects/${guessedProjectId}/runs/run/events`],
    ['POST', `/api/projects/${guessedProjectId}/runs/run/cancel`],
    ['GET', `/api/projects/${guessedProjectId}/runs/run/recursive-analysis`],
    ['GET', `/api/projects/${guessedProjectId}/research/thread/citation/citation`],
    ['GET', `/api/projects/${guessedProjectId}/dataset-queries`],
    ['GET', `/api/projects/${guessedProjectId}/findings`],
    ['GET', `/api/projects/${guessedProjectId}/reports/report/export`],
  ] as const

  it('returns the same 401 shape for missing and invalid credentials on every route family', async () => {
    for (const [method, path] of protectedRequests) {
      for (const authorization of [undefined, 'Bearer wrong-http-boundary-token']) {
        const response = await fetch(`${origin}${path}`, {
          method,
          headers: authorization === undefined ? {} : { authorization },
        })
        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({ error: 'AuthenticationRequired' })
      }
    }
  })

  it('keeps every protected direct-API quickstart command authenticated', async () => {
    const setup = await Bun.file(resolve(
      import.meta.dirname,
      '../../../docs/setup.md',
    )).text()
    expect(setup.match(/authorization: Bearer \$API_AUTH_TOKEN/g)).toHaveLength(3)
    expect(setup).toContain(
      'API_WORKSPACE_ID=310e8400-e29b-41d4-a716-446655440000',
    )
  })

  it('preserves an infrastructure failure from the project ownership precheck', async () => {
    const response = await fetch(
      `${origin}/api/projects/${guessedProjectId}/research`,
      { method: 'POST', headers: { authorization: `Bearer ${token}` } },
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'ProjectScopeUnavailable' })
  })
})
