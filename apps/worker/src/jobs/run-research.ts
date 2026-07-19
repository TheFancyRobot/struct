import { Effect, Option, Schema } from 'effect'
import {
  CitationId,
  EventJournalId,
  ProjectId,
  SourceVersionId,
  ValidationError,
} from '@struct/domain'
import type * as Domain from '@struct/domain'
import { ResearchJobOwnershipLostError } from '@struct/persistence'
import {
  incrementWalkingSliceMetric,
  logWalkingSlice,
  withWalkingSliceSpan,
} from '@struct/observability'
import type * as Research from '@struct/research-engine'

interface ResearchPayload {
  readonly projectId: ProjectId
  readonly sourceVersionIds: ReadonlyArray<SourceVersionId>
}

export interface ResearchWorkerDeps {
  readonly now: () => bigint
  readonly staleAfterMs: number
  readonly heartbeatIntervalMs: number
  readonly randomEventId: () => typeof EventJournalId.Type
  readonly randomCitationId: () => typeof CitationId.Type
  readonly jobs: {
    readonly recoverStale: (
      staleAfterMs: number,
    ) => Effect.Effect<ReadonlyArray<typeof Domain.JobQueue.Type>, unknown, never>
    readonly claimNext: () => Effect.Effect<Option.Option<typeof Domain.JobQueue.Type>, unknown, never>
    readonly renewLease: (
      job: typeof Domain.JobQueue.Type,
    ) => Effect.Effect<void, unknown, never>
    readonly appendInProgressEvent: (
      job: typeof Domain.JobQueue.Type,
      event: typeof Domain.EventJournal.Type,
    ) => Effect.Effect<unknown, unknown, never>
    readonly complete: (input: {
      readonly runId: typeof Domain.ResearchRun.Type['id']
      readonly job: typeof Domain.JobQueue.Type
      readonly answer: typeof Domain.ResearchAnswer.Type
      readonly citations: ReadonlyArray<typeof Domain.Citation.Type>
      readonly event: typeof Domain.EventJournal.Type
    }) => Effect.Effect<unknown, unknown, never>
    readonly fail: (input: {
      readonly runId: typeof Domain.ResearchRun.Type['id']
      readonly job: typeof Domain.JobQueue.Type
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

class ResearchLeaseHeartbeatError
  extends Schema.TaggedError<ResearchLeaseHeartbeatError>()(
    'ResearchLeaseHeartbeatError',
    {
      cause: Schema.Unknown,
      message: Schema.String,
    },
  ) {}

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
  const candidate = typeof error === 'object' && error !== null && '_tag' in error
    ? String(error._tag)
    : 'ResearchWorkflowError'
  return candidate.length <= 64 && /^[A-Za-z][A-Za-z0-9]*$/.test(candidate)
    ? candidate
    : 'ResearchWorkflowError'
}

function isOwnershipLost(error: unknown): boolean {
  return error instanceof ResearchJobOwnershipLostError
    || (
      typeof error === 'object'
      && error !== null
      && '_tag' in error
      && error._tag === 'ResearchJobOwnershipLostError'
    )
}

export const processOneResearchJob = (
  deps: ResearchWorkerDeps,
): Effect.Effect<{ readonly processed: boolean; readonly jobId?: string }, unknown, never> =>
  Effect.gen(function* () {
    const stale = yield* deps.jobs.recoverStale(deps.staleAfterMs)
    yield* Effect.forEach(stale, (job) =>
      withWalkingSliceSpan(
        'worker-job',
        {
          workspaceId: job.workspaceId,
          runId: job.entityId,
          jobId: job.id,
        },
        Effect.gen(function* () {
          yield* incrementWalkingSliceMetric('runs.failed')
          yield* logWalkingSlice({
            event: 'research.run.failed',
            identity: {
              workspaceId: job.workspaceId,
              runId: job.entityId,
              jobId: job.id,
            },
            errorTag: 'ResearchJobStaleError',
          })
        }),
      ),
    )
    const claimed = yield* deps.jobs.claimNext()
    if (Option.isNone(claimed)) return { processed: false }
    const job = claimed.value

    const executeClaimedJob = withWalkingSliceSpan(
      'worker-job',
      {
        workspaceId: job.workspaceId,
        runId: job.entityId,
        jobId: job.id,
      },
      Effect.gen(function* () {
        const run = yield* deps.runs.findById(
          job.entityId as typeof Domain.ResearchRun.Type['id'],
        )
        const payload = yield* decodePayload(job.payload)
        const result = yield* withWalkingSliceSpan(
          'fred-run',
          {
            workspaceId: job.workspaceId,
            projectId: payload.projectId,
            runId: run.id,
            jobId: job.id,
          },
          deps.workflow.run({
            run,
            workspaceId: job.workspaceId,
            projectId: payload.projectId,
            sourceVersionIds: payload.sourceVersionIds,
            onRetrievalCompleted: (evidence) =>
              deps.jobs.appendInProgressEvent(
                job,
                event(deps, job, 'retrieval-completed', {
                  evidenceCount: evidence.length,
                  sourceVersionIds: evidence.map(
                    (item) => item.sourceVersionId,
                  ),
                }),
              ),
          }),
        )
        yield* deps.jobs.appendInProgressEvent(
          job,
          event(deps, job, 'citations-validated', {
            citationCount: result.answer.citations.length,
          }),
        )
        yield* deps.jobs.complete({
          runId: run.id,
          job,
          answer: result.answer,
          citations: citationsFor(deps, run, result.answer),
          event: event(deps, job, 'research-completed', {
            citationCount: result.answer.citations.length,
          }),
        })
        yield* incrementWalkingSliceMetric(
          'citations.validated',
          result.answer.citations.length,
        )
        yield* logWalkingSlice({
          event: 'research.run.completed',
          identity: {
            workspaceId: job.workspaceId,
            projectId: payload.projectId,
            runId: run.id,
            jobId: job.id,
          },
          count: result.answer.citations.length,
        })
        yield* incrementWalkingSliceMetric('runs.completed')
      }),
    )
    const renewLease = Effect.gen(function* () {
      while (true) {
        yield* deps.jobs.renewLease(job)
        yield* Effect.sleep(`${deps.heartbeatIntervalMs} millis`)
      }
    }).pipe(
      Effect.mapError((cause) =>
        new ResearchLeaseHeartbeatError({
          cause,
          message: 'Research lease heartbeat failed',
        }),
      ),
    )
    const executed = yield* Effect.raceFirst(
      executeClaimedJob,
      renewLease,
    ).pipe(Effect.either)

    if (executed._tag === 'Left') {
      if (executed.left instanceof ResearchLeaseHeartbeatError) {
        if (isOwnershipLost(executed.left.cause)) {
          return { processed: true, jobId: job.id }
        }
        return yield* Effect.fail(executed.left.cause)
      }
      if (isOwnershipLost(executed.left)) {
        return { processed: true, jobId: job.id }
      }
      const failed = yield* deps.jobs.fail({
        runId: job.entityId as typeof Domain.ResearchRun.Type['id'],
        job,
        event: event(deps, job, 'research-failed', {
          errorTag: safeFailureTag(executed.left),
          message: 'Research failed',
        }),
      }).pipe(Effect.either)
      if (failed._tag === 'Left' && !isOwnershipLost(failed.left)) {
        return yield* Effect.fail(failed.left)
      }
      if (failed._tag === 'Right') {
        yield* withWalkingSliceSpan(
          'worker-job',
          {
            workspaceId: job.workspaceId,
            runId: job.entityId,
            jobId: job.id,
          },
          Effect.gen(function* () {
            yield* incrementWalkingSliceMetric('runs.failed')
            yield* logWalkingSlice({
              event: 'research.run.failed',
              identity: {
                workspaceId: job.workspaceId,
                runId: job.entityId,
                jobId: job.id,
              },
              errorTag: safeFailureTag(executed.left),
            })
          }),
        )
      }
    }
    return { processed: true, jobId: job.id }
  })
