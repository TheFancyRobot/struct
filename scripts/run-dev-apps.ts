import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '..')
const workspaceDevArgs = ['run', '--parallel', '--filter', './apps/*', 'dev'] as const

type RunWorkspaceDevAppsOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
  stdio?: 'inherit' | 'pipe'
}

export function runWorkspaceDevApps(options: RunWorkspaceDevAppsOptions = {}) {
  return spawnSync('bun', [...workspaceDevArgs], {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
    encoding: 'utf8',
  })
}

if (import.meta.main) {
  const result = runWorkspaceDevApps()
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}
