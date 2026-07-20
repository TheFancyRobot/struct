import { Schema } from 'effect'
import {
  CitationId,
  EventJournalId,
  JobQueueId,
  ResearchCheckpointId,
  ResearchPlanId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
} from './branded-ids.js'
import { DatasetCitation } from './dataset-query-evidence.js'

const Cursor = Schema.String.pipe(Schema.pattern(/^(0|[1-9]\d*)$/))

const EventBase = {
  id: EventJournalId,
  cursor: Cursor,
  runId: ResearchRunId,
  createdAt: Schema.Number,
}

export const ResearchStartedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('research-started'),
  data: Schema.Struct({
    jobId: JobQueueId,
    threadId: ResearchThreadId,
  }),
})

export const RetrievalCompletedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('retrieval-completed'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    evidenceCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    sourceVersionIds: Schema.Array(SourceVersionId),
  }),
})

export const CitationsValidatedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('citations-validated'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    citationCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
})

export const ResearchPlanAcceptedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('research-plan-accepted'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    planId: ResearchPlanId,
  }),
})

export const ResearchPlanningFailedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('research-planning-failed'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    errorTag: Schema.String,
    reason: Schema.String,
  }),
})

export const ResearchCheckpointedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('research-checkpointed'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    checkpointId: ResearchCheckpointId,
    planId: ResearchPlanId,
  }),
})

export const ResearchCancelledEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('research-cancelled'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  }),
})

export const ResearchCompletedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('research-completed'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    answer: Schema.String,
    citations: Schema.Array(Schema.Struct({
      id: CitationId,
      sourceVersionId: SourceVersionId,
      locator: Schema.String,
    })),
    datasetCitations: Schema.Array(DatasetCitation).pipe(Schema.maxItems(80)),
  }),
})

export const ResearchFailedEvent = Schema.Struct({
  ...EventBase,
  type: Schema.Literal('research-failed'),
  data: Schema.Struct({
    jobId: JobQueueId,
    attempt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    errorTag: Schema.String,
    message: Schema.String,
  }),
})

export const ResearchEvent = Schema.Union(
  ResearchStartedEvent,
  ResearchPlanAcceptedEvent,
  ResearchPlanningFailedEvent,
  ResearchCheckpointedEvent,
  RetrievalCompletedEvent,
  CitationsValidatedEvent,
  ResearchCancelledEvent,
  ResearchCompletedEvent,
  ResearchFailedEvent,
)
export type ResearchEvent = Schema.Schema.Type<typeof ResearchEvent>

export const CitationDetail = Schema.Struct({
  id: CitationId,
  runId: ResearchRunId,
  sourceVersionId: SourceVersionId,
  sourceName: Schema.String,
  sourceVersion: Schema.Number.pipe(Schema.int(), Schema.positive()),
  locator: Schema.String,
  contextLines: Schema.Array(Schema.Struct({
    lineNumber: Schema.Number.pipe(Schema.int(), Schema.positive()),
    segments: Schema.Array(Schema.Struct({
      text: Schema.String,
      cited: Schema.Boolean,
    })),
  })),
  startLine: Schema.Number.pipe(Schema.int(), Schema.positive()),
  endLine: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type CitationDetail = Schema.Schema.Type<typeof CitationDetail>
