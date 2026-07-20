/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  ProjectId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchToolAuthorizationError,
  ResearchToolCancelledError,
  type ResearchToolFailure,
  ResearchToolId,
  ResearchToolInputValidationError,
  ResearchToolOutputValidationError,
  ResearchToolTimeoutError,
  ResearchToolUnknownError,
  WorkspaceId,
  ResearchToolCapability,
} from '@struct/domain'
import {
  executeResearchToolWithRetry,
  ResearchActionResult,
  ResearchProviderFailure,
  type ResearchRetryAttempt as typeResearchRetryAttempt,
  type ResearchRetryPolicy as typeResearchRetryPolicy,
} from '@struct/research-engine'
import { Effect, Schema } from 'effect'
import type {
  ResearchToolResolver as typeResearchToolResolver,
} from '../graphs/research-run.js'
/* eslint-enable no-unused-vars */

export const ResearchToolTrace = Schema.Struct({
  toolId: ResearchToolId,
  capability: ResearchToolCapability,
  runId: ResearchRunId,
  nodeId: ResearchPlanNodeId,
  attempt: Schema.Number.pipe(Schema.int(), Schema.positive()),
  outcome: Schema.Literal(
    'started',
    'succeeded',
    'failed',
    'rejected',
    'cancelled',
  ),
  failureTag: Schema.NullOr(
    Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64)),
  ),
})
export type ResearchToolTrace =
  Schema.Schema.Type<typeof ResearchToolTrace>

export interface ResearchToolDispatchContext {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly runId: typeof ResearchRunId.Type
  readonly nodeId: typeof ResearchPlanNodeId.Type
  readonly capability: ResearchToolCapability
  readonly attempt: number
  readonly idempotencyKey: string | null
  readonly signal: AbortSignal
}

export interface ResearchToolDefinition {
  readonly toolId: typeof ResearchToolId.Type
  readonly capability: ResearchToolCapability
  readonly input: Schema.Schema.AnyNoContext
  readonly output: Schema.Schema.AnyNoContext
  readonly timeoutMilliseconds: number
  readonly idempotent: boolean
  readonly authorize: (
    context: ResearchToolDispatchContext,
  ) => Effect.Effect<boolean, never, never>
  readonly execute: (
    input: unknown,
    context: ResearchToolDispatchContext,
  ) => Effect.Effect<unknown, ResearchToolFailure, never>
}

export interface ResearchToolRegistryDependencies {
  readonly trace: (
    trace: ResearchToolTrace,
  ) => Effect.Effect<void, never, never>
}

export interface ResearchToolRegistry {
  readonly dispatch: (
    toolId: typeof ResearchToolId.Type,
    input: unknown,
    context: ResearchToolDispatchContext,
  ) => Effect.Effect<unknown, ResearchToolFailure, never>
  readonly policy: (
    toolId: typeof ResearchToolId.Type,
  ) => Effect.Effect<{
    readonly capability: ResearchToolCapability
    readonly timeoutMilliseconds: number
    readonly idempotent: boolean
  }, ResearchToolUnknownError, never>
}

export interface ResearchRegistryResolverContext {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly runId: typeof ResearchRunId.Type
  readonly signal: AbortSignal
  readonly idempotencyKey: (nodeId: typeof ResearchPlanNodeId.Type) => string
  readonly sleep: (milliseconds: number) => Effect.Effect<void, never, never>
  readonly onRetryAttempt: (
    attempt: typeResearchRetryAttempt,
  ) => Effect.Effect<void, never, never>
}

function failureTag(failure: ResearchToolFailure): string {
  return failure._tag.length <= 64
    ? failure._tag
    : 'ResearchToolFailure'
}

function trace(
  dependencies: ResearchToolRegistryDependencies,
  toolId: typeof ResearchToolId.Type,
  context: ResearchToolDispatchContext,
  outcome: ResearchToolTrace['outcome'],
  failureTagValue: string | null,
) {
  return dependencies.trace({
    toolId,
    capability: context.capability,
    runId: context.runId,
    nodeId: context.nodeId,
    attempt: context.attempt,
    outcome,
    failureTag: failureTagValue,
  })
}

function unknownTool(toolId: typeof ResearchToolId.Type) {
  return new ResearchToolUnknownError({
    toolId,
    message: 'Research tool is not registered',
  })
}

export function makeResearchToolRegistry(
  definitions: ReadonlyArray<ResearchToolDefinition>,
  dependencies: ResearchToolRegistryDependencies,
): ResearchToolRegistry {
  const entries = new Map(definitions.map(
    (definition) => [definition.toolId, definition] as const,
  ))

  const policy: ResearchToolRegistry['policy'] = Effect.fn(
    'ResearchToolRegistry.policy',
  )(function* (toolId) {
    const definition = entries.get(toolId)
    if (definition === undefined) return yield* unknownTool(toolId)
    return {
      capability: definition.capability,
      timeoutMilliseconds: definition.timeoutMilliseconds,
      idempotent: definition.idempotent,
    }
  })

  const dispatch: ResearchToolRegistry['dispatch'] = Effect.fn(
    'ResearchToolRegistry.dispatch',
  )(function* (toolId, input, context) {
    const definition = entries.get(toolId)
    if (definition === undefined) {
      const failure = unknownTool(toolId)
      yield* trace(dependencies, toolId, context, 'rejected', failure._tag)
      return yield* failure
    }
    if (context.signal.aborted) {
      const failure = new ResearchToolCancelledError({
        toolId,
        capability: context.capability,
        nodeId: context.nodeId,
        runId: context.runId,
        message: 'Research tool execution was cancelled',
      })
      yield* trace(dependencies, toolId, context, 'cancelled', failure._tag)
      return yield* failure
    }
    if (context.capability !== definition.capability) {
      const failure = new ResearchToolAuthorizationError({
        toolId,
        capability: context.capability,
        nodeId: context.nodeId,
        runId: context.runId,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        detail: 'capability-mismatch',
        message: 'Research tool capability is not authorized',
      })
      yield* trace(dependencies, toolId, context, 'rejected', failure._tag)
      return yield* failure
    }
    const authorized = yield* definition.authorize(context)
    if (!authorized) {
      const failure = new ResearchToolAuthorizationError({
        toolId,
        capability: context.capability,
        nodeId: context.nodeId,
        runId: context.runId,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        detail: 'workspace-project-scope',
        message: 'Research tool scope is not authorized',
      })
      yield* trace(dependencies, toolId, context, 'rejected', failure._tag)
      return yield* failure
    }
    const decoded = yield* Schema.decodeUnknown(definition.input)(input).pipe(
      Effect.mapError(() =>
        new ResearchToolInputValidationError({
          toolId,
          capability: context.capability,
          nodeId: context.nodeId,
          runId: context.runId,
          message: 'Research tool input failed schema validation',
        })),
    )
    yield* trace(dependencies, toolId, context, 'started', null)
    const executed = yield* definition.execute(decoded, context).pipe(
      Effect.timeoutFail({
        duration: definition.timeoutMilliseconds,
        onTimeout: () =>
          new ResearchToolTimeoutError({
            toolId,
            capability: context.capability,
            nodeId: context.nodeId,
            runId: context.runId,
            timeoutMilliseconds: definition.timeoutMilliseconds,
            message: 'Research tool execution timed out',
          }),
      }),
      Effect.either,
    )
    if (executed._tag === 'Left') {
      yield* trace(
        dependencies,
        toolId,
        context,
        executed.left._tag === 'ResearchToolCancelledError'
          ? 'cancelled'
          : 'failed',
        failureTag(executed.left),
      )
      return yield* executed.left
    }
    const output = yield* Schema.decodeUnknown(definition.output)(
      executed.right,
    ).pipe(
      Effect.mapError(() =>
        new ResearchToolOutputValidationError({
          toolId,
          capability: context.capability,
          nodeId: context.nodeId,
          runId: context.runId,
          message: 'Research tool output failed schema validation',
        })),
      Effect.either,
    )
    if (output._tag === 'Left') {
      yield* trace(
        dependencies,
        toolId,
        context,
        'failed',
        output.left._tag,
      )
      return yield* output.left
    }
    yield* trace(dependencies, toolId, context, 'succeeded', null)
    return output.right
  })

  return { dispatch, policy }
}

/**
 * Adapts the typed registry to the bounded Fred graph. Exact registry failures
 * drive retry decisions here; only a bounded provider failure crosses the
 * graph boundary, so secrets and adapter payloads cannot enter graph state.
 */
export function makeRegistryResearchToolResolver(
  registry: ResearchToolRegistry,
  retryPolicy: typeResearchRetryPolicy,
  context: ResearchRegistryResolverContext,
): typeResearchToolResolver {
  return {
    resolve: (toolId, capability) =>
      Effect.gen(function* () {
        const toolPolicy = yield* registry.policy(toolId).pipe(
          Effect.mapError(() =>
            new ResearchProviderFailure({
              message: 'Research tool is unavailable',
            })),
        )
        if (toolPolicy.capability !== capability) {
          return yield* new ResearchProviderFailure({
            message: 'Research tool capability is unavailable',
          })
        }
        return {
          execute: (node, signal) =>
            executeResearchToolWithRetry(
              {
                toolId,
                capability,
                nodeId: node.id,
                runId: context.runId,
                idempotent: toolPolicy.idempotent,
                idempotencyKey: context.idempotencyKey(node.id),
                signal,
              },
              retryPolicy,
              {
                sleep: context.sleep,
                onAttempt: context.onRetryAttempt,
              },
              (attempt) =>
                registry.dispatch(toolId, node, {
                  workspaceId: context.workspaceId,
                  projectId: context.projectId,
                  runId: context.runId,
                  nodeId: node.id,
                  capability,
                  attempt,
                  idempotencyKey: context.idempotencyKey(node.id),
                  signal: context.signal.aborted
                    ? context.signal
                    : signal,
                }).pipe(
                  Effect.flatMap((output) =>
                    Schema.decodeUnknown(ResearchActionResult)(output).pipe(
                      Effect.mapError(() =>
                        new ResearchToolOutputValidationError({
                          toolId,
                          capability,
                          nodeId: node.id,
                          runId: context.runId,
                          message: 'Research graph tool output failed schema validation',
                        })),
                    ),
                  ),
                ),
            ).pipe(
              Effect.mapError(() =>
                new ResearchProviderFailure({
                  message: 'Research tool provider failed',
                })),
            ),
        }
      }),
  }
}
