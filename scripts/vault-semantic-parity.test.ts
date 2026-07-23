import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { findCompletedStepParityIssues } from './vault-semantic-parity'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function writeStep(root: string, relativePath: string, content: string) {
  const file = join(root, relativePath)
  await Bun.write(file, content)
}

function stepNote({
  status,
  contextStatus = 'completed',
  snapshotStatus = 'completed',
}: {
  status: string
  contextStatus?: string
  snapshotStatus?: string
}) {
  return `---
note_type: step
status: ${status}
context_status: ${contextStatus}
---

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: ${snapshotStatus}
- Current owner: Codex
- Last touched: 2026-07-22
- Next action: None.
<!-- AGENT-END:step-agent-managed-snapshot -->
`
}

describe('vault semantic parity', () => {
  it('reports completed steps whose agent snapshot still says planned or in_progress', async () => {
    const root = await mkdtemp(join(tmpdir(), 'struct-vault-parity-'))
    tempRoots.push(root)

    await writeStep(
      root,
      '02_Phases/Phase_01/Steps/Step_01_ok.md',
      stepNote({ status: 'completed', snapshotStatus: 'completed' }),
    )
    await writeStep(
      root,
      '02_Phases/Phase_01/Steps/Step_02_bad.md',
      stepNote({ status: 'completed', snapshotStatus: 'planned' }),
    )
    await writeStep(
      root,
      '02_Phases/Phase_01/Steps/Step_03_bad.md',
      stepNote({ status: 'completed', snapshotStatus: 'in_progress' }),
    )
    await writeStep(
      root,
      '02_Phases/Phase_01/Steps/Step_04_planned.md',
      stepNote({ status: 'planned', snapshotStatus: 'planned', contextStatus: 'active' }),
    )

    const issues = await findCompletedStepParityIssues(root)

    expect(issues.map(({ kind, path, snapshotStatus }) => ({ kind, path, snapshotStatus }))).toEqual([
      {
        kind: 'snapshot-status',
        path: '02_Phases/Phase_01/Steps/Step_02_bad.md',
        snapshotStatus: 'planned',
      },
      {
        kind: 'snapshot-status',
        path: '02_Phases/Phase_01/Steps/Step_03_bad.md',
        snapshotStatus: 'in_progress',
      },
    ])
  })

  it('reports completed steps whose context_status still says active', async () => {
    const root = await mkdtemp(join(tmpdir(), 'struct-vault-parity-'))
    tempRoots.push(root)

    await writeStep(
      root,
      '02_Phases/Phase_09/Steps/Step_06_bad.md',
      stepNote({ status: 'completed', contextStatus: 'active', snapshotStatus: 'completed' }),
    )

    const issues = await findCompletedStepParityIssues(root)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      kind: 'context-status',
      path: '02_Phases/Phase_09/Steps/Step_06_bad.md',
      canonicalStatus: 'completed',
      contextStatus: 'active',
      snapshotStatus: 'completed',
    })
  })
})
