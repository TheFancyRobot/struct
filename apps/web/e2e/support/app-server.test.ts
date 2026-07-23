import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { startAppServer, stopAppServer } from './app-server'

const webRoot = resolve(import.meta.dir, '../..')
const e2eDistRoot = resolve(webRoot, '.e2e-dist')

function listPortDistRoots(port: number): string[] {
  if (!existsSync(e2eDistRoot)) return []
  return readdirSync(e2eDistRoot)
    .filter((entry) => entry.startsWith(`${port}-`))
    .map((entry) => resolve(e2eDistRoot, entry))
    .sort()
}

function cleanupPortDistRoots(port: number): void {
  for (const distRoot of listPortDistRoots(port)) {
    rmSync(distRoot, { force: true, recursive: true })
  }
}

function newDistRoots(before: readonly string[], after: readonly string[]): string[] {
  const previous = new Set(before)
  return after.filter((distRoot) => !previous.has(distRoot))
}

describe('isolated production web lifecycle', () => {
  it('removes the exact generated bundle when the server stops', async () => {
    const port = 4189
    cleanupPortDistRoots(port)

    const before = listPortDistRoots(port)
    const server = await startAppServer(port)
    const during = listPortDistRoots(port)
    const [distRoot] = newDistRoots(before, during)

    expect((await fetch(`http://127.0.0.1:${port}`)).ok).toBe(true)
    expect(distRoot).toBeDefined()
    expect(existsSync(distRoot!)).toBe(true)

    await stopAppServer(server)

    expect(existsSync(distRoot!)).toBe(false)
    cleanupPortDistRoots(port)
  })

  it('cleans generated bundles when startup fails before readiness', async () => {
    const port = 4190
    cleanupPortDistRoots(port)
    const before = listPortDistRoots(port)

    await expect(
      startAppServer(port, { API_AUTH_TOKEN: 'short-token' }),
    ).rejects.toThrow(`Web app exited before becoming ready at http://127.0.0.1:${port}`)

    const after = listPortDistRoots(port)
    expect(newDistRoots(before, after)).toEqual([])
    cleanupPortDistRoots(port)
  })

  it('releases its port after shutdown', async () => {
    const port = 4191
    cleanupPortDistRoots(port)

    const first = await startAppServer(port)
    expect((await fetch(`http://127.0.0.1:${port}`)).ok).toBe(true)
    await stopAppServer(first)
    const second = await startAppServer(port)
    expect((await fetch(`http://127.0.0.1:${port}`)).ok).toBe(true)
    await stopAppServer(second)

    cleanupPortDistRoots(port)
  })
})
