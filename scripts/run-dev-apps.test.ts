import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runWorkspaceDevApps } from './run-dev-apps'

describe('runWorkspaceDevApps', () => {
  it('passes the root environment through to filtered app dev scripts', () => {
    const root = mkdtempSync(join(tmpdir(), 'struct-run-dev-apps-'))

    try {
      mkdirSync(join(root, 'apps', 'env-probe'), { recursive: true })
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'tmp-root', private: true, workspaces: ['apps/*'] }, null, 2),
      )
      writeFileSync(
        join(root, 'apps', 'env-probe', 'package.json'),
        JSON.stringify(
          {
            name: '@tmp/env-probe',
            private: true,
            scripts: {
              dev: "bun -e \"console.log(process.env.DATABASE_URL ?? 'missing')\"",
            },
          },
          null,
          2,
        ),
      )

      const result = runWorkspaceDevApps({
        cwd: root,
        env: {
          ...process.env,
          DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct',
        },
        stdio: 'pipe',
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('postgres://struct:struct@127.0.0.1:5432/struct')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('root package.json dev script invokes scripts/run-dev-apps.ts', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.dev).toContain('bun run scripts/run-dev-apps.ts')
  })

  it('defaults to process.env when no explicit env override is provided', () => {
    const root = mkdtempSync(join(tmpdir(), 'struct-run-dev-apps-'))
    const originalDatabaseUrl = process.env.DATABASE_URL

    try {
      mkdirSync(join(root, 'apps', 'env-probe'), { recursive: true })
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'tmp-root', private: true, workspaces: ['apps/*'] }, null, 2),
      )
      writeFileSync(
        join(root, 'apps', 'env-probe', 'package.json'),
        JSON.stringify(
          {
            name: '@tmp/env-probe',
            private: true,
            scripts: {
              dev: "bun -e \"console.log(process.env.DATABASE_URL ?? 'missing')\"",
            },
          },
          null,
          2,
        ),
      )

      process.env.DATABASE_URL = 'postgres://struct:struct@127.0.0.1:5432/default-branch'

      const result = runWorkspaceDevApps({
        cwd: root,
        stdio: 'pipe',
      })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('postgres://struct:struct@127.0.0.1:5432/default-branch')
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = originalDatabaseUrl
      rmSync(root, { recursive: true, force: true })
    }
  })
})
