import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultSnapshotId,
  ResearchRun,
  ResearchRunId,
  ResearchThreadId,
  Sha256Digest,
  WorkspaceId,
} from '@struct/domain'
import {
  researchHistoryResponse,
  serializeCompletedResearch,
  serializeResearchHistoryRuns,
} from './research-history'

const workspaceId = WorkspaceId.make('c50e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('c50e8400-e29b-41d4-a716-446655440002')

describe('research history response', () => {
  it('encodes completed dataset citations and prevents caching', async () => {
    const createdAt = 1_700_000_000_000n
    const completed = await Effect.runPromise(serializeCompletedResearch({
      answer: 'The dataset contains two records.',
      citations: [],
      datasetCitations: [{
        id: DatasetCitationId.make('c50e8400-e29b-41d4-a716-446655440003'),
        queryResultSnapshotId: QueryResultSnapshotId.make(
          'c50e8400-e29b-41d4-a716-446655440004',
        ),
        workspaceId,
        projectId,
        datasetId: DatasetId.make('c50e8400-e29b-41d4-a716-446655440005'),
        datasetSnapshotId: DatasetSnapshotId.make(
          'c50e8400-e29b-41d4-a716-446655440006',
        ),
        schemaHash: Sha256Digest.make(`sha256:${'a'.repeat(64)}`),
        parquetDigest: 'b'.repeat(64),
        resultHash: Sha256Digest.make(`sha256:${'c'.repeat(64)}`),
        resultArtifactHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
        canonicalSql: 'SELECT COUNT(*) AS row_count FROM "records" ORDER BY ALL',
        selectedColumns: ['row_count'],
        rowStart: 0,
        rowEndExclusive: 1,
        createdAt,
      }],
    }))

    const response = researchHistoryResponse({ runs: [{ result: completed }] })

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toMatchObject({
      runs: [{ result: { datasetCitations: [{ createdAt: Number(createdAt) }] } }],
    })
  })

  it('keeps completed runs without a projection as ordered metadata', async () => {
    const threadId = ResearchThreadId.make('c50e8400-e29b-41d4-a716-446655440010')
    const runs = [{
      id: ResearchRunId.make('c50e8400-e29b-41d4-a716-446655440013'),
      threadId,
      question: 'Newest completed run without a projection',
      status: 'completed',
      createdAt: 3n,
      updatedAt: 3n,
    }, {
      id: ResearchRunId.make('c50e8400-e29b-41d4-a716-446655440012'),
      threadId,
      question: 'Middle pending run',
      status: 'in-progress',
      createdAt: 2n,
      updatedAt: 2n,
    }, {
      id: ResearchRunId.make('c50e8400-e29b-41d4-a716-446655440011'),
      threadId,
      question: 'Oldest completed run with a projection',
      status: 'completed',
      createdAt: 1n,
      updatedAt: 1n,
    }] satisfies ReadonlyArray<typeof ResearchRun.Type>
    const history = await Effect.runPromise(serializeResearchHistoryRuns(
      runs,
      new Map([[runs[2]!.id, {
        answer: 'Stored answer.',
        citations: [],
        datasetCitations: [],
      }]]),
    ))

    expect(history.map((run) => run.question)).toEqual([
      'Oldest completed run with a projection',
      'Middle pending run',
      'Newest completed run without a projection',
    ])
    expect(history[0]).toMatchObject({
      status: 'completed',
      result: { answer: 'Stored answer.' },
    })
    expect(history[2]).toEqual({
      ...runs[0],
      createdAt: 3,
      updatedAt: 3,
    })
  })
})
