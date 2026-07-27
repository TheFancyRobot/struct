import { mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
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
const dependencyDatabaseUrl = 'postgres://struct:struct@127.0.0.1:5432/struct'

type AppServerChildProcess = ReturnType<typeof Bun.spawn>
const dependencyStartCommand = [
  'docker',
  'start',
  'struct-postgres',
  'struct-data-engine',
  'struct-data-engine-gateway',
] as const
const readinessMaxWaitMs = 30_000
const readinessProbeTimeoutMs = 1_000
const readinessRetryIntervalMs = 100
const commandMaxWaitMs = 20_000
const buildMaxWaitMs = 60_000
const dockerPortBindMaxAttempts = 3
const processLogDrainTimeoutMs = 1_000

export interface CapturedProcess {
  readonly name: string
  readonly process: AppServerChildProcess
  readonly logs: Promise<string>
}

export interface AppServerProcess {
  readonly distRoot: string
  readonly process: AppServerChildProcess
  readonly stubApi?: Bun.Server<undefined>
}

export interface RealAppStackProcess {
  readonly api: CapturedProcess
  readonly artifactRoot: string
  readonly databaseUrl: string
  readonly dataEngine: IsolatedDataEngine
  readonly web: AppServerProcess
  readonly worker: CapturedProcess
}

export interface IsolatedDataEngine {
  readonly containerName: string
  readonly gatewayName: string
  readonly networkName: string
  readonly port: number
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
  command: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string>>,
): CapturedProcess {
  const child = Bun.spawn([...command], {
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
  command: ReadonlyArray<string>,
  cwd: string,
  environment: Readonly<Record<string, string>>,
  maxWaitMs = commandMaxWaitMs,
): Promise<void> {
  const child = spawnCapturedProcess(name, command, cwd, environment)
  const timedOut = Symbol('command timed out')
  let timeout: ReturnType<typeof setTimeout> | undefined
  let exitCode: number | typeof timedOut
  try {
    exitCode = await Promise.race([
      child.process.exited,
      new Promise<typeof timedOut>((resolveTimeout) => {
        timeout = setTimeout(() => resolveTimeout(timedOut), maxWaitMs)
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
  if (exitCode === timedOut) {
    await stopServerProcess(child.process)
    const logs = await Promise.race([
      child.logs.catch(() => ''),
      Bun.sleep(processLogDrainTimeoutMs).then(() => ''),
    ])
    throw new Error(
      `${name} timed out after ${maxWaitMs}ms${logs ? `\n${logs}` : ''}`,
    )
  }
  if (exitCode !== 0) {
    const logs = await child.logs
    throw new Error(`${name} failed (${exitCode})${logs ? `\n${logs}` : ''}`)
  }
}

async function readCommandOutput(
  command: ReadonlyArray<string>,
  cwd: string,
): Promise<string> {
  const child = Bun.spawn([...command], { cwd, stdout: 'pipe', stderr: 'ignore' })
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
    buildMaxWaitMs,
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
  await Promise.race([
    process.logs.catch(() => ''),
    Bun.sleep(processLogDrainTimeoutMs),
  ])
}

export interface ReadinessProbeOptions {
  readonly maxWaitMs?: number
  readonly probeTimeoutMs?: number
  readonly retryIntervalMs?: number
}

export async function waitForReady(
  process: CapturedProcess,
  origin: string,
  options: ReadinessProbeOptions = {},
): Promise<void> {
  const maxWaitMs = Math.max(1, options.maxWaitMs ?? readinessMaxWaitMs)
  const probeTimeoutMs = Math.max(1, options.probeTimeoutMs ?? readinessProbeTimeoutMs)
  const retryIntervalMs = Math.max(1, options.retryIntervalMs ?? readinessRetryIntervalMs)
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    if (process.process.exitCode !== null) {
      const logs = await process.logs
      throw new Error(`${process.name} exited before becoming ready at ${origin}${logs ? `\n${logs}` : ''}`)
    }
    try {
      if ((await fetch(origin, {
        signal: AbortSignal.timeout(probeTimeoutMs),
      })).ok) return
    } catch {
      // Process is still starting.
    }
    if (Date.now() >= deadline) break
    await Bun.sleep(retryIntervalMs)
  }
  await stopCapturedProcess(process)
  const logs = await process.logs.catch(() => '')
  throw new Error(`${process.name} did not become ready at ${origin}${logs ? `\n${logs}` : ''}`)
}

function resetArtifactRoot(): void {
  rmSync(e2eArtifactRoot, { force: true, recursive: true })
  mkdirSync(e2eArtifactRoot, { recursive: true })
}

export async function startDependencyContainers(
  command: ReadonlyArray<string> = dependencyStartCommand,
): Promise<void> {
  await runCommand('dependency start', command, repositoryRoot, {})
}

function bootstrapDependencyEnvironment(): Readonly<Record<string, string>> {
  const configuredToken = process.env['DATA_ENGINE_TOKEN']?.trim()
  return {
    DATABASE_URL: dependencyDatabaseUrl,
    DATA_ENGINE_TOKEN: configuredToken && configuredToken.length >= 16
      ? configuredToken
      : defaultDataEngineToken,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function runDependencyStackFallback(
  environment: Readonly<Record<string, string>>,
  cause: unknown,
  run: (
    name: string,
    command: ReadonlyArray<string>,
    cwd: string,
    environment: Readonly<Record<string, string>>,
  ) => Promise<void>,
): Promise<void> {
  try {
    await run('dependency stack', ['bun', 'run', 'ops', 'stack:up'], repositoryRoot, environment)
  } catch (fallbackError) {
    throw new Error(
      `dependency stack fallback failed after ${errorMessage(cause)}\n\n${errorMessage(fallbackError)}`,
    )
  }
}

export interface PrepareRealStackEnvironmentDependencies {
  readonly resolveDataEngineToken?: () => Promise<string>
  readonly resetDatabase?: (environment: Readonly<Record<string, string>>) => Promise<void>
  readonly runCommand?: (
    name: string,
    command: ReadonlyArray<string>,
    cwd: string,
    environment: Readonly<Record<string, string>>,
  ) => Promise<void>
  readonly startDependencyContainers?: () => Promise<void>
}

export async function prepareRealStackEnvironment(
  port: number,
  dependencies: PrepareRealStackEnvironmentDependencies = {},
): Promise<Readonly<Record<string, string>>> {
  const bootstrapEnvironment = bootstrapDependencyEnvironment()
  const run = dependencies.runCommand ?? runCommand
  const start = dependencies.startDependencyContainers ?? (() => startDependencyContainers())
  const readToken = dependencies.resolveDataEngineToken ?? resolveDataEngineToken
  const reset = dependencies.resetDatabase ?? resetDatabase

  resetArtifactRoot()
  try {
    await start()
  } catch (error) {
    await runDependencyStackFallback(bootstrapEnvironment, error, run)
  }

  let dependencyEnvironment = {
    ...bootstrapEnvironment,
    DATA_ENGINE_TOKEN: await readToken(),
  }
  try {
    await run(
      'dependency check',
      ['bun', 'run', 'ops', 'database:verify'],
      repositoryRoot,
      dependencyEnvironment,
    )
  } catch (error) {
    await runDependencyStackFallback(dependencyEnvironment, error, run)
    dependencyEnvironment = {
      ...dependencyEnvironment,
      DATA_ENGINE_TOKEN: await readToken(),
    }
    await run(
      'dependency check',
      ['bun', 'run', 'ops', 'database:verify'],
      repositoryRoot,
      dependencyEnvironment,
    )
  }

  const environment = realStackEnvironment(
    port,
    dependencyEnvironment['DATA_ENGINE_TOKEN'],
    await availableLoopbackPort(),
  )
  await reset(environment)
  return environment
}

function realStackEnvironment(
  webPort: number,
  dataEngineToken: string,
  dataEnginePort: number,
): Readonly<Record<string, string>> {
  return {
    API_AUTH_TOKEN: e2eApiAuthToken,
    API_ORIGIN: `http://127.0.0.1:${webPort + 1}`,
    API_PORT: String(webPort + 1),
    API_WORKSPACE_ID: e2eWorkspaceId,
    ARTIFACT_STORAGE_ROOT: e2eArtifactRoot,
    DATABASE_URL: e2eDatabaseUrl,
    DATA_ENGINE_TOKEN: dataEngineToken,
    DATA_ENGINE_URL: `http://127.0.0.1:${dataEnginePort}`,
    FRED_MODEL: 'deterministic-e2e',
    FRED_PROVIDER_PACKAGE: deterministicProviderPackage,
    MAX_TEXT_SOURCE_BYTES: '268435456',
    RESEARCH_MAX_ELAPSED_MS: '15000',
    WEB_PORT: String(webPort),
    WORKER_JOB_STALE_MS: '45000',
    WORKER_METRICS_PORT: String(webPort + 2),
    WORKER_POLL_INTERVAL_MS: '100',
  }
}

async function availableLoopbackPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolveStart, rejectStart) => {
    server.once('error', rejectStart)
    server.listen(0, '127.0.0.1', () => resolveStart())
  })
  const address = server.address()
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose())
  })
  if (address === null || typeof address === 'string') {
    throw new Error('Could not allocate an isolated data-engine port')
  }
  return address.port
}

export function isolatedDataEngineRunCommand(
  containerName: string,
  networkName: string,
  token: string,
): ReadonlyArray<string> {
  return [
    'docker',
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--network',
    networkName,
    '--network-alias',
    'data-engine',
    '--env',
    `DATA_ENGINE_TOKEN=${token}`,
    '--mount',
    `type=bind,source=${e2eArtifactRoot},target=/artifacts,readonly`,
    '--read-only',
    '--tmpfs',
    '/tmp:size=16m,mode=1777',
    '--tmpfs',
    '/scratch:size=256m,mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--pids-limit',
    '64',
    '--memory',
    '256m',
    '--cpus',
    '1',
    'struct-data-engine:local',
  ]
}

export function isolatedDataEngineNetworkCreateCommand(
  networkName: string,
): ReadonlyArray<string> {
  return ['docker', 'network', 'create', '--internal', networkName]
}

export function isolatedDataEngineGatewayRunCommand(
  gatewayName: string,
  port: number,
  token: string,
): ReadonlyArray<string> {
  return [
    'docker',
    'run',
    '--detach',
    '--rm',
    '--name',
    gatewayName,
    '--network',
    'bridge',
    '--publish',
    `127.0.0.1:${port}:4300`,
    '--env',
    `DATA_ENGINE_TOKEN=${token}`,
    '--read-only',
    '--tmpfs',
    '/tmp:size=16m,mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--pids-limit',
    '32',
    '--memory',
    '64m',
    '--cpus',
    '0.25',
    'struct-data-engine:local',
    'node',
    'gateway.mjs',
  ]
}

async function runBestEffort(command: ReadonlyArray<string>): Promise<void> {
  const child = Bun.spawn([...command], {
    cwd: repositoryRoot,
    stdout: 'ignore',
    stderr: 'ignore',
  })
  await child.exited
}

export interface IsolatedDataEngineGatewayDependencies {
  readonly availableLoopbackPort?: () => Promise<number>
  readonly removeGateway?: (gatewayName: string) => Promise<void>
  readonly runCommand?: (
    name: string,
    command: ReadonlyArray<string>,
    cwd: string,
    environment: Readonly<Record<string, string>>,
  ) => Promise<void>
}

function isDockerPortBindFailure(error: unknown): boolean {
  return /address already in use|port is already allocated|failed to bind host port|bind for .* failed/i
    .test(errorMessage(error))
}

export async function startIsolatedDataEngineGateway(
  gatewayName: string,
  initialPort: number,
  token: string,
  dependencies: IsolatedDataEngineGatewayDependencies = {},
): Promise<number> {
  const run = dependencies.runCommand ?? runCommand
  const allocatePort = dependencies.availableLoopbackPort ?? availableLoopbackPort
  const removeGateway = dependencies.removeGateway
    ?? ((name: string) => runBestEffort(['docker', 'rm', '--force', name]))
  let port = initialPort
  for (let attempt = 1; attempt <= dockerPortBindMaxAttempts; attempt += 1) {
    try {
      await run(
        'isolated data-engine gateway',
        isolatedDataEngineGatewayRunCommand(gatewayName, port, token),
        repositoryRoot,
        {},
      )
      return port
    } catch (error) {
      if (attempt === dockerPortBindMaxAttempts || !isDockerPortBindFailure(error)) {
        throw error
      }
      await removeGateway(gatewayName)
      port = await allocatePort()
    }
  }
  throw new Error('Unreachable isolated data-engine gateway retry state')
}

async function stopIsolatedDataEngine(
  dataEngine: IsolatedDataEngine | undefined,
): Promise<void> {
  if (dataEngine === undefined) return
  await runBestEffort(['docker', 'rm', '--force', dataEngine.gatewayName])
  await runBestEffort(['docker', 'rm', '--force', dataEngine.containerName])
  await runBestEffort(['docker', 'network', 'rm', dataEngine.networkName])
}

async function startIsolatedDataEngine(
  port: number,
  token: string,
): Promise<IsolatedDataEngine> {
  const suffix = `${process.pid}-${port}`
  const dataEngine = {
    containerName: `struct-e2e-data-engine-${suffix}`,
    gatewayName: `struct-e2e-data-engine-gateway-${suffix}`,
    networkName: `struct-e2e-data-engine-${suffix}`,
    port,
  }
  try {
    await runCommand(
      'isolated data-engine network',
      isolatedDataEngineNetworkCreateCommand(dataEngine.networkName),
      repositoryRoot,
      {},
    )
    await runCommand(
      'isolated data-engine',
      isolatedDataEngineRunCommand(
        dataEngine.containerName,
        dataEngine.networkName,
        token,
      ),
      repositoryRoot,
      {},
    )
    dataEngine.port = await startIsolatedDataEngineGateway(
      dataEngine.gatewayName,
      dataEngine.port,
      token,
    )
    await runCommand(
      'isolated data-engine gateway network',
      ['docker', 'network', 'connect', dataEngine.networkName, dataEngine.gatewayName],
      repositoryRoot,
      {},
    )
    const origin = `http://127.0.0.1:${dataEngine.port}/healthz`
    const deadline = Date.now() + readinessMaxWaitMs
    while (Date.now() < deadline) {
      try {
        if ((await fetch(origin, {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(readinessProbeTimeoutMs),
        })).ok) return dataEngine
      } catch {
        // The isolated no-egress sidecar is still starting.
      }
      await Bun.sleep(readinessRetryIntervalMs)
    }
    const logs = await readCommandOutput(
      ['docker', 'logs', dataEngine.containerName],
      repositoryRoot,
    )
    throw new Error(
      `isolated data-engine did not become ready at ${origin}${logs ? `\n${logs}` : ''}`,
    )
  } catch (error) {
    await stopIsolatedDataEngine(dataEngine)
    throw error
  }
}

function startStubApiOrigin(): Bun.Server<undefined> {
  return Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request) {
      const url = new URL(request.url)
      if (request.method === 'GET' && url.pathname === '/api/projects') {
        return new Response('{"items":[],"nextCursor":null}', {
          headers: { 'content-type': 'application/json' },
        })
      }
      if (request.method === 'GET' && /^\/api\/projects\/[^/]+\/sources$/.test(url.pathname)) {
        return new Response('{"items":[],"cursor":"0"}', {
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('{"error":"NotFound"}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
}

export async function startAppServer(
  port: number,
  environment: Readonly<Record<string, string>> = {},
): Promise<AppServerProcess> {
  const origin = `http://127.0.0.1:${port}`
  const distRoot = uniqueDistRoot(port, environment)
  const stubApi = environment['API_ORIGIN'] === undefined ? startStubApiOrigin() : undefined
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
        ...(stubApi !== undefined ? { API_ORIGIN: `http://127.0.0.1:${stubApi.port}` } : {}),
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
          return { distRoot, process: server, stubApi }
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
    stubApi?.stop(true)
    removeDistRoot(distRoot)
    throw error
  }
}

export async function startRealAppStack(port: number): Promise<RealAppStackProcess> {
  let api: CapturedProcess | undefined
  let dataEngine: IsolatedDataEngine | undefined
  let worker: CapturedProcess | undefined
  let web: AppServerProcess | undefined
  try {
    let environment = await prepareRealStackEnvironment(port)
    dataEngine = await startIsolatedDataEngine(
      Number(new URL(environment['DATA_ENGINE_URL']!).port),
      environment['DATA_ENGINE_TOKEN']!,
    )
    environment = {
      ...environment,
      DATA_ENGINE_URL: `http://127.0.0.1:${dataEngine.port}`,
    }
    api = spawnCapturedProcess('API', ['bun', 'src/main.ts'], apiRoot, environment)
    await waitForReady(api, `${environment['API_ORIGIN']}/readyz`)
    worker = spawnCapturedProcess('worker', ['bun', 'src/main.ts'], workerRoot, environment)
    await waitForReady(worker, `http://127.0.0.1:${environment['WORKER_METRICS_PORT']}/readyz`)
    web = await startAppServer(port, environment)
    return {
      api,
      artifactRoot: e2eArtifactRoot,
      databaseUrl: e2eDatabaseUrl,
      dataEngine,
      web,
      worker,
    }
  } catch (error) {
    await stopCapturedProcess(worker)
    await stopCapturedProcess(api)
    await stopAppServer(web)
    await stopIsolatedDataEngine(dataEngine)
    throw error
  }
}

export async function stopAppServer(server: AppServerProcess | undefined): Promise<void> {
  if (server === undefined) return
  await stopServerProcess(server.process)
  await server.stubApi?.stop(true)
  removeDistRoot(server.distRoot)
}

export async function stopRealAppStack(stack: RealAppStackProcess | undefined): Promise<void> {
  if (stack === undefined) return
  await stopAppServer(stack.web)
  await stopCapturedProcess(stack.worker)
  await stopCapturedProcess(stack.api)
  await stopIsolatedDataEngine(stack.dataEngine)
}
