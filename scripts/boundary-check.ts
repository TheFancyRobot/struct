#!/usr/bin/env bun
/**
 * boundary-check.ts — Bun-aware import boundary checker.
 *
 * dependency-cruiser resolves relative imports well but may not resolve
 * Bun workspace specifiers (@struct/*). This script provides a deterministic
 * second-pass check for workspace-specifier cross-app and cross-package
 * violations.
 *
 * Rules enforced (matching dependency-cruiser rules + workspace specifiers):
 * - No app may import another app (relative OR @struct/* specifier)
 * - No package may import any app
 * - @struct/domain is the leaf: it imports no internal packages
 *
 * Usage: bun run scripts/boundary-check.ts [apps packages]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'

const rootDir = process.cwd()
const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['apps', 'packages']

interface Violation {
  file: string
  line: number
  import: string
  rule: string
  message: string
}

const violations: Violation[] = []

// Workspace package name → directory mapping
const workspaceMap = new Map<string, string>()
for (const dir of ['apps', 'packages']) {
  const base = join(rootDir, dir)
  try {
    for (const name of readdirSync(base)) {
      const pkgPath = join(base, name, 'package.json')
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name) workspaceMap.set(pkg.name, join(dir, name))
      } catch {
        // not a package
      }
    }
  } catch {
    // dir doesn't exist
  }
}

// Forbidden import patterns per source directory
function getViolations(
  sourceDir: string,  // e.g. 'apps/web'
  importPath: string,  // e.g. '@struct/api' or '../../api/src/main.ts'
  file: string,
  line: number,
): Violation[] {
  const results: Violation[] = []
  const app = sourceDir.split('/')[1] // 'web', 'api', 'worker'
  const isApp = sourceDir.startsWith('apps/')

  // Resolve workspace specifier to directory
  let resolvedDir = importPath
  if (importPath.startsWith('@struct/')) {
    const pkgDir = workspaceMap.get(importPath)
    if (pkgDir) {
      resolvedDir = pkgDir
    }
  }

  // Resolve relative imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    // Try to resolve relative to file
    const resolved = resolve(dirname(file), importPath).replace(rootDir + '/', '')
    // Find which app/package it belongs to
    if (resolved.startsWith('apps/') || resolved.startsWith('packages/')) {
      resolvedDir = resolved.split('/').slice(0, 2).join('/')
    }
  }

  // Check app-to-app imports
  if (isApp && resolvedDir.startsWith('apps/')) {
    const targetApp = resolvedDir.split('/')[1]
    if (targetApp !== app) {
      results.push({
        file: relative(rootDir, file),
        line,
        import: importPath,
        rule: 'no-app-to-app',
        message: `apps/${app} must not import apps/${targetApp}. Cross-app communication is via HTTP only.`,
      })
    }
  }

  // Check package importing app
  if (sourceDir.startsWith('packages/') && resolvedDir.startsWith('apps/')) {
    results.push({
      file: relative(rootDir, file),
      line,
      import: importPath,
      rule: 'no-package-imports-app',
      message: `Packages must not import apps. Dependency direction is downward only.`,
    })
  }

  // Check domain leaf rule
  if (sourceDir === 'packages/domain' && (resolvedDir.startsWith('packages/') || resolvedDir.startsWith('apps/'))) {
    if (!resolvedDir.startsWith('packages/domain')) {
      results.push({
        file: relative(rootDir, file),
        line,
        import: importPath,
        rule: 'domain-is-leaf',
        message: `@struct/domain is the leaf package; it must not import other internal packages.`,
      })
    }
  }

  return results
}

// Collect all .ts and .tsx files in target dirs
function* walk(dir: string): Generator<string> {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.local') continue
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        yield* walk(full)
      } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
        if (!full.endsWith('.test.ts') && !full.endsWith('.d.ts')) {
          yield full
        }
      }
    }
  } catch {
    // dir doesn't exist
  }
}

const importRegex = /^\s*import\s+[^'"]*['"`]([^'"`]+)['"`]/gm

for (const target of targets) {
  const targetPath = join(rootDir, target)
  for (const file of walk(targetPath)) {
    const sourceDir = relative(rootDir, file).split('/').slice(0, 2).join('/')
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const match = importRegex.exec(lines[i])
      if (match) {
        const importPath = match[1]
        // Only check internal imports (relative or @struct/*)
        if (importPath.startsWith('.') || importPath.startsWith('@struct/')) {
          violations.push(...getViolations(sourceDir, importPath, file, i + 1))
        }
      }
    }
    importRegex.lastIndex = 0
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`  error ${v.rule}: ${v.file}:${v.line} → ${v.import} — ${v.message}`)
  }
  console.error(`\nx ${violations.length} boundary violations (${violations.length} errors)`)
  process.exit(1)
} else {
  console.log('✔ no boundary violations found')
}
