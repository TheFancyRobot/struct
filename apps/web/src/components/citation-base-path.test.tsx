/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { Schema } from 'effect'
import {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  WorkspaceId,
  RecursiveRunProgress,
} from '@struct/domain'
import { PartialFindingsPanel } from './PartialFindingsPanel'
import { reportCitationPath, researchCitationPath } from './citation-paths'

const sha = (digit: string) => `sha256:${digit.repeat(64)}`
const progress = Schema.decodeUnknownSync(RecursiveRunProgress)({
  runId: ResearchRunId.make('d70e8400-e29b-41d4-a716-446655440001'),
  workspaceId: WorkspaceId.make('d70e8400-e29b-41d4-a716-446655440002'),
  requestId: sha('1'),
  planId: sha('2'),
  status: 'partial',
  cancellation: 'none',
  recoveryCount: 1,
  expectedPartitions: 2,
  committedPartitions: 1,
  failedPartitions: 0,
  partitions: [{
    id: sha('3'),
    nodeId: sha('4'),
    ordinal: 0,
    status: 'committed',
    attempt: 1,
    batches: [{
      id: sha('5'),
      status: 'committed',
      attempt: 1,
      evidenceIds: [sha('6')],
      updatedAt: 1_700_000_000_000,
    }],
    failureTag: null,
    startedAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_001,
  }],
  result: {
    status: 'partial',
    coverage: {
      id: sha('7'),
      expectedItems: 2,
      examinedItems: 1,
      missingItems: 1,
      excludedItems: 0,
      expectedPartitions: 2,
      examinedPartitions: 1,
      status: 'partial',
    },
    findings: [{
      id: sha('8'),
      claimSignature: sha('9'),
      claim: 'The retained evidence supports the operational finding.',
      evidence: [{
        id: sha('6'),
        sourceVersionId: SourceVersionId.make(
          'd70e8400-e29b-41d4-a716-446655440003',
        ),
        artifact: {
          digest: sha('a'),
          byteLength: 128,
          mediaType: 'application/json',
        },
        locator: 'document:lines:12-14',
      }],
      confidence: 0.8,
      importance: 0.7,
      coverage: {
        id: sha('7'),
        expectedItems: 2,
        examinedItems: 1,
        missingItems: 1,
        excludedItems: 0,
        expectedPartitions: 2,
        examinedPartitions: 1,
        status: 'partial',
      },
      supportingExamples: [sha('6')],
      counterEvidence: [],
      contradictions: [],
      limitations: ['One partition has not committed.'],
      tags: ['operations'],
    }],
    contradictions: [],
    missingEvidence: ['partition-2'],
    excludedEvidence: [],
    limitations: ['One partition has not committed.'],
    citations: [{
      citationId: 'd70e8400-e29b-41d4-a716-446655440006',
      evidenceId: sha('6'),
      sourceVersionId: 'd70e8400-e29b-41d4-a716-446655440003',
      locator: 'document:lines:12-14',
    }],
    updatedAt: 1_700_000_000_001,
  },
  updatedAt: 1_700_000_000_001,
})

async function withBaseUrl<T>(baseUrl: string | undefined, load: () => Promise<T>): Promise<T> {
  const env = import.meta.env as Record<string, string | undefined>
  const previousBaseUrl = env.BASE_URL
  env.BASE_URL = baseUrl
  try {
    return await load()
  } finally {
    env.BASE_URL = previousBaseUrl
  }
}

describe('citation navigation base path regressions', () => {
  it('renders partial finding citation links under a configured base path', async () => {
    const result = progress.result
    if (result === null) throw new Error('Expected partial result')

    const html = await withBaseUrl('/struct/', async () => renderToString(() => (
      <PartialFindingsPanel
        projectId={ProjectId.make('d70e8400-e29b-41d4-a716-446655440004')}
        threadId={ResearchThreadId.make('d70e8400-e29b-41d4-a716-446655440005')}
        result={result}
      />
    )))

    expect(html).toContain(
      'href="/struct/projects/d70e8400-e29b-41d4-a716-446655440004/research/d70e8400-e29b-41d4-a716-446655440005/citation/d70e8400-e29b-41d4-a716-446655440006"',
    )
  })

  it('builds research citation links under a configured base path', async () => {
    const href = await withBaseUrl('/struct/', async () => researchCitationPath(
      'd70e8400-e29b-41d4-a716-446655440004',
      'd70e8400-e29b-41d4-a716-446655440005',
      'd70e8400-e29b-41d4-a716-446655440006',
    ))

    expect(href).toBe(
      '/struct/projects/d70e8400-e29b-41d4-a716-446655440004/research/d70e8400-e29b-41d4-a716-446655440005/citation/d70e8400-e29b-41d4-a716-446655440006',
    )
  })

  it('builds report citation links under a configured base path', async () => {
    const href = await withBaseUrl('/struct/', async () => reportCitationPath(
      'd70e8400-e29b-41d4-a716-446655440004',
      'd70e8400-e29b-41d4-a716-446655440005',
      'd70e8400-e29b-41d4-a716-446655440006',
      '/struct/projects/d70e8400-e29b-41d4-a716-446655440004/notebook?reportId=demo',
    ))

    expect(href).toBe(
      '/struct/projects/d70e8400-e29b-41d4-a716-446655440004/research/d70e8400-e29b-41d4-a716-446655440005/citation/d70e8400-e29b-41d4-a716-446655440006?returnTo=%2Fstruct%2Fprojects%2Fd70e8400-e29b-41d4-a716-446655440004%2Fnotebook%3FreportId%3Ddemo',
    )
  })
})
