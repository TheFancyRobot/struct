import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { createServer } from 'node:net'
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
      execSync(`API_PORT=not-a-number bun ${apiMainPath} 2>&1`, {
        encoding: 'utf-8',
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
    const port = await getAvailablePort()
    // Start the server, wait for the log, then kill it
    const result = execSync(
      `root=$(mktemp -d); API_PORT=${port} DATABASE_URL=postgres://struct:struct@localhost:5432/struct ARTIFACT_STORAGE_ROOT=$root bun ${apiMainPath} & sleep 2; kill %1 2>/dev/null; wait 2>/dev/null; rm -rf "$root"`,
      { encoding: 'utf-8', timeout: 8000, shell: '/bin/bash' },
    )
    expect(result).toContain(`API server starting on port ${port}`)
    expect(result).toContain('Health check')
  })
})
