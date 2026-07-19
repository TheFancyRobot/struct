import { Clock, Config, Effect, Runtime, Schema } from 'effect'
import type * as Fred from '@fancyrobot/fred'
import { ResearchWorkflowError } from '@struct/domain'
import {
  WalkingSkeletonWorkflowResult,
} from '@struct/research-engine'
// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Research from '@struct/research-engine'
import {
  answerSynthesizerAgent,
  makeSearchTextTool,
  makeWalkingSkeletonWorkflow,
} from '../graphs/walking-skeleton.js'
// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as WalkingSkeleton from '../graphs/walking-skeleton.js'

export interface FredRuntimeConfig {
  readonly providerPackage: string
  readonly model: string
  readonly maxElapsedMs: number
}

export const fredRuntimeConfig = Config.all({
  providerPackage: Config.string('FRED_PROVIDER_PACKAGE'),
  model: Config.string('FRED_MODEL'),
  maxElapsedMs: Config.number('RESEARCH_MAX_ELAPSED_MS').pipe(
    Config.withDefault(60_000),
    Config.validate({
      message: 'RESEARCH_MAX_ELAPSED_MS must be positive',
      validation: (value) => value > 0,
    }),
  ),
})

export interface FredClientFactory {
  readonly create: (signal: AbortSignal) => Promise<Fred.FredClient>
  readonly execute: (
    fred: Fred.FredClient,
    workflow: Fred.WorkflowIR,
    input: typeof Research.WalkingSkeletonResearchInput.Type,
    maxElapsedMs: number,
    signal: AbortSignal,
  ) => Promise<Fred.WorkflowExecutionResult>
}

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('Fred workflow was interrupted')
  }
}

// Once the workflow deadline has expired, finalization gets only this small
// emergency window. This lets an immediately responsive Fred client release
// resources without turning cleanup into a fresh workflow-sized timeout.
const EMERGENCY_SHUTDOWN_MS = 10

async function boundedShutdown(
  fred: Fred.FredClient,
  maxElapsedMs: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      fred.shutdown(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, Math.max(1, maxElapsedMs))
      }),
    ])
  } catch {
    // Shutdown cannot replace the workflow result or timeout.
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

function createFredBeforeDeadline(
  factory: FredClientFactory,
  maxElapsedMs: number,
  outerSignal: AbortSignal,
): Promise<Fred.FredClient> {
  const controller = new AbortController()
  let settled = false
  let timedOut = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  const abortFromOuter = (): void => {
    controller.abort(outerSignal.reason)
  }
  outerSignal.addEventListener('abort', abortFromOuter, { once: true })

  const created = factory.create(controller.signal)
  void created.then(
    (fred) => {
      if (timedOut || outerSignal.aborted) {
        void boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
      }
    },
    () => undefined,
  )

  return new Promise<Fred.FredClient>((resolve, reject) => {
    const finish = (complete: () => void): void => {
      if (settled) return
      settled = true
      if (timeout !== undefined) clearTimeout(timeout)
      outerSignal.removeEventListener('abort', abortFromOuter)
      complete()
    }
    timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new Error('Fred runtime creation exceeded elapsed-time budget'))
      finish(() => reject(new Error('Fred runtime creation exceeded elapsed-time budget')))
    }, Math.max(1, maxElapsedMs))
    created.then(
      (fred) => finish(() => resolve(fred)),
      (error: unknown) => finish(() => reject(error)),
    )
    if (outerSignal.aborted) {
      abortFromOuter()
      finish(() => reject(
        outerSignal.reason instanceof Error
          ? outerSignal.reason
          : new Error('Fred runtime creation was interrupted'),
      ))
    }
  })
}

function shutdownWithinDeadline(
  fred: Fred.FredClient,
  deadlineMs: number,
): Effect.Effect<void, never, never> {
  return Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const remainingMs = Math.max(0, deadlineMs - now)
    const cleanupBudgetMs = remainingMs > 0
      ? remainingMs
      : EMERGENCY_SHUTDOWN_MS
    yield* Effect.promise(() => boundedShutdown(fred, cleanupBudgetMs)).pipe(
      Effect.ignore,
    )
  })
}

const defaultFactory: FredClientFactory = {
  create: async (signal) => {
    const { createFred } = await import('@fancyrobot/fred')
    assertActive(signal)
    return createFred()
  },
  execute: async (fred, workflow, input, _maxElapsedMs, signal) => {
    assertActive(signal)
    const {
      AgentService,
      SessionService,
      executeWorkflowEffect,
    } = await import('@fancyrobot/fred/effect')
    assertActive(signal)
    const execution = Effect.gen(function* () {
      const agentService = yield* AgentService
      const agents = yield* agentService.getAllAgents()
      const agentMap = new Map(agents.map((agent) => [agent.id, agent]))
      const workflowEffect = executeWorkflowEffect(workflow, input, {
        agentManager: {
          getAgent: (agentId) => agentMap.get(agentId),
          hasAgent: (agentId) => agentMap.has(agentId),
        },
        conversationId: input.runId,
      })
      const sessions = yield* SessionService
      return yield* sessions.withSession(input.runId, workflowEffect)
    })
    return Runtime.runPromise(fred.runtime)(execution, { signal })
  },
}

export const preflightFredRuntime = (
  config: FredRuntimeConfig,
  factory: FredClientFactory = defaultFactory,
): Effect.Effect<void, ResearchWorkflowError, never> =>
  Effect.flatMap(Clock.currentTimeMillis, (startedAtMs) => {
    const deadlineMs = startedAtMs + config.maxElapsedMs
    return Effect.acquireUseRelease(
      Effect.tryPromise({
        try: async (signal) => {
          const fred = await createFredBeforeDeadline(
            factory,
            config.maxElapsedMs,
            signal,
          )
          if (signal.aborted) {
            void boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
            assertActive(signal)
          }
          return fred
        },
        catch: () =>
          new ResearchWorkflowError({
            stage: 'fred-runtime',
            message: 'Fred runtime could not be created',
          }),
      }),
      (fred) =>
        Effect.tryPromise({
          try: async (signal) => {
            assertActive(signal)
            await fred.providers.use(config.providerPackage)
            assertActive(signal)
          },
          catch: () =>
            new ResearchWorkflowError({
              stage: 'provider-preflight',
              message: 'Fred provider could not be loaded',
            }),
        }),
      (fred) => shutdownWithinDeadline(fred, deadlineMs),
    ).pipe(
      Effect.timeoutFail({
        duration: config.maxElapsedMs,
        onTimeout: () =>
          new ResearchWorkflowError({
            stage: 'provider-preflight',
            message: 'Fred provider preflight exceeded elapsed-time budget',
          }),
      }),
    )
  })

export const runFredWalkingSkeleton = (
  input: typeof Research.WalkingSkeletonResearchInput.Type,
  deps: WalkingSkeleton.WalkingSkeletonGraphDependencies,
  config: FredRuntimeConfig,
  factory: FredClientFactory = defaultFactory,
): Effect.Effect<typeof WalkingSkeletonWorkflowResult.Type, ResearchWorkflowError, never> =>
  Effect.flatMap(Clock.currentTimeMillis, (startedAtMs) => {
    const deadlineMs = startedAtMs + config.maxElapsedMs
    return Effect.acquireUseRelease(
      Effect.tryPromise({
        try: async (signal) => {
          const fred = await createFredBeforeDeadline(
            factory,
            config.maxElapsedMs,
            signal,
          )
          if (signal.aborted) {
            void boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
            assertActive(signal)
          }
          return fred
        },
        catch: () =>
          new ResearchWorkflowError({
            stage: 'fred-runtime',
            message: 'Fred runtime could not be created',
          }),
      }),
      (fred) =>
        Effect.tryPromise({
          try: async (signal) => {
            assertActive(signal)
            const provider = await fred.providers.use(config.providerPackage)
            assertActive(signal)
            await fred.tools.register(makeSearchTextTool(deps.searchText, signal))
            assertActive(signal)
            await fred.agents.register(answerSynthesizerAgent(provider.id, config.model))
            assertActive(signal)
            const workflow = makeWalkingSkeletonWorkflow(deps, signal)
            await fred.workflows.define(workflow)
            assertActive(signal)
            const result = await factory.execute(
              fred,
              workflow,
              input,
              config.maxElapsedMs,
              signal,
            )
            assertActive(signal)
            if (!result.success || result.status !== 'completed') {
              throw result.error ?? new Error(`Fred workflow ended with ${result.status}`)
            }
            return Schema.decodeUnknownSync(WalkingSkeletonWorkflowResult)(result.finalOutput)
          },
          catch: () =>
            new ResearchWorkflowError({
              stage: 'workflow-execution',
              message: 'Fred research workflow failed',
            }),
        }),
      (fred) => shutdownWithinDeadline(fred, deadlineMs),
    ).pipe(
      Effect.timeoutFail({
        duration: config.maxElapsedMs,
        onTimeout: () =>
          new ResearchWorkflowError({
            stage: 'workflow-execution',
            message: 'Fred research workflow exceeded elapsed-time budget',
          }),
      }),
    )
  })
