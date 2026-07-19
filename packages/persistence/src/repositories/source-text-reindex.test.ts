import { describe, expect, it } from 'bun:test'
import { Effect, Layer, Option } from 'effect'
import {
  SourceTextReindexRepo,
  SqlClientTest,
} from '../index'

const row = {
  source_version_id: '650e8400-e29b-41d4-a716-446655440003',
  workspace_id: '650e8400-e29b-41d4-a716-446655440000',
  project_id: '650e8400-e29b-41d4-a716-446655440001',
  artifact_ref: 'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  content_hash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  status: 'in-progress',
  attempts: 1,
  max_attempts: 3,
}

describe('SourceTextReindexRepo', () => {
  it('claims one durable pending row with a restart-safe lease', async () => {
    const queries: string[] = []
    const layer = Layer.provide(
      SourceTextReindexRepo.Default,
      SqlClientTest(async (query) => {
        queries.push(query)
        return [row]
      }),
    )

    const claimed = await Effect.runPromise(
      SourceTextReindexRepo.claimNext().pipe(Effect.provide(layer)),
    )

    expect(Option.isSome(claimed)).toBe(true)
    expect(queries.join('\n')).toMatch(/FOR UPDATE SKIP LOCKED/i)
    expect(queries.join('\n')).toMatch(/attempts = attempts \+ 1/i)
  })

  it('requeues stale leases and terminal-fails exhausted work', async () => {
    const queries: string[] = []
    const layer = Layer.provide(
      SourceTextReindexRepo.Default,
      SqlClientTest(async (query) => {
        queries.push(query)
        return []
      }),
    )

    await Effect.runPromise(
      SourceTextReindexRepo.recoverStale(1_700_000_000_000).pipe(
        Effect.provide(layer),
      ),
    )

    expect(queries.join('\n')).toMatch(/status = 'pending'/i)
    expect(queries.join('\n')).toMatch(/status = 'failed'/i)
    expect(queries.join('\n')).toMatch(/attempts < max_attempts/i)
    expect(queries.join('\n')).toMatch(/attempts >= max_attempts/i)
  })

  it('records only a bounded error code and transitions by attempt budget', async () => {
    const queries: Array<{ query: string; params?: readonly unknown[] }> = []
    const layer = Layer.provide(
      SourceTextReindexRepo.Default,
      SqlClientTest(async (query, params) => {
        queries.push({ query, params })
        return query.includes('WITH next_job')
          ? [row]
          : [{ source_version_id: row.source_version_id }]
      }),
    )

    const claimed = await Effect.runPromise(
      SourceTextReindexRepo.claimNext().pipe(Effect.provide(layer)),
    )
    if (Option.isNone(claimed)) throw new Error('fixture was not claimed')
    await Effect.runPromise(
      SourceTextReindexRepo.recordFailure(
        claimed.value,
        'artifact-unavailable',
      ).pipe(Effect.provide(layer)),
    )

    const failure = queries.at(-1)
    expect(failure?.query).toMatch(/WHEN attempts >= max_attempts THEN 'failed'/i)
    expect(failure?.query).toMatch(/AND attempts = \$3/i)
    expect(failure?.params).toEqual([
      row.source_version_id,
      'artifact-unavailable',
      1,
    ])
  })
})
