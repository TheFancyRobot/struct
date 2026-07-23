export type ParityIssueKind = 'snapshot-status' | 'context-status'

export type ParityIssue = {
  readonly kind: ParityIssueKind
  readonly path: string
  readonly canonicalStatus: string
  readonly snapshotStatus: string | null
  readonly contextStatus: string | null
}

const completedStatuses = new Set(['completed', 'merged'])
const staleSnapshotStatuses = new Set(['planned', 'in_progress'])

function normalizeValue(value: string | null): string | null {
  if (value === null) return null
  return value.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
}

function extractTopLevelValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return normalizeValue(match?.[1] ?? null)
}

function extractFrontmatter(text: string): string | null {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  return match?.[1] ?? null
}

function extractSnapshotStatus(text: string): string | null {
  const block = text.match(
    /<!-- AGENT-START:step-agent-managed-snapshot -->\n([\s\S]*?)\n<!-- AGENT-END:step-agent-managed-snapshot -->/,
  )?.[1]
  if (block === undefined) return null
  const match = block.match(/^- Status:\s*(.+)$/m)
  return normalizeValue(match?.[1] ?? null)
}

export async function findCompletedStepParityIssues(root = '.agent-vault'): Promise<ParityIssue[]> {
  const issues: ParityIssue[] = []
  const glob = new Bun.Glob('02_Phases/Phase_*/Steps/Step_*.md')

  for await (const relativePath of glob.scan({ cwd: root, onlyFiles: true })) {
    const text = await Bun.file(`${root}/${relativePath}`).text()
    const frontmatter = extractFrontmatter(text)
    if (frontmatter === null) continue

    const canonicalStatus = extractTopLevelValue(frontmatter, 'status')
    if (canonicalStatus === null || !completedStatuses.has(canonicalStatus)) continue

    const snapshotStatus = extractSnapshotStatus(text)
    const contextStatus = extractTopLevelValue(frontmatter, 'context_status')

    if (snapshotStatus !== null && staleSnapshotStatuses.has(snapshotStatus)) {
      issues.push({
        kind: 'snapshot-status',
        path: relativePath,
        canonicalStatus,
        snapshotStatus,
        contextStatus,
      })
    }

    if (contextStatus === 'active') {
      issues.push({
        kind: 'context-status',
        path: relativePath,
        canonicalStatus,
        snapshotStatus,
        contextStatus,
      })
    }
  }

  return issues.sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind))
}

function formatIssue(issue: ParityIssue) {
  if (issue.kind === 'snapshot-status') {
    return `${issue.path}: canonical status is ${issue.canonicalStatus} but snapshot status is ${issue.snapshotStatus}`
  }
  return `${issue.path}: canonical status is ${issue.canonicalStatus} but context_status is ${issue.contextStatus}`
}

async function main() {
  const root = process.argv[2] ?? '.agent-vault'
  const issues = await findCompletedStepParityIssues(root)

  if (issues.length > 0) {
    console.error(`Vault semantic parity failed (${issues.length} issues):\n${issues.map(formatIssue).join('\n')}`)
    process.exit(1)
  }

  console.log(`Vault semantic parity passed for ${root}.`)
}

if (import.meta.main) {
  await main()
}
