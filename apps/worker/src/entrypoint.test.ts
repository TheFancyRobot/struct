import { describe, it, expect } from 'vitest'
import { execSync, spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const workerMainPath = resolve(import.meta.dirname, 'main.ts')

function startUntilReady(env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolveReady, reject) => {
    const child = spawn('bun', [workerMainPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let ready = false
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Worker did not become ready:\n${output}`))
    }, 10_000)
    const record = (chunk: Buffer): void => {
      output += chunk.toString()
      if (!ready && output.includes('Worker ready for ingestion and research jobs')) {
        ready = true
        clearTimeout(timeout)
        child.kill('SIGTERM')
      }
    }
    child.stdout.on('data', record)
    child.stderr.on('data', record)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      if (ready) resolveReady(output)
      else reject(new Error(`Worker exited before readiness (${String(code)}):\n${output}`))
    })
  })
}

const getAvailablePort = (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a worker test port'))
        return
      }
      server.close((error) => {
        if (error) reject(error)
        else resolvePort(address.port)
      })
    })
  })

describe('Worker entrypoint config validation', () => {
  it('exits nonzero when WORKER_METRICS_PORT is not a number', () => {
    let exitCode: number | null = null
    try {
      execSync('bun "$WORKER_MAIN_PATH" 2>&1', {
        encoding: 'utf-8',
        env: {
          ...process.env,
          WORKER_MAIN_PATH: workerMainPath,
          WORKER_METRICS_PORT: 'not-a-number',
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

  it('starts successfully with valid WORKER_METRICS_PORT', async () => {
    const port = await getAvailablePort()
    const root = mkdtempSync(`${tmpdir()}/struct-worker-entrypoint-`)
    let result = ''
    try {
      result = await startUntilReady({
        ...process.env,
        WORKER_METRICS_PORT: String(port),
        DATABASE_URL: 'postgres://struct:struct@localhost:5432/struct',
        ARTIFACT_STORAGE_ROOT: root,
        FRED_PROVIDER_PACKAGE: '@fancyrobot/fred-openai',
        FRED_MODEL: 'gpt-4o-mini',
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
    expect(result).toContain('Worker starting')
    expect(result).toContain(`metrics on port ${port}`)
    expect(result).toContain('Worker ready for ingestion and research jobs')
  })

  it('exits nonzero without reporting ready when DATABASE_URL is unreachable', async () => {
    const port = await getAvailablePort()
    const result = spawnSync(
      '/bin/bash',
      ['-lc', 'bun "$WORKER_MAIN_PATH"'],
      {
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          ...process.env,
          WORKER_MAIN_PATH: workerMainPath,
          WORKER_METRICS_PORT: String(port),
          DATABASE_URL: 'postgres://struct:struct@localhost:1/struct',
          ARTIFACT_STORAGE_ROOT: tmpdir(),
          FRED_PROVIDER_PACKAGE: '@fancyrobot/fred-openai',
          FRED_MODEL: 'gpt-4o-mini',
        },
      },
    )
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).not.toBeNull()
    expect(result.status).not.toBe(0)
    expect(output).not.toContain('Worker ready for ingestion jobs')
  })
})
