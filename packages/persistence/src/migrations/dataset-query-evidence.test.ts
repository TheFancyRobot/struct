import { describe, expect, it } from 'bun:test'

const upPath = new URL('./0012_dataset_query_evidence.sql', import.meta.url).pathname

describe('dataset query evidence migration contract', () => {
  it('pins the persisted engine version to the canonical data-engine runtime', async () => {
    const sql = await Bun.file(upPath).text()
    expect(sql).toMatch(
      /engine_version TEXT NOT NULL CHECK \(engine_version = 'duckdb-1\.5\.4'\)/i,
    )
  })
})
