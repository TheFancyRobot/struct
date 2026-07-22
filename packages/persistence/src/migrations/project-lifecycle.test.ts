import { describe, expect, it } from 'bun:test'

const up = await Bun.file(
  new URL('./0018_project_lifecycle.sql', import.meta.url),
).text()
const down = await Bun.file(
  new URL('./0018_project_lifecycle.down.sql', import.meta.url),
).text()

describe('project lifecycle migration', () => {
  it('uses one composite uniqueness contract for project create idempotency keys', () => {
    expect(up).toMatch(/PRIMARY KEY\s*\(\s*workspace_id\s*,\s*idempotency_key\s*\)/i)
    expect(up).not.toMatch(/CREATE UNIQUE INDEX\s+project_idempotency_keys_workspace_key_idx/i)
  })

  it('drops only indexes that are still created by the up migration', () => {
    expect(down).not.toMatch(/project_idempotency_keys_workspace_key_idx/i)
    expect(down).toMatch(/DROP INDEX IF EXISTS project_idempotency_keys_project_idx/i)
  })
})
