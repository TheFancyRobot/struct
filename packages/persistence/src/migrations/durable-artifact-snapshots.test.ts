import { describe, expect, it } from 'bun:test'

const up = await Bun.file(
  new URL('./0017_durable_artifact_snapshots.sql', import.meta.url),
).text()
const down = await Bun.file(
  new URL('./0017_durable_artifact_snapshots.down.sql', import.meta.url),
).text()
const lifecycle = await Bun.file(
  new URL('./0015_report_lifecycle.sql', import.meta.url),
).text()

describe('durable artifact snapshot migration', () => {
  it('allows multiple durable findings from one completed run', () => {
    expect(up).not.toMatch(/UNIQUE\s*\(\s*workspace_id\s*,\s*project_id\s*,\s*run_id\s*\)/i)
    expect(up).toMatch(/UNIQUE\s*\(\s*workspace_id\s*,\s*project_id\s*,\s*idempotency_key\s*\)/i)
  })

  it('makes finding and report revision snapshots append-only', () => {
    expect(up).toMatch(/CREATE TRIGGER finding_snapshots_append_only[\s\S]*BEFORE UPDATE OR DELETE/i)
    expect(lifecycle).toMatch(/CREATE TRIGGER report_revision_snapshots_append_only[\s\S]*BEFORE UPDATE OR DELETE/i)
    expect(down).toMatch(/DROP FUNCTION IF EXISTS reject_durable_artifact_snapshot_mutation/i)
  })

  it('requires a contiguous declared predecessor for every report revision', () => {
    expect(lifecycle).toMatch(
      /\(revision = 0 AND expected_previous_revision IS NULL\)[\s\S]*\(revision > 0 AND expected_previous_revision = revision - 1\)/i,
    )
  })
})
