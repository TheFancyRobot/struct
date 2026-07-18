import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const apiMainPath = resolve(import.meta.dirname, 'main.ts')

const getAvailablePort = (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate an API test port'))
        return
      }
      server.close((error) => {
        if (error) reject(error)
        else resolvePort(address.port)
      })
    })
  })

describe('API entrypoint config validation', () => {
  it('exits nonzero when API_PORT is not a number', () => {
    let exitCode: number | null = null
    try {
      execSync('bun "$API_MAIN_PATH" 2>&1', {
        encoding: 'utf-8',
        env: {
          ...process.env,
          API_MAIN_PATH: apiMainPath,
          API_PORT: 'not-a-number',
        },
        timeout: 5000,
        stdio: 'pipe',
      })
    } catch (err: any) {
      exitCode = err.status ?? null
    }
    expect(exitCode).not.toBeNull()
    expect(exitCode).not.toBe(0)
  })

  it('starts successfully with valid API_PORT', async () => {
    let result = ''
    let port = 0
    for (let attempt = 0; attempt < 3; attempt += 1) {
      port = await getAvailablePort()
      const root = mkdtempSync(`${tmpdir()}/struct-api-entrypoint-`)
      try {
        result = execSync(
          'bun "$API_MAIN_PATH" & child=$!; sleep 2; kill "$child" 2>/dev/null; wait "$child" 2>/dev/null; true',
          {
            encoding: 'utf-8',
            timeout: 8000,
            shell: '/bin/bash',
            env: {
              ...process.env,
              API_MAIN_PATH: apiMainPath,
              API_PORT: String(port),
              DATABASE_URL: 'postgres://struct:struct@localhost:5432/struct',
              ARTIFACT_STORAGE_ROOT: root,
            },
          },
        )
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
      if (!result.includes('EADDRINUSE')) break
    }

    expect(result).not.toContain('EADDRINUSE')
    expect(result).toContain(`API server starting on port ${port}`)
    expect(result).toContain('Health check')
  })
})
