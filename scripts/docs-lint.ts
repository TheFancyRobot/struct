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

for (const file of markdownFiles) {
  const text = await Bun.file(file).text()
  for (const match of text.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1]!
    if (/^(?:https?:|mailto:|#)/.test(target)) continue
    const path = decodeURIComponent(target.split('#', 1)[0]!)
    if (path === '') continue
    if (!existsSync(resolve(dirname(file), path))) {
      missing.push(`${file}: ${target}`)
    }
  }
}

if (missing.length > 0) {
  console.error(`Broken local Markdown links:\n${missing.join('\n')}`)
  process.exit(1)
}

console.log(`Validated local links in ${markdownFiles.length} Markdown files.`)
