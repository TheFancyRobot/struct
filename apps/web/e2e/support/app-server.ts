import { createConnection } from 'node:net'
import { resolve } from 'node:path'

const webRoot = resolve(import.meta.dir, '../..')

export type AppServerProcess = ReturnType<typeof Bun.spawn>

async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolvePort, rejectPort) => {
    const probe = createConnection({ host: '127.0.0.1', port })
    probe.once('connect', () => {
      probe.destroy()
      rejectPort(new Error(`Web app port ${port} is already in use`))
    })
    probe.once('error', (error) => {
      const code = 'code' in error ? error.code : undefined
      if (code === 'ECONNREFUSED') {
        resolvePort()
        return
      }
      rejectPort(error)
    })
  })
}

export async function startAppServer(port: number): Promise<AppServerProcess> {
  const origin = `http://127.0.0.1:${port}`
  await assertPortAvailable(port)
  const server = Bun.spawn(['bun', 'src/server.ts'], {
    cwd: webRoot,
    env: {
      ...process.env,
      WEB_PORT: String(port),
      API_AUTH_TOKEN: 'e2e-server-only-token',
    },
    stdout: 'ignore',
    stderr: 'ignore',
  })

  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (server.exitCode !== null) {
        throw new Error(`Web app exited before becoming ready at ${origin}`)
      }
      try {
        if ((await fetch(origin)).ok) return server
      } catch {
        // The built app server is still starting.
      }
      await Bun.sleep(100)
    }
    throw new Error(`Web app did not become ready at ${origin}`)
  } catch (error) {
    if (server.exitCode === null) {
      server.kill()
    }
    await server.exited
    throw error
  }
}

export async function stopAppServer(server: AppServerProcess | undefined): Promise<void> {
  if (server === undefined || server.exitCode !== null) return
  server.kill()
  const stopped = await Promise.race([
    server.exited.then(() => true),
    Bun.sleep(5_000).then(() => false),
  ])
  if (!stopped) {
    server.kill(9)
    await server.exited
  }
}
