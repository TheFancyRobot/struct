const repositoryPaths = Bun.spawnSync([
  'rg',
  '--files',
  '--hidden',
  '-g',
  '!.git/**',
], {
  stdout: 'pipe',
}).stdout.toString().split('\n').filter(Boolean)

const secretPatterns: ReadonlyArray<readonly [string, RegExp]> = [
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g],
  ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
]
const findings: string[] = []

for (const file of repositoryPaths) {
  if (file === '.env.example') continue
  const blob = Bun.file(file)
  if (!(await blob.exists()) || blob.size > 2_000_000) continue
  const text = await blob.text()
  if (text.includes('\0')) continue
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0
    if (pattern.test(text)) findings.push(`${file}: ${label}`)
  }
}

if (findings.length > 0) {
  console.error(`Potential committed secrets:\n${findings.join('\n')}`)
  process.exit(1)
}

console.log(
  `Scanned ${repositoryPaths.length} repository paths for committed secrets.`,
)
