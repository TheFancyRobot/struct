import { describe, expect, it } from 'bun:test'
import { Cause, Effect, Exit, Option } from 'effect'
import {
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  WorkspaceId,
} from '@struct/domain'
import { QueryError } from '@struct/persistence'
import { loadRecursiveAnalysis } from './recursive-analysis'

const workspaceId = WorkspaceId.make('c70e8400-e29b-41d4-a716-446655440001')
const otherWorkspaceId = WorkspaceId.make('c70e8400-e29b-41d4-a716-446655440002')
const projectId = ProjectId.make('c70e8400-e29b-41d4-a716-446655440003')
const runId = ResearchRunId.make('c70e8400-e29b-41d4-a716-446655440004')
const jobId = JobQueueId.make('c70e8400-e29b-41d4-a716-446655440005')
const sha = (digit: string) => `sha256:${digit.repeat(64)}`
const RAW_SQL_MARKER = "RAW_SQL_MARKER__SELECT * FROM users WHERE password = 'db-secret-123'"
const FS_PATH_MARKER = '/Users/private/PATH_MARKER__service-account.json'

function expectSafeQueryError(
  exit: Exit.Exit<unknown, unknown>,
  redactedMarkers: ReadonlyArray<string>,
  expectedReason?: string,
): QueryError & { readonly reason?: string } {
  expect(Exit.isFailure(exit)).toBe(true)
  if (!Exit.isFailure(exit)) throw new Error('Expected query failure')
  const failure = Option.getOrUndefined(Cause.failureOption(exit.cause))
  if (!(failure instanceof QueryError)) throw new Error('Expected QueryError failure')
  expect(failure.operation).toBe('findRecursiveAnalysis')
  expect(failure.entity).toBe('ResearchProjection')
  expect(failure.message).toBe(
    'Persistence query failed during findRecursiveAnalysis on ResearchProjection',
  )
  if (expectedReason !== undefined) {
    expect(failure).toMatchObject({ reason: expectedReason })
  }
  for (const value of [failure.message, String(exit.cause), JSON.stringify(failure)]) {
    for (const marker of redactedMarkers) {
      expect(value).not.toContain(marker)
    }
  }
  return failure as QueryError & { readonly reason?: string }
}

function event(
  cursor: bigint,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return {
    id: EventJournalId.make(
      `c70e8400-e29b-41d4-a716-${cursor.toString(16).padStart(12, '0')}`,
    ),
    workspaceId,
    entityType: 'research',
    entityId: runId,
    eventType,
    payload,
    cursor,
    createdAt: 1_700_000_000_000n + cursor,
  }
}

const runPayload = {
  jobId,
  attempt: 1,
  workspaceId,
  requestId: sha('1'),
  planId: sha('2'),
  status: 'running',
  cancellation: 'none',
  recoveryCount: 1,
  expectedPartitions: 2,
  committedPartitions: 0,
  failedPartitions: 0,
} as const

describe('recursive analysis read projection', () => {
  it('folds committed run and partition progress in canonical order', async () => {
    const events = [
      event(1n, 'recursive-run-progress-committed', runPayload),
      event(2n, 'recursive-partition-progress-committed', {
        jobId,
        attempt: 1,
        workspaceId,
        requestId: sha('1'),
        planId: sha('2'),
        partition: {
          id: sha('4'),
          nodeId: sha('5'),
          ordinal: 1,
          status: 'running',
          attempt: 2,
          batches: [{
            id: sha('6'),
            status: 'retrying',
            attempt: 2,
            evidenceIds: [],
            updatedAt: 1_700_000_000_002,
          }],
          failureTag: null,
          startedAt: 1_700_000_000_001,
          updatedAt: 1_700_000_000_002,
        },
      }),
      event(3n, 'recursive-partition-progress-committed', {
        jobId,
        attempt: 1,
        workspaceId,
        requestId: sha('1'),
        planId: sha('2'),
        partition: {
          id: sha('4'),
          nodeId: sha('5'),
          ordinal: 1,
          status: 'running',
          attempt: 2,
          batches: [{
            id: sha('7'),
            status: 'committed',
            attempt: 2,
            evidenceIds: [sha('8')],
            updatedAt: 1_700_000_000_003,
          }],
          failureTag: null,
          startedAt: null,
          updatedAt: 1_700_000_000_003,
        },
      }),
    ]
    const result = await Effect.runPromise(loadRecursiveAnalysis(
      workspaceId,
      projectId,
      runId,
      {
        listEventsAfter: (_workspace, _project, _run, cursor) =>
          Effect.succeed(events.filter((item) => item.cursor > cursor)),
      },
    ))
    expect(Option.isSome(result)).toBe(true)
    if (Option.isNone(result)) throw new Error('Expected recursive progress')
    expect(result.value.recoveryCount).toBe(1)
    expect(result.value.partitions[0]?.batches).toHaveLength(2)
    expect(result.value.partitions[0]?.startedAt).toBe(1_700_000_000_001)
  })

  it('rejects a payload workspace that differs from the authorized route scope', async () => {
    const exit = await Effect.runPromiseExit(loadRecursiveAnalysis(
      workspaceId,
      projectId,
      runId,
      {
        listEventsAfter: () => Effect.succeed([
          event(1n, 'recursive-run-progress-committed', {
            ...runPayload,
            workspaceId: otherWorkspaceId,
            leakPath: FS_PATH_MARKER,
            leakSql: RAW_SQL_MARKER,
          }),
        ]),
      },
    ))
    expectSafeQueryError(
      exit,
      [
        RAW_SQL_MARKER,
        FS_PATH_MARKER,
        'outside the authorized workspace',
      ],
      'workspace-scope-mismatch',
    )
  })

  it('returns no recursive projection when a normal run has no recursive events', async () => {
    const result = await Effect.runPromise(loadRecursiveAnalysis(
      workspaceId,
      projectId,
      runId,
      {
        listEventsAfter: () => Effect.succeed([
          event(1n, 'research-started', {}),
        ]),
      },
    ))
    expect(Option.isNone(result)).toBe(true)
  })

  it('accepts the exact event bound and probes once for overflow', async () => {
    const total = 65_536
    const requestedLimits: number[] = []
    const result = await Effect.runPromise(loadRecursiveAnalysis(
      workspaceId,
      projectId,
      runId,
      {
        listEventsAfter: (_workspace, _project, _run, cursor, limit) => {
          requestedLimits.push(limit)
          const remaining = total - Number(cursor)
          return Effect.succeed(Array.from(
            { length: Math.min(limit, remaining) },
            (_, index) => event(cursor + BigInt(index + 1), 'research-started', {}),
          ))
        },
      },
    ))
    expect(Option.isNone(result)).toBe(true)
    expect(requestedLimits.at(-1)).toBe(37)
    expect(Math.max(...requestedLimits)).toBe(100)
  })

  it('rejects a journal that exceeds the event bound', async () => {
    const total = 65_537
    const exit = await Effect.runPromiseExit(loadRecursiveAnalysis(
      workspaceId,
      projectId,
      runId,
      {
        listEventsAfter: (_workspace, _project, _run, cursor, limit) => {
          const remaining = total - Number(cursor)
          return Effect.succeed(Array.from(
            { length: Math.min(limit, remaining) },
            (_, index) => event(cursor + BigInt(index + 1), 'research-started', {
              leakPath: FS_PATH_MARKER,
              leakSql: RAW_SQL_MARKER,
            }),
          ))
        },
      },
    ))
    expectSafeQueryError(
      exit,
      [
        RAW_SQL_MARKER,
        FS_PATH_MARKER,
        'exceeds the bounded event read limit',
      ],
      'event-limit-exceeded',
    )
  })
})
