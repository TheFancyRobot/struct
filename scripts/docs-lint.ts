import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const rg = Bun.which('rg')
if (rg === null) {
  console.error('Failed to enumerate Markdown files: rg is not installed.')
  process.exit(1)
}
const discovery = Bun.spawnSync([rg, '--files', '-g', '*.md'], {
  stdout: 'pipe',
  stderr: 'pipe',
})
if (!discovery.success) {
  console.error(
    `Failed to enumerate Markdown files with rg: ${discovery.stderr.toString().trim() || `exit ${discovery.exitCode}`}`,
  )
  process.exit(1)
}
const markdownFiles = discovery.stdout.toString().trim().split('\n').filter(Boolean)
const missing: string[] = []
const headingCache = new Map<string, Set<string>>()

const headingIds = async (file: string): Promise<Set<string>> => {
  const cached = headingCache.get(file)
  if (cached !== undefined) return cached
  const ids = new Set<string>()
  const occurrences = new Map<string, number>()
  const text = await Bun.file(file).text()
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = match[1]!
      .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_~]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
    const occurrence = occurrences.get(base) ?? 0
    occurrences.set(base, occurrence + 1)
    ids.add(occurrence === 0 ? base : `${base}-${occurrence}`)
  }
  headingCache.set(file, ids)
  return ids
}

for (const file of markdownFiles) {
  const text = await Bun.file(file).text()
  for (const match of text.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1]!
    if (/^(?:https?:|mailto:)/.test(target)) continue
    const [rawPath = '', rawFragment] = target.split('#', 2)
    const path = decodeURIComponent(rawPath)
    const resolved = path === '' ? resolve(file) : resolve(dirname(file), path)
    if (!existsSync(resolved)) {
      missing.push(`${file}: ${target}`)
      continue
    }
    if (
      rawFragment !== undefined
      && resolved.endsWith('.md')
      && !(await headingIds(resolved)).has(decodeURIComponent(rawFragment))
    ) {
      missing.push(`${file}: ${target}`)
    }
  }
}

if (missing.length > 0) {
  console.error(`Broken local Markdown links:\n${missing.join('\n')}`)
  process.exit(1)
}

console.log(`Validated local links in ${markdownFiles.length} Markdown files.`)
