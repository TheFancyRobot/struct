import { Config, Effect, Schema } from 'effect'
import type {
  FredClient,
  WorkflowExecutionResult,
} from '@fancyrobot/fred'
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
  readonly create: () => Promise<FredClient>
}

const defaultFactory: FredClientFactory = {
  create: async () => {
    const { createFred } = await import('@fancyrobot/fred')
    return createFred()
  },
}

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
          let timeout: ReturnType<typeof setTimeout> | undefined
          const timeoutPromise = new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Research workflow exceeded elapsed-time budget')),
              config.maxElapsedMs,
            )
          })
          const result = (await Promise.race([
            fred.workflows.run(workflow.id, input, { sessionId: input.runId }),
            timeoutPromise,
          ]).finally(() => {
            if (timeout) clearTimeout(timeout)
          })) as WorkflowExecutionResult
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
