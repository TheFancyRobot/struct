import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import {
  EventJournal,
  EventJournalId,
  JobQueueId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  IngestionEventValidationError,
  JobQueueRepo,
  SqlClientTest,
} from '../index.js'

const workspaceId = WorkspaceId.make('670e8400-e29b-41d4-a716-446655440000')
const sourceId = SourceId.make('670e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make(
  '670e8400-e29b-41d4-a716-446655440002',
)
const foreignSourceVersionId = SourceVersionId.make(
  '670e8400-e29b-41d4-a716-446655440003',
)
const forgedRawRef =
  'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const normalizedRef =
  'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const manifestRef =
  'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const contentHash =
  'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

type Transition = 'append-event' | 'complete' | 'pending' | 'fail'

const job = (transition: Transition) => ({
  id: JobQueueId.make(
    transition === 'append-event'
      ? '670e8400-e29b-41d4-a716-446655440010'
      : transition === 'complete'
        ? '670e8400-e29b-41d4-a716-446655440011'
        : transition === 'pending'
          ? '670e8400-e29b-41d4-a716-446655440012'
          : '670e8400-e29b-41d4-a716-446655440013',
  ),
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  status: 'in-progress',
  payload: { byteLength: 12 },
  attempts: transition === 'fail' ? 3 : 1,
  maxAttempts: 3,
  createdAt: 0n,
  updatedAt: 0n,
} as const)

const event = (transition: Transition) => ({
  id: EventJournalId.make(
    transition === 'append-event'
      ? '670e8400-e29b-41d4-a716-446655440020'
      : transition === 'complete'
        ? '670e8400-e29b-41d4-a716-446655440021'
        : transition === 'pending'
          ? '670e8400-e29b-41d4-a716-446655440022'
          : '670e8400-e29b-41d4-a716-446655440023',
  ),
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  eventType: transition === 'append-event'
    ? 'file-processed'
    : transition === 'complete'
      ? 'ingestion-completed'
      : 'ingestion-failed',
  payload: transition === 'append-event'
    ? {
        jobId: job(transition).id,
        attempt: job(transition).attempts,
        sourceVersionId,
        manifestRef,
        contentHash,
        byteLength: 12,
      }
    : transition === 'complete'
      ? {
          jobId: job(transition).id,
          attempt: job(transition).attempts,
          sourceVersionId,
          manifestRef,
          contentHash,
        }
      : {
          jobId: job(transition).id,
          attempt: job(transition).attempts,
          errorTag: 'IngestionFailure',
          message: 'Ingestion failed',
          retryable: true,
        },
  cursor: 0n,
  createdAt: 0n,
} as const)

const runTransition = (
  transition: Transition,
  candidateJob: ReturnType<typeof job>,
  candidateEvent: typeof EventJournal.Type,
) => {
  switch (transition) {
    case 'append-event':
      return JobQueueRepo.appendInProgressEvent(candidateJob, candidateEvent)
    case 'complete':
      return JobQueueRepo.markCompleted(candidateJob, candidateEvent)
    case 'pending':
      return JobQueueRepo.markPending(candidateJob, candidateEvent)
    case 'fail':
      return JobQueueRepo.markFailed(candidateJob, candidateEvent)
  }
}

const expectValidationFailure = async (
  effect: ReturnType<typeof runTransition>,
  layer: Layer.Layer<JobQueueRepo>,
) => {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) {
    expect(String(exit.cause)).toContain(IngestionEventValidationError.name)
  }
}

describe('ingestion transition event contracts', () => {
  it('rejects invalid top-level metadata and exact-contract violations on every path before SQL', async () => {
    const calls: string[] = []
    const layer = Layer.provide(
      JobQueueRepo.Default,
      SqlClientTest(async (query) => {
        calls.push(query)
        return []
      }),
    )
    const transitions: ReadonlyArray<Transition> = [
      'append-event',
      'complete',
      'pending',
      'fail',
    ]

    for (const transition of transitions) {
      const valid = event(transition)
      const wrongType = {
        ...valid,
        eventType: transition === 'append-event'
          ? 'ingestion-completed'
          : 'file-processed',
      }
      const nonzeroCursor = { ...valid, cursor: 1n }
      const malformedId = { ...valid, id: 'not-a-uuid' }
      const noncanonicalId = {
        ...valid,
        id: String(valid.id).toUpperCase(),
      }
      const negativeCreatedAt = { ...valid, createdAt: -1n }
      const nonBigIntCreatedAt = { ...valid, createdAt: 0 }
      const unsafeCreatedAt = {
        ...valid,
        createdAt: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      }
      const extraPayload = {
        ...valid,
        payload: { ...valid.payload, projectId: 'cross-domain' },
      }
      const forgedRawProvenance = transition === 'append-event'
        ? {
            ...valid,
            payload: {
              ...valid.payload,
              rawRef: forgedRawRef,
            },
          }
        : undefined
      const extraTopLevel = { ...valid, researchRunId: 'cross-domain' }

      for (const forged of [
        wrongType,
        nonzeroCursor,
        malformedId,
        noncanonicalId,
        negativeCreatedAt,
        nonBigIntCreatedAt,
        unsafeCreatedAt,
        extraPayload,
        extraTopLevel,
        ...(forgedRawProvenance === undefined
          ? []
          : [forgedRawProvenance]),
      ]) {
        await expectValidationFailure(
          runTransition(
            transition,
            job(transition),
            forged as ReturnType<typeof event>,
          ),
          layer,
        )
      }
    }

    expect(calls).toHaveLength(0)
  })

  it('rejects forged provenance, malformed failures, and inverted retry semantics without writes', async () => {
    const calls: Array<{
      readonly query: string
      readonly params?: readonly unknown[]
    }> = []
    const layer = Layer.provide(
      JobQueueRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        if (query.includes('FROM job_queue job')) {
          return [{
            id: params?.[0],
            workspace_id: workspaceId,
            entity_type: 'ingestion',
            entity_id: sourceId,
            attempts: params?.[3],
            max_attempts: 3,
            payload: { byteLength: 12 },
          }]
        }
        if (query.includes('FROM source_versions version')) {
          return params?.[0] === sourceVersionId
            ? [{
                id: sourceVersionId,
                artifact_ref: manifestRef,
                content_hash: contentHash,
              }]
            : []
        }
        return []
      }),
    )
    const append = event('append-event')
    const complete = event('complete')
    const pending = event('pending')
    const fail = event('fail')
    const cases = [
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: {
          ...append.payload,
          rawRef: forgedRawRef,
        },
      }),
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: {
          ...append.payload,
          jobId: job('complete').id,
        },
      }),
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: {
          ...append.payload,
          attempt: 2,
        },
      }),
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: { ...append.payload, sourceVersionId: foreignSourceVersionId },
      }),
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: { ...append.payload, sourceVersionId: 'not-a-uuid' },
      }),
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: { ...append.payload, byteLength: 13 },
      }),
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: { ...append.payload, contentHash: `sha256:${'d'.repeat(64)}` },
      }),
      runTransition('append-event', job('append-event'), {
        ...append,
        payload: {
          ...append.payload,
          manifestRef:
            'artifact://sha256/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        },
      }),
      runTransition('complete', job('complete'), {
        ...complete,
        payload: {
          ...complete.payload,
          sourceVersionId: foreignSourceVersionId,
        },
      }),
      runTransition('complete', job('complete'), {
        ...complete,
        payload: { ...complete.payload, sourceVersionId: 'not-a-uuid' },
      }),
      runTransition('complete', job('complete'), {
        ...complete,
        payload: {
          ...complete.payload,
          manifestRef:
            'artifact://sha256/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        },
      }),
      runTransition('pending', job('pending'), {
        ...pending,
        payload: {
          ...pending.payload,
          errorTag: 'StorageReadError',
          message: 'secret path',
        },
      }),
      runTransition('fail', job('fail'), {
        ...fail,
        payload: {
          ...fail.payload,
          errorTag: 'bad-tag!',
          message: 'Ingestion failed',
        },
      }),
      runTransition('pending', job('pending'), {
        ...pending,
        payload: { ...pending.payload, retryable: false },
      }),
      runTransition('pending', job('pending'), {
        ...pending,
        payload: { ...pending.payload, retryable: 'yes' },
      }),
      runTransition('pending', { ...job('pending'), attempts: 3 }, pending),
      runTransition('fail', { ...job('fail'), attempts: 1 }, {
        ...fail,
        payload: { ...fail.payload, attempt: 1 },
      }),
    ]

    for (const candidate of cases) {
      await expectValidationFailure(candidate, layer)
    }

    expect(calls.some((call) => call.query.includes('UPDATE job_queue'))).toBe(false)
    expect(calls.some((call) => call.query.includes('INSERT INTO event_journal'))).toBe(false)
  })

  it('persists ownership-derived bounded payloads for all four valid paths', async () => {
    const inserts: Array<readonly unknown[] | undefined> = []
    const layer = Layer.provide(
      JobQueueRepo.Default,
      SqlClientTest(async (query, params) => {
        if (query.includes('FROM job_queue job')) {
          return [{
            id: params?.[0],
            workspace_id: workspaceId,
            entity_type: 'ingestion',
            entity_id: sourceId,
            attempts: params?.[3],
            max_attempts: 3,
            payload: { byteLength: 12 },
          }]
        }
        if (query.includes('FROM source_versions version')) {
          return [{
            id: sourceVersionId,
            artifact_ref: manifestRef,
            content_hash: contentHash,
          }]
        }
        if (query.includes('UPDATE job_queue')) return [{ id: params?.[0] }]
        if (query.includes('INSERT INTO event_journal')) inserts.push(params)
        return []
      }),
    )

    for (const transition of [
      'append-event',
      'complete',
      'pending',
      'fail',
    ] as const) {
      await Effect.runPromise(
        runTransition(transition, job(transition), event(transition)).pipe(
          Effect.provide(layer),
        ),
      )
    }

    expect(inserts).toHaveLength(4)
    expect(inserts.every((params) =>
      params?.[1] === workspaceId
      && params?.[2] === 'ingestion'
      && params?.[3] === sourceId)).toBe(true)
    expect(inserts.map((params) => JSON.parse(String(params?.[5])))).toEqual([
      {
        jobId: job('append-event').id,
        attempt: 1,
        sourceVersionId,
        manifestRef,
        normalizedRef,
        contentHash,
        byteLength: 12,
      },
      {
        jobId: job('complete').id,
        attempt: 1,
        sourceVersionId,
        manifestRef,
        contentHash,
      },
      {
        jobId: job('pending').id,
        attempt: 1,
        errorTag: 'IngestionFailure',
        message: 'Ingestion failed',
        retryable: true,
      },
      {
        jobId: job('fail').id,
        attempt: 3,
        errorTag: 'IngestionFailure',
        message: 'Ingestion failed',
        retryable: true,
      },
    ])
  })
})
