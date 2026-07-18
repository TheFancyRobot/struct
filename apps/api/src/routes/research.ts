import { Effect } from 'effect'
import {
  EventJournalId,
  JobQueueId,
  ResearchRunId,
  ResearchThreadId,
  ValidationError,
} from '@struct/domain'
import type * as Domain from '@struct/domain'
import type * as Persistence from '@struct/persistence'

export interface StartResearchInput {
  readonly workspaceId: Domain.WorkspaceId
  readonly projectId: Domain.ProjectId
  readonly sourceVersionIds: ReadonlyArray<Domain.SourceVersionId>
  readonly question: string
}

export interface StartResearchDeps {
  readonly now: () => bigint
  readonly randomThreadId: () => typeof ResearchThreadId.Type
  readonly randomRunId: () => typeof ResearchRunId.Type
  readonly randomJobId: () => typeof JobQueueId.Type
  readonly randomEventId: () => typeof EventJournalId.Type
  readonly register: (
    input: Persistence.ResearchRegistrationInput,
  ) => Effect.Effect<Persistence.ResearchRegistrationResult, Persistence.ResearchExecutionError, never>
}

function titleFor(question: string): string {
  return question.length <= 80 ? question : `${question.slice(0, 77)}...`
}

export const startResearch = (
  input: StartResearchInput,
  deps: StartResearchDeps,
): Effect.Effect<
  Persistence.ResearchRegistrationResult,
  ValidationError | Persistence.ResearchExecutionError,
  never
> =>
  Effect.gen(function* () {
    const question = input.question.trim()
    const uniqueVersions = [...new Set(input.sourceVersionIds)]
    if (question.length === 0 || question.length > 4000) {
      return yield* new ValidationError({
        field: 'question',
        reason: 'invalid-length',
        message: 'Research question must contain between 1 and 4000 characters',
      })
    }
    if (
      uniqueVersions.length === 0 ||
      uniqueVersions.length > 10 ||
      uniqueVersions.length !== input.sourceVersionIds.length
    ) {
      return yield* new ValidationError({
        field: 'sourceVersionIds',
        reason: 'invalid-scope',
        message: 'Research requires between 1 and 10 unique source versions',
      })
    }

    const now = deps.now()
    const thread: typeof Domain.ResearchThread.Type = {
      id: deps.randomThreadId(),
      projectId: input.projectId,
      title: titleFor(question),
      createdAt: now,
      updatedAt: now,
    }
    const run: typeof Domain.ResearchRun.Type = {
      id: deps.randomRunId(),
      threadId: thread.id,
      question,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    const job: typeof Domain.JobQueue.Type = {
      id: deps.randomJobId(),
      workspaceId: input.workspaceId,
      entityType: 'research',
      entityId: run.id,
      status: 'pending',
      payload: {
        projectId: input.projectId,
        sourceVersionIds: uniqueVersions,
      },
      attempts: 0,
      maxAttempts: 1,
      createdAt: now,
      updatedAt: now,
    }
    const event: typeof Domain.EventJournal.Type = {
      id: deps.randomEventId(),
      workspaceId: input.workspaceId,
      entityType: 'research',
      entityId: run.id,
      eventType: 'research-started',
      payload: { jobId: job.id, threadId: thread.id },
      cursor: 0n,
      createdAt: now,
    }

    return yield* deps.register({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sourceVersionIds: uniqueVersions,
      thread,
      run,
      job,
      event,
    })
  })
