import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const markdownFiles = Bun.spawnSync(['rg', '--files', '-g', '*.md'], {
  stdout: 'pipe',
}).stdout.toString().trim().split('\n').filter(Boolean)
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
