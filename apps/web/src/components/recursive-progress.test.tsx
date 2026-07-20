/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component imports as used. */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { Schema } from 'effect'
import {
  ProjectId,
  RecursiveAnalysisRequestId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  WorkspaceId,
  RecursiveRunProgress,
} from '@struct/domain'
import { RecursiveRunTimeline } from './RecursiveRunTimeline'
import { PartialFindingsPanel } from './PartialFindingsPanel'
import { mergeRecursiveRead } from './recursive-progress-state'

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

describe('recursive progress Solid components', () => {
  it('does not let an older initial read overwrite newer streamed progress', () => {
    const older = { ...progress, updatedAt: progress.updatedAt - 1 }
    expect(mergeRecursiveRead(progress, older)).toBe(progress)
    const newer = { ...progress, updatedAt: progress.updatedAt + 1 }
    expect(mergeRecursiveRead(progress, newer)).toBe(newer)
    expect(mergeRecursiveRead(progress, {
      ...newer,
      requestId: RecursiveAnalysisRequestId.make(
        'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ),
    })).toBe(progress)
  })

  it('renders partition, recovery, and cancellation state', () => {
    const html = renderToString(() => (
      <RecursiveRunTimeline
        progress={progress}
        connected={false}
        reconnecting={true}
        cancelling={false}
        onCancel={() => undefined}
      />
    ))
    expect(html).toContain('Partition 1')
    expect(html).toContain('Reconnecting')
    expect(html).toContain('Cancel analysis')
    expect(html).toContain('1 evidence references')
  })

  it('renders partial caveats and exact citation navigation when validated', () => {
    const result = progress.result
    if (result === null) throw new Error('Expected partial result')
    const html = renderToString(() => (
      <PartialFindingsPanel
        projectId={ProjectId.make('d70e8400-e29b-41d4-a716-446655440004')}
        threadId={ResearchThreadId.make('d70e8400-e29b-41d4-a716-446655440005')}
        result={result}
      />
    ))
    expect(html).toContain('Use with care')
    expect(html).toContain('One partition has not committed')
    expect(html).toContain('Open exact citation')
    expect(html).toContain('/citation/d70e8400-e29b-41d4-a716-446655440006')
  })
})
