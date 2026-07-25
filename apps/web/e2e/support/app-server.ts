import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = resolve(import.meta.dir, '../..')
const repositoryRoot = resolve(webRoot, '../..')
const apiRoot = resolve(repositoryRoot, 'apps/api')
const workerRoot = resolve(repositoryRoot, 'apps/worker')
const deterministicProviderPackage = resolve(import.meta.dir, 'deterministic-fred-provider.ts')
const e2eArtifactRoot = resolve(repositoryRoot, '.local/e2e/workspace-release-artifacts')
const e2eDatabaseName = 'struct_e2e_workspace_release'
const e2eDatabaseUrl = `postgres://struct:struct@127.0.0.1:5432/${e2eDatabaseName}`
const e2eApiAuthToken = 'e2e-server-only-token'
const e2eWorkspaceId = 'f50e8400-e29b-41d4-a716-446655440010'
const defaultDataEngineToken = 'struct-local-data-engine-token'

type AppServerChildProcess = ReturnType<typeof Bun.spawn>

interface CapturedProcess {
  readonly name: string
  readonly process: AppServerChildProcess
  readonly logs: Promise<string>
}

export interface AppServerProcess {
  readonly distRoot: string
  readonly process: AppServerChildProcess
}

export interface RealAppStackProcess {
  readonly api: CapturedProcess
  readonly artifactRoot: string
  readonly databaseUrl: string
  readonly web: AppServerProcess
  readonly worker: CapturedProcess
}

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

function removeDistRoot(distRoot: string): void {
  rmSync(resolve(webRoot, distRoot), { force: true, recursive: true })
}

function spawnCapturedProcess(
  name: string,
  command: string[],
  cwd: string,
  environment: Readonly<Record<string, string>>,
): CapturedProcess {
  const child = Bun.spawn(command, {
    cwd,
    env: {
      ...process.env,
      ...environment,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    name,
    process: child,
    logs: Promise.all([
      child.stdout ? new Response(child.stdout).text() : Promise.resolve(''),
      child.stderr ? new Response(child.stderr).text() : Promise.resolve(''),
    ]).then(([stdout, stderr]) => `${stdout}${stderr}`.trim()),
  }
}

async function runCommand(
  name: string,
  command: string[],
  cwd: string,
  environment: Readonly<Record<string, string>>,
): Promise<void> {
  const child = spawnCapturedProcess(name, command, cwd, environment)
  const exitCode = await child.process.exited
  if (exitCode !== 0) {
    const logs = await child.logs
    throw new Error(`${name} failed (${exitCode})${logs ? `\n${logs}` : ''}`)
  }
}

async function readCommandOutput(command: string[], cwd: string): Promise<string> {
  const child = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'ignore' })
  const output = await new Response(child.stdout).text()
  const exitCode = await child.exited
  return exitCode === 0 ? output.trim() : ''
}

async function resolveDataEngineToken(): Promise<string> {
  const output = await readCommandOutput([
    'docker',
    'inspect',
    'struct-data-engine',
    '--format',
    '{{range .Config.Env}}{{println .}}{{end}}',
  ], repositoryRoot)
  const token = output
    .split('\n')
    .find((line) => line.startsWith('DATA_ENGINE_TOKEN='))
    ?.slice('DATA_ENGINE_TOKEN='.length)
    .trim()
  return token && token.length >= 16 ? token : defaultDataEngineToken
}

async function resetDatabase(environment: Readonly<Record<string, string>>): Promise<void> {
  await runCommand(
    'database drop',
    [
      'docker',
      'exec',
      '-i',
      'struct-postgres',
      'psql',
      '-U',
      'struct',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `DROP DATABASE IF EXISTS "${e2eDatabaseName}" WITH (FORCE)`,
    ],
    repositoryRoot,
    {},
  )
  await runCommand(
    'database create',
    [
      'docker',
      'exec',
      '-i',
      'struct-postgres',
      'psql',
      '-U',
      'struct',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `CREATE DATABASE "${e2eDatabaseName}"`,
    ],
    repositoryRoot,
    {},
  )
  await runCommand('migrations', ['bun', 'run', 'migrations:up'], repositoryRoot, environment)
}

async function buildApp(distRoot: string, environment: Readonly<Record<string, string>>) {
  mkdirSync(resolve(webRoot, distRoot), { recursive: true })
  await runCommand(
    'web build',
    ['bun', '--bun', 'vite', 'build', '--outDir', distRoot],
    webRoot,
    environment,
  )
}

async function stopServerProcess(server: AppServerChildProcess): Promise<void> {
  if (server.exitCode !== null) return
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

async function stopCapturedProcess(process: CapturedProcess | undefined): Promise<void> {
  if (process === undefined) return
  await stopServerProcess(process.process)
  await process.logs.catch(() => '')
}

async function waitForReady(process: CapturedProcess, origin: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (process.process.exitCode !== null) {
      const logs = await process.logs
      throw new Error(`${process.name} exited before becoming ready at ${origin}${logs ? `\n${logs}` : ''}`)
    }
    try {
      if ((await fetch(origin)).ok) return
    } catch {
      // Process is still starting.
    }
    await Bun.sleep(100)
  }
  await stopCapturedProcess(process)
  const logs = await process.logs.catch(() => '')
  throw new Error(`${process.name} did not become ready at ${origin}${logs ? `\n${logs}` : ''}`)
}

function resetArtifactRoot(): void {
  rmSync(e2eArtifactRoot, { force: true, recursive: true })
  mkdirSync(e2eArtifactRoot, { recursive: true })
}

async function prepareRealStack(environment: Readonly<Record<string, string>>): Promise<void> {
  resetArtifactRoot()
  await readCommandOutput([
    'docker',
    'start',
    'struct-postgres',
    'struct-data-engine',
    'struct-data-engine-gateway',
  ], repositoryRoot)
  try {
    await runCommand(
      'dependency check',
      ['bun', 'run', 'ops', 'database:verify'],
      repositoryRoot,
      {
        ...environment,
        DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct',
      },
    )
  } catch {
    await runCommand('dependency stack', ['bun', 'run', 'ops', 'stack:up'], repositoryRoot, environment)
  }
  await resetDatabase(environment)
}

function realStackEnvironment(
  webPort: number,
  dataEngineToken: string,
): Readonly<Record<string, string>> {
  return {
    API_AUTH_TOKEN: e2eApiAuthToken,
    API_ORIGIN: `http://127.0.0.1:${webPort + 1}`,
    API_PORT: String(webPort + 1),
    API_WORKSPACE_ID: e2eWorkspaceId,
    ARTIFACT_STORAGE_ROOT: e2eArtifactRoot,
    DATABASE_URL: e2eDatabaseUrl,
    DATA_ENGINE_TOKEN: dataEngineToken,
    DATA_ENGINE_URL: 'http://127.0.0.1:4300',
    FRED_MODEL: 'deterministic-e2e',
    FRED_PROVIDER_PACKAGE: deterministicProviderPackage,
    MAX_TEXT_SOURCE_BYTES: '1048576',
    RESEARCH_MAX_ELAPSED_MS: '15000',
    WEB_PORT: String(webPort),
    WORKER_JOB_STALE_MS: '45000',
    WORKER_METRICS_PORT: String(webPort + 2),
    WORKER_POLL_INTERVAL_MS: '100',
  }
}

export async function startAppServer(
  port: number,
  environment: Readonly<Record<string, string>> = {},
): Promise<AppServerProcess> {
  const origin = `http://127.0.0.1:${port}`
  const distRoot = uniqueDistRoot(port, environment)
  let server: AppServerChildProcess | undefined
  try {
    await buildApp(distRoot, environment)
    server = Bun.spawn(['bun', 'src/server.ts'], {
      cwd: webRoot,
      env: {
        ...process.env,
        WEB_PORT: String(port),
        API_AUTH_TOKEN: e2eApiAuthToken,
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
        if ((await fetch(origin)).ok) {
          return { distRoot, process: server }
        }
      } catch {
        // The built app server is still starting.
      }
      await Bun.sleep(100)
    }
    throw new Error(`Web app did not become ready at ${origin}`)
  } catch (error) {
    if (server !== undefined) {
      await stopServerProcess(server)
    }
    removeDistRoot(distRoot)
    throw error
  }
}

export async function startRealAppStack(port: number): Promise<RealAppStackProcess> {
  const environment = realStackEnvironment(port, await resolveDataEngineToken())
  let api: CapturedProcess | undefined
  let worker: CapturedProcess | undefined
  let web: AppServerProcess | undefined
  try {
    await prepareRealStack(environment)
    api = spawnCapturedProcess('API', ['bun', 'src/main.ts'], apiRoot, environment)
    await waitForReady(api, `${environment['API_ORIGIN']}/readyz`)
    worker = spawnCapturedProcess('worker', ['bun', 'src/main.ts'], workerRoot, environment)
    await waitForReady(worker, `http://127.0.0.1:${environment['WORKER_METRICS_PORT']}/readyz`)
    web = await startAppServer(port, environment)
    return {
      api,
      artifactRoot: e2eArtifactRoot,
      databaseUrl: e2eDatabaseUrl,
      web,
      worker,
    }
  } catch (error) {
    await stopCapturedProcess(worker)
    await stopCapturedProcess(api)
    await stopAppServer(web)
    throw error
  }
}

export async function stopAppServer(server: AppServerProcess | undefined): Promise<void> {
  if (server === undefined) return
  await stopServerProcess(server.process)
  removeDistRoot(server.distRoot)
}

export async function stopRealAppStack(stack: RealAppStackProcess | undefined): Promise<void> {
  if (stack === undefined) return
  await stopAppServer(stack.web)
  await stopCapturedProcess(stack.worker)
  await stopCapturedProcess(stack.api)
}
