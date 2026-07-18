import { Config, Effect, Schema } from 'effect'
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
  readonly create: () => Promise<Fred.FredClient>
  readonly execute?: (
    fred: Fred.FredClient,
    workflow: Fred.WorkflowIR,
    input: typeof Research.WalkingSkeletonResearchInput.Type,
    maxElapsedMs: number,
  ) => Promise<Fred.WorkflowExecutionResult>
}

const defaultFactory: FredClientFactory = {
  create: async () => {
    const { createFred } = await import('@fancyrobot/fred')
    return createFred()
  },
  execute: async (fred, workflow, input, maxElapsedMs) => {
    const {
      AgentService,
      SessionService,
      executeWorkflowEffect,
    } = await import('@fancyrobot/fred/effect')
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
    }).pipe(
      Effect.timeoutFail({
        duration: maxElapsedMs,
        onTimeout: () => new Error('Research workflow exceeded elapsed-time budget'),
      }),
    )
    return fred.effects.run(execution)
  },
}

export const preflightFredRuntime = (
  config: FredRuntimeConfig,
  factory: FredClientFactory = defaultFactory,
): Effect.Effect<void, ResearchWorkflowError, never> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () => factory.create(),
      catch: () =>
        new ResearchWorkflowError({
          stage: 'fred-runtime',
          message: 'Fred runtime could not be created',
        }),
    }),
    (fred) =>
      Effect.tryPromise({
        try: async () => {
          await fred.providers.use(config.providerPackage)
        },
        catch: () =>
          new ResearchWorkflowError({
            stage: 'provider-preflight',
            message: 'Fred provider could not be loaded',
          }),
      }),
    (fred) => Effect.promise(() => fred.shutdown()).pipe(Effect.ignore),
  )

export const runFredWalkingSkeleton = (
  input: typeof Research.WalkingSkeletonResearchInput.Type,
  deps: WalkingSkeleton.WalkingSkeletonGraphDependencies,
  config: FredRuntimeConfig,
  factory: FredClientFactory = defaultFactory,
): Effect.Effect<typeof WalkingSkeletonWorkflowResult.Type, ResearchWorkflowError, never> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () => factory.create(),
      catch: () =>
        new ResearchWorkflowError({
          stage: 'fred-runtime',
          message: 'Fred runtime could not be created',
        }),
    }),
    (fred) =>
      Effect.tryPromise({
        try: async () => {
          const provider = await fred.providers.use(config.providerPackage)
          await fred.tools.register(makeSearchTextTool(deps.searchText))
          await fred.agents.register(answerSynthesizerAgent(provider.id, config.model))
          const workflow = makeWalkingSkeletonWorkflow(deps)
          await fred.workflows.define(workflow)
          const result: Fred.WorkflowExecutionResult = factory.execute
            ? await factory.execute(fred, workflow, input, config.maxElapsedMs)
            : await fred.workflows.run(
                workflow.id,
                input,
                { sessionId: input.runId },
              ) as Fred.WorkflowExecutionResult
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
    (fred) => Effect.promise(() => fred.shutdown()).pipe(Effect.ignore),
  )
