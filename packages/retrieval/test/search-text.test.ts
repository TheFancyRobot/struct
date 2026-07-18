import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClientTest } from '@struct/persistence'
import { TextRetrieval } from '../src/search-text'

const workspaceId = WorkspaceId.make('a50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('a50e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make('a50e8400-e29b-41d4-a716-446655440002')

describe('TextRetrieval', () => {
  it('uses bounded PostgreSQL FTS scoped to workspace, project, and immutable versions', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      return [{
        source_version_id: sourceVersionId,
        content: 'Alpha\nThe launch date is July 18.\nOmega',
        rank: 0.75,
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'launch date',
        limit: 3,
      }).pipe(Effect.provide(layer)),
    )

    expect(calls[0]?.query).toMatch(/websearch_to_tsquery/)
    expect(calls[0]?.query).toMatch(/source_version_id = ANY/)
    expect(calls[0]?.params?.slice(0, 3)).toEqual([
      workspaceId,
      projectId,
      [sourceVersionId],
    ])
    expect(result.evidence).toEqual([{
      sourceVersionId,
      locator: 'lines:2-3',
      excerpt: 'The launch date is July 18.\nOmega',
      rank: 0.75,
    }])
  })

  it('indexes normalized text idempotently without changing source-version identity', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return []
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    await Effect.runPromise(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'normalized text',
      }).pipe(Effect.provide(layer)),
    )

    expect(calls.join('\n')).toMatch(/ON CONFLICT \(source_version_id\) DO NOTHING/)
  })
})
