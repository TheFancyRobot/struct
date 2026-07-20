/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Clock, Config, Effect, Runtime, Schema } from 'effect'
import type * as Fred from '@fancyrobot/fred'
import {
  EvidenceContradictionError,
  EvidenceInsufficientError,
  type ResearchContractValidationError as typeResearchContractValidationError,
  ResearchCitationValidationError,
  type ResearchPlan as typeResearchPlan,
  type ResearchAnswer as typeResearchAnswer,
  ResearchWorkflowError,
  RetrievalQueryError,
} from '@struct/domain'
import { tracingOtlpEndpointConfig } from '@struct/observability'
import {
  DocumentResearchWorkflowResult,
  type ResearchExecutionPolicy as typeResearchExecutionPolicy,
  ResearchGraphState,
  ResearchProviderFailure,
  validateResearchPlan,
  WalkingSkeletonWorkflowResult,
} from '@struct/research-engine'
import type * as Research from '@struct/research-engine'
import {
  documentPlannerAgent,
  documentSynthesizerAgent,
  evidenceCriticAgent,
  makeDocumentResearchWorkflow,
  makeHybridDocumentRetrievalTool,
} from '../graphs/document-research.js'
import type * as DocumentResearch from '../graphs/document-research.js'
import {
  answerSynthesizerAgent,
  makeSearchTextTool,
  makeWalkingSkeletonWorkflow,
} from '../graphs/walking-skeleton.js'
import type * as WalkingSkeleton from '../graphs/walking-skeleton.js'
import {
  compileResearchRunWorkflow,
  type ResearchRunGraphDependencies as typeResearchRunGraphDependencies,
} from '../graphs/research-run.js'
import type {
  ResearchModelRoutingPolicy as typeResearchModelRoutingPolicy,
} from '../model-routing.js'
import {
  questionClassifierAgent,
  type QuestionClassifierInput as typeQuestionClassifierInput,
} from '../agents/question-classifier.js'
import {
  researchPlannerAgent,
  type ResearchPlannerInput as typeResearchPlannerInput,
} from '../agents/research-planner.js'
import {
  researchAnswerAgent,
  researchEvidenceCriticAgent,
  type ResearchEvidenceAgentInput as typeResearchEvidenceAgentInput,
  type ResearchEvidenceAssessment as typeResearchEvidenceAssessment,
} from '../agents/research-execution.js'
import {
  corpusAnalystAgent,
  CorpusAnalystInput,
  CorpusAnalystOutput,
} from '../agents/corpus-analyst.js'
import {
  HierarchicalSynthesisInput,
  HierarchicalSynthesisOutput,
  hierarchicalSynthesizerAgent,
  RecursiveEvidenceCriticInput,
  RecursiveEvidenceCriticOutput,
  recursiveEvidenceCriticAgent,
} from '../agents/evidence-critic.js'
import {
  makeCorpusAnalysisWorkflow,
  makeHierarchicalSynthesisWorkflow,
  makeRecursiveCritiqueWorkflow,
} from '../graphs/recursive-synthesis.js'
/* eslint-enable no-unused-vars */

export interface FredRuntimeConfig {
  readonly providerPackage: string
  readonly model: string
  readonly maxElapsedMs: number
  readonly otlpEndpoint?: string
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
  otlpEndpoint: tracingOtlpEndpointConfig,
})

export interface FredClientFactory {
  readonly create: (signal: AbortSignal) => Promise<Fred.FredClient>
  readonly execute: (
    fred: Fred.FredClient,
    workflow: Fred.WorkflowIR,
    input:
      | typeof Research.WalkingSkeletonResearchInput.Type
      | typeof Research.DocumentResearchInput.Type
      | typeof ResearchGraphState.Type
      | typeof CorpusAnalystInput.Type
      | typeof RecursiveEvidenceCriticInput.Type
      | typeof HierarchicalSynthesisInput.Type,
    maxElapsedMs: number,
    signal: AbortSignal,
  ) => Promise<Fred.WorkflowExecutionResult>
}

export type DocumentResearchFailure =
  | EvidenceInsufficientError
  | EvidenceContradictionError
  | ResearchCitationValidationError
  | RetrievalQueryError
  | ResearchWorkflowError

function documentResearchFailure(
  cause: unknown,
): DocumentResearchFailure {
  let current = cause
  for (let depth = 0; depth < 5; depth += 1) {
    if (
      current instanceof EvidenceInsufficientError
      || current instanceof EvidenceContradictionError
      || current instanceof ResearchCitationValidationError
      || current instanceof RetrievalQueryError
      || current instanceof ResearchWorkflowError
    ) {
      return current
    }
    if (
      typeof current !== 'object'
      || current === null
      || !('cause' in current)
    ) {
      break
    }
    current = current.cause
  }
  return new ResearchWorkflowError({
    stage: 'workflow-execution',
    message: 'Fred document research workflow failed',
  })
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

const makeDefaultFactory = (
  otlpEndpoint: string | undefined,
): FredClientFactory => ({
  create: async (signal) => {
    const { createFred } = await import('@fancyrobot/fred')
    assertActive(signal)
    return createFred({
      observability: {
        resource: { serviceName: '@struct/workflows' },
        enableConsoleFallback: true,
        ...(otlpEndpoint === undefined
          ? {}
          : {
              otlp: {
                endpoint: otlpEndpoint,
              },
            }),
      },
    })
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
})

export const preflightFredRuntime = (
  config: FredRuntimeConfig,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
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

export const runFredResearchPlanning = (
  input: {
    readonly classifier: typeQuestionClassifierInput
    readonly planner: Omit<typeResearchPlannerInput, 'classification'>
  },
  config: FredRuntimeConfig,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<
  typeResearchPlan,
  typeResearchContractValidationError | ResearchWorkflowError,
  never
> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: (signal) => createFredBeforeDeadline(
        factory,
        config.maxElapsedMs,
        signal,
      ),
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
          const classifier = await fred.agents.register(
            questionClassifierAgent(provider.id, config.model),
          )
          const planner = await fred.agents.register(
            researchPlannerAgent(provider.id, config.model),
          )
          const classification = await Runtime.runPromise(fred.runtime)(
            classifier.run(input.classifier, [], {
              sessionId: input.planner.runId,
            }),
            { signal },
          )
          if (classification.output === undefined) {
            throw new Error('Question classifier returned no typed output')
          }
          const planningInput: typeResearchPlannerInput = {
            ...input.planner,
            classification: classification.output,
          }
          const proposal = await Runtime.runPromise(fred.runtime)(
            planner.run(planningInput, [], {
              sessionId: input.planner.runId,
            }),
            { signal },
          )
          if (proposal.output === undefined) {
            throw new Error('Research planner returned no typed output')
          }
          return { planningInput, proposal: proposal.output }
        },
        catch: () =>
          new ResearchWorkflowError({
            stage: 'research-planning-provider',
            message: 'Research planning provider failed',
          }),
      }).pipe(
        Effect.flatMap(({ planningInput, proposal }) =>
          validateResearchPlan(planningInput, proposal),
        ),
      ),
    (fred) => Effect.promise(() =>
      boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
    ),
  ).pipe(
    Effect.timeoutFail({
      duration: config.maxElapsedMs,
      onTimeout: () =>
        new ResearchWorkflowError({
          stage: 'research-planning-provider',
          message: 'Research planning exceeded elapsed-time budget',
        }),
    }),
  )

export const runFredBoundedResearchGraph = (
  plan: typeResearchPlan,
  initialState: typeof ResearchGraphState.Type,
  routing: typeResearchModelRoutingPolicy,
  policy: typeResearchExecutionPolicy,
  dependencies: typeResearchRunGraphDependencies,
  config: FredRuntimeConfig,
  signal: AbortSignal,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<
  typeof ResearchGraphState.Type,
  ResearchWorkflowError,
  never
> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: (deadlineSignal) => createFredBeforeDeadline(
        factory,
        config.maxElapsedMs,
        AbortSignal.any([deadlineSignal, signal]),
      ),
      catch: () =>
        new ResearchWorkflowError({
          stage: 'fred-runtime',
          message: 'Fred runtime could not be created',
        }),
    }),
    (fred) =>
      Effect.gen(function* () {
        const workflow = yield* compileResearchRunWorkflow(
          plan,
          routing,
          policy,
          dependencies,
          signal,
        ).pipe(
          Effect.mapError(() =>
            new ResearchWorkflowError({
              stage: 'workflow-compilation',
              message: 'Bounded research graph could not be compiled',
            })),
        )
        const result = yield* Effect.tryPromise({
          try: (deadlineSignal) => factory.execute(
            fred,
            workflow,
            initialState,
            config.maxElapsedMs,
            AbortSignal.any([deadlineSignal, signal]),
          ),
          catch: () =>
            new ResearchWorkflowError({
              stage: 'workflow-execution',
              message: 'Bounded research graph failed',
            }),
        })
        if (!result.success || result.status !== 'completed') {
          return yield* new ResearchWorkflowError({
            stage: 'workflow-execution',
            message: 'Bounded research graph did not complete',
          })
        }
        return yield* Schema.decodeUnknown(ResearchGraphState)(
          result.finalOutput,
        ).pipe(
          Effect.mapError(() =>
            new ResearchWorkflowError({
              stage: 'workflow-output',
              message: 'Bounded research graph output was invalid',
            })),
        )
      }),
    (fred) => Effect.promise(() =>
      boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
    ),
  ).pipe(
    Effect.timeoutFail({
      duration: config.maxElapsedMs,
      onTimeout: () =>
        new ResearchWorkflowError({
          stage: 'workflow-execution',
          message: 'Bounded research graph exceeded elapsed-time budget',
        }),
    }),
  )

type RecursiveFocusedInput =
  | typeof CorpusAnalystInput.Type
  | typeof RecursiveEvidenceCriticInput.Type
  | typeof HierarchicalSynthesisInput.Type

const runFredRecursiveFocusedWorkflow = (
  input: RecursiveFocusedInput,
  workflow: Fred.WorkflowIR,
  register: (
    fred: Fred.FredClient,
    providerId: string,
  ) => Promise<void>,
  config: FredRuntimeConfig,
  signal: AbortSignal,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<
  unknown,
  ResearchProviderFailure,
  never
> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: (deadlineSignal) => createFredBeforeDeadline(
        factory,
        config.maxElapsedMs,
        AbortSignal.any([deadlineSignal, signal]),
      ),
      catch: () =>
        new ResearchProviderFailure({
          message: 'Recursive synthesis runtime failed',
        }),
    }),
    (fred) =>
      Effect.tryPromise({
        try: async (deadlineSignal) => {
          const combinedSignal = AbortSignal.any([deadlineSignal, signal])
          assertActive(combinedSignal)
          const provider = await fred.providers.use(config.providerPackage)
          assertActive(combinedSignal)
          await register(fred, provider.id)
          assertActive(combinedSignal)
          const result = await factory.execute(
            fred,
            workflow,
            input,
            config.maxElapsedMs,
            combinedSignal,
          )
          if (!result.success || result.status !== 'completed') {
            throw new Error('Recursive synthesis workflow did not complete')
          }
          return result.finalOutput
        },
        catch: () =>
          new ResearchProviderFailure({
            message: 'Recursive synthesis provider failed',
          }),
      }),
    (fred) => Effect.promise(() =>
      boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
    ),
  ).pipe(
    Effect.timeoutFail({
      duration: config.maxElapsedMs,
      onTimeout: () =>
        new ResearchProviderFailure({
          message: 'Recursive synthesis exceeded elapsed-time budget',
        }),
    }),
  )

export const runFredCorpusAnalysis = (
  input: typeof CorpusAnalystInput.Type,
  config: FredRuntimeConfig,
  signal: AbortSignal,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<
  typeof CorpusAnalystOutput.Type,
  ResearchProviderFailure,
  never
> =>
  runFredRecursiveFocusedWorkflow(
    input,
    makeCorpusAnalysisWorkflow(),
    async (fred, providerId) => {
      await fred.agents.register(corpusAnalystAgent(providerId, config.model))
    },
    config,
    signal,
    factory,
  ).pipe(
    Effect.flatMap((output) =>
      Schema.decodeUnknown(CorpusAnalystOutput)(output).pipe(
        Effect.mapError(() =>
          new ResearchProviderFailure({
            message: 'Corpus analyst returned invalid typed output',
          })),
      ),
    ),
  )

export const runFredRecursiveCritique = (
  input: typeof RecursiveEvidenceCriticInput.Type,
  config: FredRuntimeConfig,
  signal: AbortSignal,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<
  typeof RecursiveEvidenceCriticOutput.Type,
  ResearchProviderFailure,
  never
> =>
  runFredRecursiveFocusedWorkflow(
    input,
    makeRecursiveCritiqueWorkflow(),
    async (fred, providerId) => {
      await fred.agents.register(
        recursiveEvidenceCriticAgent(providerId, config.model),
      )
    },
    config,
    signal,
    factory,
  ).pipe(
    Effect.flatMap((output) =>
      Schema.decodeUnknown(RecursiveEvidenceCriticOutput)(output).pipe(
        Effect.mapError(() =>
          new ResearchProviderFailure({
            message: 'Recursive critic returned invalid typed output',
          })),
      ),
    ),
  )

export const runFredHierarchicalSynthesis = (
  input: typeof HierarchicalSynthesisInput.Type,
  config: FredRuntimeConfig,
  signal: AbortSignal,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<
  typeof HierarchicalSynthesisOutput.Type,
  ResearchProviderFailure,
  never
> =>
  runFredRecursiveFocusedWorkflow(
    input,
    makeHierarchicalSynthesisWorkflow(),
    async (fred, providerId) => {
      await fred.agents.register(
        hierarchicalSynthesizerAgent(providerId, config.model),
      )
    },
    config,
    signal,
    factory,
  ).pipe(
    Effect.flatMap((output) =>
      Schema.decodeUnknown(HierarchicalSynthesisOutput)(output).pipe(
        Effect.mapError(() =>
          new ResearchProviderFailure({
            message: 'Hierarchical synthesizer returned invalid typed output',
          })),
      ),
    ),
  )

export const runFredResearchCritique = (
  input: typeResearchEvidenceAgentInput,
  model: string,
  config: FredRuntimeConfig,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<
  typeResearchEvidenceAssessment,
  ResearchProviderFailure,
  never
> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: (signal) => createFredBeforeDeadline(
        factory,
        config.maxElapsedMs,
        signal,
      ),
      catch: () =>
        new ResearchProviderFailure({
          message: 'Critique model runtime failed',
        }),
    }),
    (fred) =>
      Effect.tryPromise({
        try: async (signal) => {
          const provider = await fred.providers.use(config.providerPackage)
          const agent = await fred.agents.register(
            researchEvidenceCriticAgent(provider.id, model),
          )
          const response = await Runtime.runPromise(fred.runtime)(
            agent.run(input),
            { signal },
          )
          if (response.output === undefined) {
            throw new Error('Critique model returned no typed output')
          }
          return response.output
        },
        catch: () =>
          new ResearchProviderFailure({
            message: 'Critique model failed',
          }),
      }),
    (fred) => Effect.promise(() =>
      boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
    ),
  ).pipe(
    Effect.timeoutFail({
      duration: config.maxElapsedMs,
      onTimeout: () =>
        new ResearchProviderFailure({
          message: 'Critique model exceeded elapsed-time budget',
        }),
    }),
  )

export const runFredResearchSynthesis = (
  input: typeResearchEvidenceAgentInput,
  model: string,
  config: FredRuntimeConfig,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<typeResearchAnswer, ResearchProviderFailure, never> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: (signal) => createFredBeforeDeadline(
        factory,
        config.maxElapsedMs,
        signal,
      ),
      catch: () =>
        new ResearchProviderFailure({
          message: 'Synthesis model runtime failed',
        }),
    }),
    (fred) =>
      Effect.tryPromise({
        try: async (signal) => {
          const provider = await fred.providers.use(config.providerPackage)
          const agent = await fred.agents.register(
            researchAnswerAgent(provider.id, model),
          )
          const response = await Runtime.runPromise(fred.runtime)(
            agent.run(input),
            { signal },
          )
          if (response.output === undefined) {
            throw new Error('Synthesis model returned no typed output')
          }
          return response.output
        },
        catch: () =>
          new ResearchProviderFailure({
            message: 'Synthesis model failed',
          }),
      }),
    (fred) => Effect.promise(() =>
      boundedShutdown(fred, EMERGENCY_SHUTDOWN_MS)
    ),
  ).pipe(
    Effect.timeoutFail({
      duration: config.maxElapsedMs,
      onTimeout: () =>
        new ResearchProviderFailure({
          message: 'Synthesis model exceeded elapsed-time budget',
        }),
    }),
  )

export const runFredWalkingSkeleton = (
  input: typeof Research.WalkingSkeletonResearchInput.Type,
  deps: WalkingSkeleton.WalkingSkeletonGraphDependencies,
  config: FredRuntimeConfig,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
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

export const runFredDocumentResearch = (
  input: typeof Research.DocumentResearchInput.Type,
  deps: DocumentResearch.DocumentResearchGraphDependencies,
  config: FredRuntimeConfig,
  factory: FredClientFactory = makeDefaultFactory(config.otlpEndpoint),
): Effect.Effect<typeof DocumentResearchWorkflowResult.Type, DocumentResearchFailure, never> =>
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
            await fred.tools.register(
              makeHybridDocumentRetrievalTool(deps.buildContext, signal),
            )
            assertActive(signal)
            await fred.agents.register(
              documentPlannerAgent(provider.id, config.model),
            )
            assertActive(signal)
            await fred.agents.register(
              evidenceCriticAgent(provider.id, config.model),
            )
            assertActive(signal)
            await fred.agents.register(
              documentSynthesizerAgent(provider.id, config.model),
            )
            assertActive(signal)
            const workflow = makeDocumentResearchWorkflow(deps, signal)
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
              throw result.error
                ?? new Error(`Fred workflow ended with ${result.status}`)
            }
            return Schema.decodeUnknownSync(DocumentResearchWorkflowResult)(
              result.finalOutput,
            )
          },
          catch: documentResearchFailure,
        }),
      (fred) => shutdownWithinDeadline(fred, deadlineMs),
    ).pipe(
      Effect.timeoutFail({
        duration: config.maxElapsedMs,
        onTimeout: () =>
          new ResearchWorkflowError({
            stage: 'workflow-execution',
            message: 'Fred document research exceeded elapsed-time budget',
          }),
      }),
    )
  })
