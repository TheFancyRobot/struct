const git = Bun.which('git')
if (git === null) {
  console.error('Failed to enumerate repository paths: git is not installed.')
  process.exit(1)
}
const discovery = Bun.spawnSync([
  git,
  'ls-files',
  '-z',
  '--cached',
  '--others',
  '--exclude-standard',
], {
  stdout: 'pipe',
  stderr: 'pipe',
})
if (!discovery.success) {
  console.error(
    `Failed to enumerate repository paths with git: ${discovery.stderr.toString().trim() || `exit ${discovery.exitCode}`}`,
  )
  process.exit(1)
}
const repositoryPaths = discovery.stdout.toString().split('\0').filter(Boolean)

const secretPatterns: ReadonlyArray<readonly [string, RegExp]> = [
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g],
  ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
]
const findings: string[] = []

function isForbiddenEnvironmentPath(file: string): boolean {
  const basename = file.split('/').at(-1)
  return basename === '.env'
    || (
      basename?.startsWith('.env.') === true
      && basename !== '.env.example'
    )
}

function scanText(file: string, text: string): void {
  if (text.includes('\0')) return
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0
    if (pattern.test(text)) findings.push(`${file}: ${label}`)
  }
}

for (const file of repositoryPaths) {
  if (
    isForbiddenEnvironmentPath(file)
  ) {
    findings.push(`${file}: committed environment file`)
    continue
  }
  const blob = Bun.file(file)
  if (!(await blob.exists())) continue
  if (blob.size > 2_000_000) {
    findings.push(`${file}: file too large to scan safely`)
    continue
  }
  const text = await blob.text()
  scanText(file, text)
}

const baseCandidates = [
  process.env['GITHUB_BASE_REF'] === undefined
    ? undefined
    : `origin/${process.env['GITHUB_BASE_REF']}`,
  'origin/main',
  'main',
].filter((value): value is string => value !== undefined)
let mergeBase: string | undefined
for (const candidate of baseCandidates) {
  const result = Bun.spawnSync([git, 'merge-base', 'HEAD', candidate], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.success) {
    mergeBase = result.stdout.toString().trim()
    break
  }
}
if (mergeBase === undefined) {
  console.error('Failed to identify the base commit for secret history scanning.')
  process.exit(1)
}

const commits = Bun.spawnSync([git, 'rev-list', `${mergeBase}..HEAD`], {
  stdout: 'pipe',
  stderr: 'pipe',
})
if (!commits.success) {
  console.error('Failed to enumerate commits for secret history scanning.')
  process.exit(1)
}
const scannedHistoricalBlobs = new Set<string>()
for (const commit of commits.stdout.toString().split('\n').filter(Boolean)) {
  const tree = Bun.spawnSync([git, 'ls-tree', '-r', '-z', '--full-tree', commit], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (!tree.success) {
    console.error(`Failed to enumerate repository paths at commit ${commit}.`)
    process.exit(1)
  }
  for (const entry of tree.stdout.toString().split('\0').filter(Boolean)) {
    const separator = entry.indexOf('\t')
    const metadata = entry.slice(0, separator).split(' ')
    const file = entry.slice(separator + 1)
    const objectId = metadata[2]
    if (separator < 0 || objectId === undefined) continue
    const key = `${objectId}\0${file}`
    if (scannedHistoricalBlobs.has(key)) continue
    scannedHistoricalBlobs.add(key)
    const label = `${file} (${commit.slice(0, 12)})`
    if (isForbiddenEnvironmentPath(file)) {
      findings.push(`${label}: committed environment file`)
      continue
    }
    const size = Bun.spawnSync([git, 'cat-file', '-s', objectId], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (!size.success) {
      console.error(`Failed to inspect ${file} at commit ${commit}.`)
      process.exit(1)
    }
    if (Number(size.stdout.toString().trim()) > 2_000_000) {
      findings.push(`${label}: file too large to scan safely`)
      continue
    }
    const content = Bun.spawnSync([git, 'cat-file', 'blob', objectId], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (!content.success) {
      console.error(`Failed to read ${file} at commit ${commit}.`)
      process.exit(1)
    }
    scanText(label, content.stdout.toString())
  }
}

if (findings.length > 0) {
  console.error(`Potential committed secrets:\n${findings.join('\n')}`)
  process.exit(1)
}

console.log(
  `Scanned ${repositoryPaths.length} repository paths and ${scannedHistoricalBlobs.size} branch-history blobs for committed secrets.`,
)
