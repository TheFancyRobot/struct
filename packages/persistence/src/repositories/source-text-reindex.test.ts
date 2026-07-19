import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import {
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  SourceTextReindexOwnershipLostError,
  SourceTextReindexRepo,
  SqlClientTest,
} from '../index.js'

const sourceVersionId =
  SourceVersionId.make('c60e8400-e29b-41d4-a716-446655440000')
const workspaceId = WorkspaceId.make('c60e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('c60e8400-e29b-41d4-a716-446655440002')
const job = {
  sourceVersionId,
  workspaceId,
  projectId,
  artifactRef: 'artifact://sha256/reindex',
  contentHash: 'sha256:reindex',
  status: 'in-progress',
  attempts: 2,
  maxAttempts: 3,
} as const

describe('SourceTextReindexRepo lease ownership', () => {
  it('renews only the exact source-version, workspace, project, and attempt', async () => {
    const calls: Array<{
      readonly query: string
      readonly params?: readonly unknown[]
    }> = []
    const layer = Layer.provide(
      SourceTextReindexRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        return [{ source_version_id: sourceVersionId }]
      }),
    )

    await Effect.runPromise(
      SourceTextReindexRepo.renewLease(job).pipe(Effect.provide(layer)),
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.query).toMatch(/SET updated_at = NOW\(\)/i)
    expect(calls[0]?.query).toMatch(/source_version_id = \$1/i)
    expect(calls[0]?.query).toMatch(/workspace_id = \$2/i)
    expect(calls[0]?.query).toMatch(/project_id = \$3/i)
    expect(calls[0]?.query).toMatch(/status = 'in-progress'/i)
    expect(calls[0]?.query).toMatch(/attempts = \$4/i)
    expect(calls[0]?.params).toEqual([
      sourceVersionId,
      workspaceId,
      projectId,
      2,
    ])
  })

  it('reports expected ownership loss when the exact lease is absent', async () => {
    const layer = Layer.provide(
      SourceTextReindexRepo.Default,
      SqlClientTest(async () => []),
    )

    const exit = await Effect.runPromiseExit(
      SourceTextReindexRepo.renewLease(job).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(String(exit)).toContain(SourceTextReindexOwnershipLostError.name)
    expect(String(exit)).toContain('renew-lease')
  })

  it('uses a duration against the PostgreSQL clock for both stale transitions', async () => {
    const calls: Array<{
      readonly query: string
      readonly params?: readonly unknown[]
    }> = []
    const layer = Layer.provide(
      SourceTextReindexRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        return []
      }),
    )

    await Effect.runPromise(
      SourceTextReindexRepo.recoverStale(300_000).pipe(Effect.provide(layer)),
    )

    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call.query).toMatch(
        /updated_at < NOW\(\) - \(\$1 \* INTERVAL '1 millisecond'\)/i,
      )
      expect(call.query).not.toMatch(/to_timestamp/i)
      expect(call.params).toEqual([300_000])
    }
  })

  it('fences failure recording by the complete claimed aggregate', async () => {
    const calls: Array<{
      readonly query: string
      readonly params?: readonly unknown[]
    }> = []
    const layer = Layer.provide(
      SourceTextReindexRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        return [{ source_version_id: sourceVersionId }]
      }),
    )

    await Effect.runPromise(
      SourceTextReindexRepo.recordFailure(job, 'artifact-unavailable').pipe(
        Effect.provide(layer),
      ),
    )

    expect(calls[0]?.query).toMatch(/workspace_id = \$4/i)
    expect(calls[0]?.query).toMatch(/project_id = \$5/i)
    expect(calls[0]?.params).toEqual([
      sourceVersionId,
      'artifact-unavailable',
      2,
      workspaceId,
      projectId,
    ])
  })
})
