import { describe, expect, it } from 'bun:test'
import { startAppServer, stopAppServer } from './app-server'

describe('isolated production web lifecycle', () => {
  it('releases its port after shutdown', async () => {
    let first: Awaited<ReturnType<typeof startAppServer>> | undefined
    let second: Awaited<ReturnType<typeof startAppServer>> | undefined

    try {
      first = await startAppServer(4189)
      expect((await fetch('http://127.0.0.1:4189')).ok).toBe(true)
      await stopAppServer(first)
      first = undefined
      second = await startAppServer(4189)
      expect((await fetch('http://127.0.0.1:4189')).ok).toBe(true)
    } finally {
      await stopAppServer(second)
      await stopAppServer(first)
    }
  })

  it('rejects starting on an occupied port', async () => {
    let first: Awaited<ReturnType<typeof startAppServer>> | undefined
    let second: Awaited<ReturnType<typeof startAppServer>> | undefined
    let secondError: unknown

    try {
      first = await startAppServer(4190)
      second = await startAppServer(4190)
    } catch (error) {
      secondError = error
    } finally {
      await stopAppServer(second)
      await stopAppServer(first)
    }

    expect(secondError).toBeInstanceOf(Error)
  })
})
