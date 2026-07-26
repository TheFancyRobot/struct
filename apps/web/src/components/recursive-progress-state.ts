import { Schema } from 'effect'
import { CreateNoteRequest } from '@struct/domain'
import type * as typeDomain from '@struct/domain'

type CommittedRecursiveResultEvent = Extract<
  typeDomain.ResearchEvent,
  { readonly type: 'recursive-result-progress-committed' }
>
type SaveableResearchEvent = Extract<
  typeDomain.ResearchEvent,
  {
    readonly type:
      | 'research-completed'
      | 'recursive-result-progress-committed'
  }
>

export function recursiveResultNoteBody(
  result: typeDomain.RecursiveResultProgress,
): string {
  const lines = [
    `Status: ${result.status}`,
    '',
    'Coverage',
    `- Status: ${result.coverage.status}`,
    `- Expected items: ${result.coverage.expectedItems}`,
    `- Examined items: ${result.coverage.examinedItems}`,
    `- Missing items: ${result.coverage.missingItems}`,
    `- Excluded items: ${result.coverage.excludedItems}`,
    `- Expected partitions: ${result.coverage.expectedPartitions}`,
    `- Examined partitions: ${result.coverage.examinedPartitions}`,
    '',
    'Findings',
  ]
  for (const [index, finding] of result.findings.entries()) {
    lines.push('', `${index + 1}. ${finding.claim}`)
    for (const limitation of finding.limitations) {
      lines.push(`   - Limitation: ${limitation}`)
    }
  }
  for (const [heading, values] of [
    ['Missing evidence', result.missingEvidence],
    ['Excluded evidence', result.excludedEvidence],
    ['Analysis limitations', result.limitations],
  ] as const) {
    if (values.length === 0) continue
    lines.push('', heading, ...values.map((value) => `- ${value}`))
  }
  return lines.join('\n')
}

export function researchNoteProjection(
  event: SaveableResearchEvent,
  threadId: typeDomain.ResearchThreadId,
) {
  const recursive = event.type === 'recursive-result-progress-committed'
  const request = recursive
    ? {
        title: event.data.result.status === 'partial'
          ? 'Partial research findings'
          : 'Research findings',
        body: recursiveResultNoteBody(event.data.result),
        origin: {
          threadId,
          runId: event.runId,
          answerId: event.id,
          citations: event.data.result.citations.map((citation) => ({
            kind: 'document' as const,
            id: citation.citationId,
            sourceVersionId: citation.sourceVersionId,
            locator: citation.locator,
          })),
        },
      }
    : {
        title: event.data.answer.slice(0, 200),
        body: event.data.answer,
        origin: {
          threadId,
          runId: event.runId,
          answerId: event.id,
          citations: [
            ...event.data.citations.map((citation) => ({
              kind: 'document' as const,
              id: citation.id,
              sourceVersionId: citation.sourceVersionId,
              locator: citation.locator,
            })),
            ...event.data.datasetCitations.map((citation) => ({
              kind: 'dataset' as const,
              id: citation.id,
              queryResultSnapshotId: citation.queryResultSnapshotId,
              datasetSnapshotId: citation.datasetSnapshotId,
            })),
          ],
        },
      }
  return Schema.is(CreateNoteRequest)(request)
    ? {
        ...request,
        idempotencyKey: `save-note-answer-${event.id}`,
      }
    : undefined
}

export function findCommittedRecursiveResultEvent(
  events: ReadonlyArray<typeDomain.ResearchEvent>,
  runId: typeDomain.ResearchRunId,
  result: typeDomain.RecursiveResultProgress,
): CommittedRecursiveResultEvent | undefined {
  return events.findLast((event): event is CommittedRecursiveResultEvent =>
    event.type === 'recursive-result-progress-committed'
    && event.runId === runId
    && event.data.result.updatedAt === result.updatedAt
    && event.data.result.coverage.id === result.coverage.id)
}

export function mergeRecursiveRead(
  current: typeDomain.RecursiveRunProgress | null,
  loaded: typeDomain.RecursiveRunProgress | null,
): typeDomain.RecursiveRunProgress | null {
  if (loaded === null) return current
  if (current === null) return loaded
  if (
    current.workspaceId !== loaded.workspaceId
    || current.requestId !== loaded.requestId
    || current.planId !== loaded.planId
  ) return current
  return loaded.updatedAt >= current.updatedAt ? loaded : current
}
