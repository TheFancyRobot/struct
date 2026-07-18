import { describe, it, expect } from 'vitest'
import { execSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const workerMainPath = resolve(import.meta.dirname, 'main.ts')

describe('Worker entrypoint config validation', () => {
  it('exits nonzero when WORKER_METRICS_PORT is not a number', () => {
    let exitCode: number | null = null
    try {
      execSync(`WORKER_METRICS_PORT=not-a-number bun ${workerMainPath} 2>&1`, {
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

  it('starts successfully with valid WORKER_METRICS_PORT', () => {
    const result = execSync(
      `root=$(mktemp -d); WORKER_METRICS_PORT=3299 DATABASE_URL=postgres://struct:struct@localhost:5432/struct ARTIFACT_STORAGE_ROOT=$root bun ${workerMainPath} & sleep 2; kill %1 2>/dev/null; wait 2>/dev/null; rm -rf "$root"`,
      { encoding: 'utf-8', timeout: 8000, shell: '/bin/bash' },
    )
    expect(result).toContain('Worker starting')
    expect(result).toContain('metrics on port 3299')
  })

  it('exits nonzero without reporting ready when DATABASE_URL is unreachable', () => {
    const result = spawnSync(
      '/bin/bash',
      ['-lc', `root=$(mktemp -d); WORKER_METRICS_PORT=3298 DATABASE_URL=postgres://struct:struct@localhost:1/struct ARTIFACT_STORAGE_ROOT=$root bun ${workerMainPath}; status=$?; rm -rf "$root"; exit $status`],
      { encoding: 'utf-8', timeout: 5000 },
    )
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).not.toBeNull()
    expect(result.status).not.toBe(0)
    expect(output).not.toContain('Worker ready for ingestion jobs')
  })
})
