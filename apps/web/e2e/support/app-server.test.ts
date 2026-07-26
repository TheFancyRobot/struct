import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { resolve } from 'node:path'
import {
  isolatedDataEngineGatewayRunCommand,
  isolatedDataEngineNetworkCreateCommand,
  isolatedDataEngineRunCommand,
  prepareRealStackEnvironment,
  startAppServer,
  startDependencyContainers,
  startIsolatedDataEngineGateway,
  stopAppServer,
  waitForReady,
  type CapturedProcess,
} from './app-server'

const webRoot = resolve(import.meta.dir, '../..')
const repositoryRoot = resolve(webRoot, '../..')
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
  it('binds the release artifact root into a disposable no-egress data-engine', () => {
    const command = isolatedDataEngineRunCommand(
      'struct-e2e-data-engine-test',
      'struct-e2e-data-engine-test',
      'test-data-engine-token',
    )
    const gateway = isolatedDataEngineGatewayRunCommand(
      'struct-e2e-data-engine-gateway-test',
      4195,
      'test-data-engine-token',
    )
    const network = isolatedDataEngineNetworkCreateCommand(
      'struct-e2e-data-engine-test',
    )

    expect(command).toContain('--rm')
    expect(command).toContain('--read-only')
    expect(command).toContain('no-new-privileges:true')
    expect(command).not.toContain('--publish')
    expect(command[command.indexOf('--network') + 1]).toBe(
      'struct-e2e-data-engine-test',
    )
    expect(command).toContain(
      `type=bind,source=${resolve(repositoryRoot, '.local/e2e/workspace-release-artifacts')},target=/artifacts,readonly`,
    )
    expect(command).toContain('data-engine')
    expect(network).toEqual([
      'docker',
      'network',
      'create',
      '--internal',
      'struct-e2e-data-engine-test',
    ])
    expect(gateway).toContain('127.0.0.1:4195:4300')
    expect(gateway).toContain('gateway.mjs')
  })

  it('retries only Docker gateway bind failures with fresh ports and a bounded attempt count', async () => {
    const attemptedPorts: string[] = []
    const removedGateways: string[] = []
    const availablePorts = [4196, 4197]

    await expect(startIsolatedDataEngineGateway(
      'struct-e2e-data-engine-gateway-test',
      4195,
      'test-data-engine-token',
      {
        availableLoopbackPort: async () => availablePorts.shift()!,
        removeGateway: async (gatewayName) => {
          removedGateways.push(gatewayName)
        },
        runCommand: async (_name, command) => {
          attemptedPorts.push(command[command.indexOf('--publish') + 1]!)
          throw new Error('Bind for 127.0.0.1 failed: port is already allocated')
        },
      },
    )).rejects.toThrow('port is already allocated')

    expect(attemptedPorts).toEqual([
      '127.0.0.1:4195:4300',
      '127.0.0.1:4196:4300',
      '127.0.0.1:4197:4300',
    ])
    expect(removedGateways).toEqual([
      'struct-e2e-data-engine-gateway-test',
      'struct-e2e-data-engine-gateway-test',
    ])

    let allocated = false
    await expect(startIsolatedDataEngineGateway(
      'struct-e2e-data-engine-gateway-test',
      4195,
      'test-data-engine-token',
      {
        availableLoopbackPort: async () => {
          allocated = true
          return 4196
        },
        runCommand: async () => {
          throw new Error('Docker image is unavailable')
        },
      },
    )).rejects.toThrow('Docker image is unavailable')
    expect(allocated).toBe(false)
  })

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

  it('surfaces nonzero dependency start exits', async () => {
    await expect(startDependencyContainers([
      'bun',
      '-e',
      'process.exit(7)',
    ])).rejects.toThrow('dependency start failed (7)')
  })

  it('resolves the live data-engine token before verifying a healthy pre-existing stack', async () => {
    const calls: string[] = []
    const commandEnvironments = new Map<string, Readonly<Record<string, string>>>()
    const originalToken = process.env['DATA_ENGINE_TOKEN']
    process.env['DATA_ENGINE_TOKEN'] = 'shell-data-engine-token'

    try {
      const environment = await prepareRealStackEnvironment(4192, {
        startDependencyContainers: async () => {
          calls.push('dependency start')
        },
        runCommand: async (name, _command, _cwd, environment) => {
          calls.push(name)
          commandEnvironments.set(name, environment)
        },
        resolveDataEngineToken: async () => {
          calls.push('resolve token')
          return 'live-data-engine-token'
        },
        resetDatabase: async () => {
          calls.push('reset database')
        },
      })

      expect(calls).toEqual([
        'dependency start',
        'resolve token',
        'dependency check',
        'reset database',
      ])
      expect(commandEnvironments.get('dependency check')).toMatchObject({
        DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct',
        DATA_ENGINE_TOKEN: 'live-data-engine-token',
      })
      expect(environment['DATA_ENGINE_TOKEN']).toBe('live-data-engine-token')
    } finally {
      if (originalToken === undefined) {
        delete process.env['DATA_ENGINE_TOKEN']
      } else {
        process.env['DATA_ENGINE_TOKEN'] = originalToken
      }
    }
  })

  it('falls back to stack:up from a clean environment and resolves the data-engine token afterward', async () => {
    const calls: string[] = []
    const databaseResets: Readonly<Record<string, string>>[] = []
    const commandEnvironments = new Map<string, Readonly<Record<string, string>>>()
    const originalToken = process.env['DATA_ENGINE_TOKEN']
    process.env['DATA_ENGINE_TOKEN'] = 'short'

    try {
      const environment = await prepareRealStackEnvironment(4193, {
        startDependencyContainers: async () => {
          calls.push('dependency start')
          throw new Error('dependency start failed (1)\nNo such container: struct-postgres')
        },
        runCommand: async (name, _command, _cwd, environment) => {
          calls.push(name)
          commandEnvironments.set(name, environment)
        },
        resolveDataEngineToken: async () => {
          calls.push('resolve token')
          return 'resolved-data-engine-token'
        },
        resetDatabase: async (environment) => {
          calls.push('reset database')
          databaseResets.push(environment)
        },
      })

      expect(calls).toEqual([
        'dependency start',
        'dependency stack',
        'resolve token',
        'dependency check',
        'reset database',
      ])
      expect(commandEnvironments.get('dependency stack')).toMatchObject({
        DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct',
        DATA_ENGINE_TOKEN: 'struct-local-data-engine-token',
      })
      expect(commandEnvironments.get('dependency check')).toMatchObject({
        DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct',
        DATA_ENGINE_TOKEN: 'resolved-data-engine-token',
      })
      expect(environment['DATA_ENGINE_TOKEN']).toBe('resolved-data-engine-token')
      expect(environment['DATABASE_URL']).toBe('postgres://struct:struct@127.0.0.1:5432/struct_e2e_workspace_release')
      expect(databaseResets).toEqual([environment])
    } finally {
      if (originalToken === undefined) {
        delete process.env['DATA_ENGINE_TOKEN']
      } else {
        process.env['DATA_ENGINE_TOKEN'] = originalToken
      }
    }
  })

  it('reruns dependency verification after stack fallback refreshes the environment', async () => {
    const calls: string[] = []
    const dependencyChecks: Readonly<Record<string, string>>[] = []

    const environment = await prepareRealStackEnvironment(4194, {
      startDependencyContainers: async () => {
        calls.push('dependency start')
      },
      runCommand: async (name, _command, _cwd, environment) => {
        calls.push(name)
        if (name === 'dependency check') {
          dependencyChecks.push(environment)
          if (dependencyChecks.length === 1) {
            throw new Error('dependency check failed (1)')
          }
        }
      },
      resolveDataEngineToken: async () => {
        calls.push('resolve token')
        return calls.filter((call) => call === 'resolve token').length === 1
          ? 'stale-data-engine-token'
          : 'fresh-data-engine-token'
      },
      resetDatabase: async () => {
        calls.push('reset database')
      },
    })

    expect(calls).toEqual([
      'dependency start',
      'resolve token',
      'dependency check',
      'dependency stack',
      'resolve token',
      'dependency check',
      'reset database',
    ])
    expect(dependencyChecks).toEqual([
      {
        DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct',
        DATA_ENGINE_TOKEN: 'stale-data-engine-token',
      },
      {
        DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct',
        DATA_ENGINE_TOKEN: 'fresh-data-engine-token',
      },
    ])
    expect(environment['DATA_ENGINE_TOKEN']).toBe('fresh-data-engine-token')
  })

  it('keeps bootstrap failures diagnosable when stack fallback also fails', async () => {
    await expect(prepareRealStackEnvironment(4194, {
      startDependencyContainers: async () => {
        throw new Error('dependency start failed (1)\nNo such container: struct-postgres')
      },
      runCommand: async (name) => {
        if (name === 'dependency stack') {
          throw new Error('dependency stack failed (2)\ncompose logs')
        }
      },
      resolveDataEngineToken: async () => 'resolved-data-engine-token',
      resetDatabase: async () => {},
    })).rejects.toThrow(
      'dependency stack fallback failed after dependency start failed (1)\nNo such container: struct-postgres\n\ndependency stack failed (2)\ncompose logs',
    )
  })

  it('times out hung readiness probes instead of spending the whole startup budget in one fetch', async () => {
    const hangingServer = createHttpServer((_request, _response) => {
      // Accept the connection and intentionally never finish the response.
    })
    await new Promise<void>((resolveStart, reject) => {
      hangingServer.once('error', reject)
      hangingServer.listen(0, '127.0.0.1', () => resolveStart())
    })
    const address = hangingServer.address()
    if (!address || typeof address === 'string') {
      hangingServer.close()
      throw new Error('Could not allocate a hanging readiness port')
    }

    const child = Bun.spawn(['bun', '-e', 'setInterval(() => {}, 1000)'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const process: CapturedProcess = {
      name: 'hung readiness probe',
      process: child,
      logs: Promise.resolve('probe logs'),
    }

    const startedAt = Date.now()
    try {
      await expect(waitForReady(
        process,
        `http://127.0.0.1:${address.port}`,
        {
          maxWaitMs: 80,
          probeTimeoutMs: 20,
          retryIntervalMs: 1,
        },
      )).rejects.toThrow('hung readiness probe did not become ready')
      expect(Date.now() - startedAt).toBeLessThan(500)
    } finally {
      hangingServer.closeAllConnections()
      await new Promise<void>((resolveStop) => hangingServer.close(() => resolveStop()))
      if (child.exitCode === null) child.kill()
      await child.exited
    }
  })
})
