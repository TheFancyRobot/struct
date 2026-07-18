import { Effect, Option, Schema } from 'effect'
import {
  CitationId,
  EventJournalId,
  ProjectId,
  SourceVersionId,
  ValidationError,
} from '@struct/domain'
import type * as Domain from '@struct/domain'
import type * as Research from '@struct/research-engine'

interface ResearchPayload {
  readonly projectId: ProjectId
  readonly sourceVersionIds: ReadonlyArray<SourceVersionId>
}

export interface ResearchWorkerDeps {
  readonly now: () => bigint
  readonly staleBeforeMs: number
  readonly randomEventId: () => typeof EventJournalId.Type
  readonly randomCitationId: () => typeof CitationId.Type
  readonly jobs: {
    readonly recoverStale: (
      staleBeforeMs: number,
    ) => Effect.Effect<ReadonlyArray<typeof Domain.JobQueue.Type>, unknown, never>
    readonly claimNext: () => Effect.Effect<Option.Option<typeof Domain.JobQueue.Type>, unknown, never>
    readonly appendEvent: (
      event: typeof Domain.EventJournal.Type,
    ) => Effect.Effect<unknown, unknown, never>
    readonly complete: (input: {
      readonly runId: typeof Domain.ResearchRun.Type['id']
      readonly jobId: typeof Domain.JobQueue.Type['id']
      readonly answer: typeof Domain.ResearchAnswer.Type
      readonly citations: ReadonlyArray<typeof Domain.Citation.Type>
      readonly event: typeof Domain.EventJournal.Type
    }) => Effect.Effect<unknown, unknown, never>
    readonly fail: (input: {
      readonly runId: typeof Domain.ResearchRun.Type['id']
      readonly jobId: typeof Domain.JobQueue.Type['id']
      readonly event: typeof Domain.EventJournal.Type
    }) => Effect.Effect<unknown, unknown, never>
  }
  readonly runs: {
    readonly findById: (
      runId: typeof Domain.ResearchRun.Type['id'],
    ) => Effect.Effect<typeof Domain.ResearchRun.Type, unknown, never>
  }
  readonly workflow: {
    readonly run: (input: {
      readonly run: typeof Domain.ResearchRun.Type
      readonly workspaceId: typeof Domain.JobQueue.Type['workspaceId']
      readonly projectId: ProjectId
      readonly sourceVersionIds: ReadonlyArray<SourceVersionId>
      readonly onRetrievalCompleted: (
        evidence: ReadonlyArray<typeof Domain.TextEvidence.Type>,
      ) => Effect.Effect<unknown, unknown, never>
    }) => Effect.Effect<typeof Research.WalkingSkeletonWorkflowResult.Type, unknown, never>
  }
}

function decodePayload(
  payload: Record<string, unknown>,
): Effect.Effect<ResearchPayload, ValidationError, never> {
  const projectId = payload['projectId']
  const versions = payload['sourceVersionIds']
  if (
    typeof projectId !== 'string' ||
    !Array.isArray(versions) ||
    versions.length === 0 ||
    !versions.every((value) => typeof value === 'string')
  ) {
    return Effect.fail(
      new ValidationError({
        field: 'research job payload',
        reason: 'invalid',
        message: 'Research job payload is invalid',
      }),
    )
  }
  return Effect.try({
    try: () => ({
      projectId: Schema.decodeUnknownSync(ProjectId)(projectId),
      sourceVersionIds: versions.map((value) =>
        Schema.decodeUnknownSync(SourceVersionId)(value),
      ),
    }),
    catch: () =>
      new ValidationError({
        field: 'research job payload',
        reason: 'invalid-identifiers',
        message: 'Research job payload identifiers are invalid',
      }),
  })
}

function event(
  deps: ResearchWorkerDeps,
  job: typeof Domain.JobQueue.Type,
  eventType: string,
  payload: Record<string, unknown>,
): typeof Domain.EventJournal.Type {
  return {
    id: deps.randomEventId(),
    workspaceId: job.workspaceId,
    entityType: 'research',
    entityId: job.entityId,
    eventType,
    payload,
    cursor: 0n,
    createdAt: deps.now(),
  }
}

function citationsFor(
  deps: ResearchWorkerDeps,
  run: typeof Domain.ResearchRun.Type,
  answer: typeof Domain.ResearchAnswer.Type,
): ReadonlyArray<typeof Domain.Citation.Type> {
  return answer.citations.map((citation) => ({
    id: deps.randomCitationId(),
    runId: run.id,
    sourceVersionId: citation.sourceVersionId,
    locator: citation.locator,
    status: 'validated',
    createdAt: deps.now(),
  }))
}

function safeFailureTag(error: unknown): string {
  return typeof error === 'object' && error !== null && '_tag' in error
    ? String(error._tag)
    : 'ResearchWorkflowError'
}

export const processOneResearchJob = (
  deps: ResearchWorkerDeps,
): Effect.Effect<{ readonly processed: boolean; readonly jobId?: string }, unknown, never> =>
  Effect.gen(function* () {
    const stale = yield* deps.jobs.recoverStale(deps.staleBeforeMs)
    void stale
    const claimed = yield* deps.jobs.claimNext()
    if (Option.isNone(claimed)) return { processed: false }
    const job = claimed.value

    const executed = yield* Effect.gen(function* () {
      const run = yield* deps.runs.findById(job.entityId as typeof Domain.ResearchRun.Type['id'])
      const payload = yield* decodePayload(job.payload)
      const result = yield* deps.workflow.run({
        run,
        workspaceId: job.workspaceId,
        projectId: payload.projectId,
        sourceVersionIds: payload.sourceVersionIds,
        onRetrievalCompleted: (evidence) =>
          deps.jobs.appendEvent(
            event(deps, job, 'retrieval-completed', {
              evidenceCount: evidence.length,
              sourceVersionIds: evidence.map((item) => item.sourceVersionId),
            }),
          ),
      })
      yield* deps.jobs.appendEvent(
        event(deps, job, 'citations-validated', {
          citationCount: result.answer.citations.length,
        }),
      )
      yield* deps.jobs.complete({
        runId: run.id,
        jobId: job.id,
        answer: result.answer,
        citations: citationsFor(deps, run, result.answer),
        event: event(deps, job, 'research-completed', {
          citationCount: result.answer.citations.length,
        }),
      })
    }).pipe(Effect.either)

    if (executed._tag === 'Left') {
      yield* deps.jobs.fail({
        runId: job.entityId as typeof Domain.ResearchRun.Type['id'],
        jobId: job.id,
        event: event(deps, job, 'research-failed', {
          errorTag: safeFailureTag(executed.left),
          message: 'Research failed',
        }),
      })
    }
    return { processed: true, jobId: job.id }
  })
