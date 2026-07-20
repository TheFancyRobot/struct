import { describe, expect, it } from 'bun:test'
import { startAppServer, stopAppServer } from './app-server'

describe('isolated production web lifecycle', () => {
  it('releases its port after shutdown', async () => {
    const first = await startAppServer(4189)
    expect((await fetch('http://127.0.0.1:4189')).ok).toBe(true)
    await stopAppServer(first)
    const second = await startAppServer(4189)
    expect((await fetch('http://127.0.0.1:4189')).ok).toBe(true)
    await stopAppServer(second)
  })
})
