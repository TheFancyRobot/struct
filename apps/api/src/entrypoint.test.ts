import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const apiMainPath = resolve(import.meta.dirname, 'main.ts')

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

  it('starts successfully with valid API_PORT', () => {
    // Start the server, wait for the log, then kill it
    const result = execSync(
      `API_PORT=3199 bun ${apiMainPath} & sleep 2 && kill %1 2>/dev/null; wait 2>/dev/null`,
      { encoding: 'utf-8', timeout: 8000, shell: '/bin/bash' },
    )
    expect(result).toContain('API server starting on port 3199')
    expect(result).toContain('Health check')
  })
})
