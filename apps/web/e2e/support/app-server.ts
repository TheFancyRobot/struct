import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = resolve(import.meta.dir, '../..')

export type AppServerProcess = ReturnType<typeof Bun.spawn>

function uniqueDistRoot(port: number, environment: Readonly<Record<string, string>>): string {
  const scope = [
    environment['BASE_PATH'] ?? 'root',
    environment['BASE_URL'] ?? 'root',
    process.pid.toString(),
    Math.random().toString(36).slice(2, 8),
  ]
    .join('-')
    .replace(/[^a-z0-9-]+/gi, '_')
  return `.e2e-dist/${port}-${scope}`
}

async function buildApp(distRoot: string, environment: Readonly<Record<string, string>>) {
  mkdirSync(resolve(webRoot, distRoot), { recursive: true })
  const build = Bun.spawn([
    'bun',
    '--bun',
    'vite',
    'build',
    '--outDir',
    distRoot,
  ], {
    cwd: webRoot,
    env: {
      ...process.env,
      ...environment,
    },
    stdout: 'ignore',
    stderr: 'ignore',
  })
  const exitCode = await build.exited
  if (exitCode !== 0) {
    throw new Error(`Web build failed for ${distRoot}`)
  }
}

export async function startAppServer(
  port: number,
  environment: Readonly<Record<string, string>> = {},
): Promise<AppServerProcess> {
  const origin = `http://127.0.0.1:${port}`
  const distRoot = uniqueDistRoot(port, environment)
  await buildApp(distRoot, environment)
  const server = Bun.spawn(['bun', 'src/server.ts'], {
    cwd: webRoot,
    env: {
      ...process.env,
      WEB_PORT: String(port),
      API_AUTH_TOKEN: 'e2e-server-only-token',
      DIST_ROOT: distRoot,
      ...environment,
    },
    stdout: 'ignore',
    stderr: 'ignore',
  })
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
  server.kill()
  await server.exited
  throw new Error(`Web app did not become ready at ${origin}`)
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
