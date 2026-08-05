import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import { ProjectId, ResearchRunId, WorkspaceId } from '@struct/domain'
import { SqlClientTest } from '../sql-client.js'
import { ResearchProjectionRepo } from './research-projections.js'

const workspaceId = WorkspaceId.make('c50e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('c50e8400-e29b-41d4-a716-446655440002')
const firstRunId = ResearchRunId.make('c50e8400-e29b-41d4-a716-446655440003')
const secondRunId = ResearchRunId.make('c50e8400-e29b-41d4-a716-446655440004')

describe('ResearchProjectionRepo completed history', () => {
  it('loads completed projections for a run batch with one scoped query', async () => {
    const queries: Array<{ readonly query: string; readonly params: readonly unknown[] | undefined }> = []
    const layer = Layer.provide(ResearchProjectionRepo.Default, SqlClientTest(async (query, params) => {
      queries.push({ query, params })
      return [{
        run_id: firstRunId,
        answer: 'First answer.',
        citations: [],
        dataset_citations: [],
      }, {
        run_id: secondRunId,
        answer: 'Second answer.',
        citations: [],
        dataset_citations: [],
      }]
    }))

    const projections = await Effect.runPromise(
      ResearchProjectionRepo.findCompletedByRunIds(
        workspaceId,
        projectId,
        [firstRunId, secondRunId],
      ).pipe(Effect.provide(layer)),
    )

    expect(queries).toHaveLength(1)
    expect(queries[0]?.query).toMatch(/result\.run_id = ANY\(\$1::uuid\[\]\)/)
    expect(queries[0]?.params).toEqual([[firstRunId, secondRunId], projectId, workspaceId])
    expect(projections.get(firstRunId)?.answer).toBe('First answer.')
    expect(projections.get(secondRunId)?.answer).toBe('Second answer.')
  })
})
