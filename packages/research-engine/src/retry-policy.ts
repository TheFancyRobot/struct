import type {
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchToolCapability,
  ResearchToolFailure,
  ResearchToolId,
} from '@struct/domain'
import {
  ResearchToolCancelledError,
  ResearchToolRetrySafetyError,
} from '@struct/domain'
import { Effect, Schema } from 'effect'

const Counter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)

export const ResearchRetryPolicy = Schema.Struct({
  maximumAttempts: Counter.pipe(Schema.between(1, 5)),
  initialBackoffMilliseconds: Counter.pipe(Schema.between(1, 60_000)),
  maximumBackoffMilliseconds: Counter.pipe(Schema.between(1, 300_000)),
})
export type ResearchRetryPolicy =
  Schema.Schema.Type<typeof ResearchRetryPolicy>

export const ResearchRetryAttempt = Schema.Struct({
  attempt: Counter.pipe(Schema.positive()),
  errorTag: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64)),
  retryable: Schema.Boolean,
  willRetry: Schema.Boolean,
  stopReason: Schema.NullOr(
    Schema.Literal('permanent', 'exhausted', 'cancelled', 'unsafe-retry'),
  ),
  backoffMilliseconds: Counter,
})
export type ResearchRetryAttempt =
  Schema.Schema.Type<typeof ResearchRetryAttempt>

export interface ResearchRetryContext {
  readonly toolId: ResearchToolId
  readonly capability: ResearchToolCapability
  readonly nodeId: ResearchPlanNodeId
  readonly runId: ResearchRunId
  readonly idempotent: boolean
  readonly idempotencyKey: string | null
  readonly signal: AbortSignal
}

export interface ResearchRetryDependencies {
  readonly sleep: (milliseconds: number) => Effect.Effect<void, never, never>
  readonly onAttempt: (
    attempt: ResearchRetryAttempt,
  ) => Effect.Effect<void, never, never>
}

const transientTags = new Set<ResearchToolFailure['_tag']>([
  'ResearchToolTimeoutError',
  'ResearchToolProviderUnavailableError',
  'ResearchToolTransportError',
  'ResearchToolLeaseLostError',
  'ResearchToolSidecarUnavailableError',
])

export function isResearchToolFailureRetryable(
  failure: ResearchToolFailure,
): boolean {
  return transientTags.has(failure._tag)
}

function delayFor(policy: ResearchRetryPolicy, attempt: number): number {
  return Math.min(
    policy.maximumBackoffMilliseconds,
    policy.initialBackoffMilliseconds * (2 ** Math.max(0, attempt - 1)),
  )
}

function cancelled(context: ResearchRetryContext): ResearchToolCancelledError {
  return new ResearchToolCancelledError({
    toolId: context.toolId,
    capability: context.capability,
    nodeId: context.nodeId,
    runId: context.runId,
    message: 'Research tool execution was cancelled',
  })
}

export const executeResearchToolWithRetry = Effect.fn(
  'ResearchRetry.executeTool',
)(function* <A>(
  context: ResearchRetryContext,
  policy: ResearchRetryPolicy,
  dependencies: ResearchRetryDependencies,
  execute: (
    attempt: number,
  ) => Effect.Effect<A, ResearchToolFailure, never>,
) {
  if (context.signal.aborted) {
    yield* dependencies.onAttempt({
      attempt: 1,
      errorTag: 'ResearchToolCancelledError',
      retryable: false,
      willRetry: false,
      stopReason: 'cancelled',
      backoffMilliseconds: 0,
    })
    return yield* cancelled(context)
  }
  if (
    policy.maximumAttempts > 1
    && (!context.idempotent || context.idempotencyKey === null)
  ) {
    yield* dependencies.onAttempt({
      attempt: 1,
      errorTag: 'ResearchToolRetrySafetyError',
      retryable: false,
      willRetry: false,
      stopReason: 'unsafe-retry',
      backoffMilliseconds: 0,
    })
    return yield* new ResearchToolRetrySafetyError({
      toolId: context.toolId,
      capability: context.capability,
      nodeId: context.nodeId,
      runId: context.runId,
      message: 'Automated retry requires an idempotent tool and idempotency key',
    })
  }

  let attempt = 1
  while (attempt <= policy.maximumAttempts) {
    if (context.signal.aborted) {
      yield* dependencies.onAttempt({
        attempt,
        errorTag: 'ResearchToolCancelledError',
        retryable: false,
        willRetry: false,
        stopReason: 'cancelled',
        backoffMilliseconds: 0,
      })
      return yield* cancelled(context)
    }
    const outcome = yield* Effect.either(execute(attempt))
    if (outcome._tag === 'Right') return outcome.right

    const retryable = isResearchToolFailureRetryable(outcome.left)
    const hasNextAttempt = retryable && attempt < policy.maximumAttempts
    const backoffMilliseconds = hasNextAttempt
      ? delayFor(policy, attempt)
      : 0
    yield* dependencies.onAttempt({
      attempt,
      errorTag: outcome.left._tag,
      retryable,
      willRetry: hasNextAttempt,
      stopReason: hasNextAttempt
        ? null
        : retryable
          ? 'exhausted'
          : 'permanent',
      backoffMilliseconds,
    })
    if (!hasNextAttempt) return yield* outcome.left
    yield* dependencies.sleep(backoffMilliseconds)
    attempt += 1
  }
  return yield* cancelled(context)
})
