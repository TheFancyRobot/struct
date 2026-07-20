import { describe, expect, it } from 'bun:test'
import { createFred } from '@fancyrobot/fred'
import {
  DatasetId,
  DatasetSnapshotId,
  EvidenceRequirementId,
  ProjectId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
  type ResearchPlan,
} from '@struct/domain'
import {
  initialResearchGraphState,
  ResearchProviderFailure,
  type ResearchActionResult,
  type ResearchExecutionPolicy,
} from '@struct/research-engine'
import { Deferred, Effect, Fiber, Ref, Schema } from 'effect'
import {
  compileHybridResearchWorkflow,
  HYBRID_RESEARCH_WORKFLOW_ID,
  requiresHybridBranchExecution,
  runHybridResearchGraph,
} from '../src/graphs/hybrid-research.js'
import type {
  ResearchModelResolver,
  ResearchRunGraphDependencies,
  ResearchToolResolver,
} from '../src/graphs/research-run.js'
import type { ResearchModelRoutingPolicy } from '../src/model-routing.js'

const ids = {
  run: ResearchRunId.make('980e8400-e29b-41d4-a716-446655440000'),
  plan: ResearchPlanId.make('980e8400-e29b-41d4-a716-446655440001'),
  workspace: WorkspaceId.make('980e8400-e29b-41d4-a716-446655440002'),
  project: ProjectId.make('980e8400-e29b-41d4-a716-446655440003'),
  source: SourceVersionId.make('980e8400-e29b-41d4-a716-446655440004'),
  dataset: DatasetId.make('980e8400-e29b-41d4-a716-446655440005'),
  snapshot: DatasetSnapshotId.make('980e8400-e29b-41d4-a716-446655440006'),
  documentEvidence: EvidenceRequirementId.make(
    '980e8400-e29b-41d4-a716-446655440007',
  ),
  datasetEvidence: EvidenceRequirementId.make(
    '980e8400-e29b-41d4-a716-446655440008',
  ),
  document: ResearchPlanNodeId.make(
    '980e8400-e29b-41d4-a716-446655440009',
  ),
  datasetQuery: ResearchPlanNodeId.make(
    '980e8400-e29b-41d4-a716-446655440010',
  ),
  synthesis: ResearchPlanNodeId.make(
    '980e8400-e29b-41d4-a716-446655440011',
  ),
}

const plan: ResearchPlan = {
  version: '1',
  id: ids.plan,
  runId: ids.run,
  workspaceId: ids.workspace,
  projectId: ids.project,
  objective: 'Combine document evidence with an exact dataset count.',
  sourceScopes: [
    { kind: 'document', sourceVersionId: ids.source },
    {
      kind: 'dataset',
      datasetId: ids.dataset,
      datasetSnapshotId: ids.snapshot,
      sourceVersionIds: [ids.source],
    },
  ],
  nodes: [
    {
      id: ids.synthesis,
      kind: 'answer-synthesis',
      goal: 'Synthesize all selected evidence.',
      dependencies: [ids.document, ids.datasetQuery],
      inputRefs: [
        { kind: 'node-output', nodeId: ids.document },
        { kind: 'node-output', nodeId: ids.datasetQuery },
      ],
      evidenceRefs: [ids.documentEvidence, ids.datasetEvidence],
    },
    {
      id: ids.datasetQuery,
      kind: 'dataset-query',
      goal: 'Count rows.',
      dependencies: [],
      inputRefs: [{
        kind: 'dataset-snapshot',
        datasetId: ids.dataset,
        datasetSnapshotId: ids.snapshot,
      }],
      evidenceRefs: [ids.datasetEvidence],
      toolInput: {
        kind: 'dataset-query',
        operation: 'count',
        snapshot: {
          alias: 'records',
          datasetId: ids.dataset,
          datasetSnapshotId: ids.snapshot,
        },
        columns: [],
        rowLimit: 1,
        limits: {
          maxRows: 1,
          maxOutputBytes: 1_024,
          maxMemoryMb: 64,
          timeoutMs: 1_000,
        },
      },
    },
    {
      id: ids.document,
      kind: 'document-retrieval',
      goal: 'Retrieve policy evidence.',
      dependencies: [],
      inputRefs: [{ kind: 'source-version', sourceVersionId: ids.source }],
      evidenceRefs: [ids.documentEvidence],
    },
  ],
  evidenceRequirements: [
    {
      id: ids.documentEvidence,
      kind: 'document',
      sourceVersionIds: [ids.source],
      minimumCitations: 1,
    },
    {
      id: ids.datasetEvidence,
      kind: 'dataset',
      datasetId: ids.dataset,
      datasetSnapshotId: ids.snapshot,
      minimumCitations: 1,
    },
  ],
  toolPolicy: {
    grants: [
      {
        toolId: 'hybrid-retrieval',
        capability: 'document:retrieve',
        maximumCalls: 1,
      },
      {
        toolId: 'dataset-query',
        capability: 'dataset:query',
        maximumCalls: 1,
      },
    ],
  },
  budget: {
    maximumSteps: 3,
    maximumModelCalls: 1,
    maximumToolCalls: 2,
    maximumTokens: 10_000,
    maximumElapsedMilliseconds: 10_000,
    maximumEstimatedCostMicros: 10,
    maximumFanOut: 2,
    maximumRevisions: 0,
  },
}

const routing: ResearchModelRoutingPolicy = {
  classification: {
    primary: {
      platform: 'mock',
      model: 'classifier',
      maxSteps: 1,
      outputContract: 'question-classification.v1',
    },
    fallback: null,
  },
  planning: {
    primary: {
      platform: 'mock',
      model: 'planner',
      maxSteps: 1,
      outputContract: 'research-plan.v1',
    },
    fallback: null,
  },
  critique: {
    primary: {
      platform: 'mock',
      model: 'critic',
      maxSteps: 1,
      outputContract: 'evidence-assessment.v1',
    },
    fallback: null,
  },
  synthesis: {
    primary: {
      platform: 'mock',
      model: 'synthesis',
      maxSteps: 1,
      outputContract: 'research-answer.v1',
    },
    fallback: null,
  },
}
const policy: ResearchExecutionPolicy = {
  maximumDuplicateActions: 1,
  maximumNoProgressActions: 2,
}
const result = (fingerprint: string): ResearchActionResult => ({
  progressFingerprint: fingerprint,
  artifacts: [],
})
const initial = () => initialResearchGraphState({
  runId: ids.run,
  planId: ids.plan,
  workspaceId: ids.workspace,
  projectId: ids.project,
}, 1_000)

describe('hybrid research graph', () => {
  it('overlaps document and dataset tools, then waits to synthesize', async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const bothStarted = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const active = yield* Ref.make(0)
      const maximum = yield* Ref.make(0)
      const synthesisSaw = yield* Ref.make(0)
      const tools: ResearchToolResolver = {
        resolve: () => Effect.succeed({
          execute: (node) => Effect.gen(function* () {
            const count = yield* Ref.updateAndGet(active, (value) => value + 1)
            yield* Ref.update(maximum, (value) => Math.max(value, count))
            if (count === 2) yield* Deferred.succeed(bothStarted, undefined)
            yield* Deferred.await(bothStarted)
            yield* Deferred.await(release)
            yield* Ref.update(active, (value) => value - 1)
            return result(`progress:${node.id}`)
          }),
        }),
      }
      const models: ResearchModelResolver = {
        resolve: () => Effect.succeed({
          execute: (node) => Ref.get(active).pipe(
            Effect.tap((count) => Ref.set(synthesisSaw, count)),
            Effect.as(result(`progress:${node.id}`)),
          ),
        }),
      }
      let now = 1_000
      const final = yield* runHybridResearchGraph(
        plan,
        initial(),
        routing,
        policy,
        {
          tools,
          models,
          now: () => ++now,
          estimatedCostMicros: () => 1,
        },
        new AbortController().signal,
      ).pipe(
        Effect.fork,
        Effect.tap(() => Deferred.await(bothStarted)),
        Effect.tap(() => Deferred.succeed(release, undefined)),
        Effect.flatMap(Fiber.join),
      )

      expect(yield* Ref.get(maximum)).toBe(2)
      expect(yield* Ref.get(synthesisSaw)).toBe(0)
      expect(final).toMatchObject({
        status: 'completed',
        steps: 3,
        toolCalls: 2,
        modelCalls: 1,
        activeConcurrency: 0,
        completedNodeIds: [
          ids.document,
          ids.datasetQuery,
          ids.synthesis,
        ].sort(),
      })
    }))
  })

  it('interrupts a sibling after a typed branch failure', async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const datasetStarted = yield* Deferred.make<void>()
      const interrupted = yield* Ref.make(false)
      const tools: ResearchToolResolver = {
        resolve: (toolId) => Effect.succeed({
          execute: () => Effect.gen(function* () {
            if (toolId === 'hybrid-retrieval') {
              yield* Deferred.await(datasetStarted)
              return yield* Effect.fail(new ResearchProviderFailure({
                message: 'Document provider failed',
              }))
            }
            yield* Deferred.succeed(datasetStarted, undefined)
            return yield* Effect.never.pipe(
              Effect.onInterrupt(() => Ref.set(interrupted, true)),
            )
          }),
        }),
      }
      const outcome = yield* runHybridResearchGraph(
        plan,
        initial(),
        routing,
        policy,
        {
          tools,
          models: { resolve: () => Effect.die('synthesis must not run') },
          now: () => 1_001,
          estimatedCostMicros: () => 1,
        },
        new AbortController().signal,
      ).pipe(Effect.either)
      expect(outcome._tag).toBe('Left')
      expect(yield* Ref.get(interrupted)).toBe(true)
    }))
  })

  it('reserves global budgets before concurrent providers start', async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const interrupted = yield* Ref.make(false)
      const constrained: ResearchPlan = {
        ...plan,
        budget: { ...plan.budget, maximumToolCalls: 1 },
      }
      const outcome = yield* runHybridResearchGraph(
        constrained,
        initial(),
        routing,
        policy,
        {
          tools: {
            resolve: () => Effect.succeed({
              execute: () => Effect.never.pipe(
                Effect.onInterrupt(() => Ref.set(interrupted, true)),
              ),
            }),
          },
          models: { resolve: () => Effect.die('synthesis must not run') },
          now: () => 1_001,
          estimatedCostMicros: () => 1,
        },
        new AbortController().signal,
      ).pipe(Effect.either)
      expect(outcome._tag).toBe('Left')
      if (outcome._tag === 'Left' && '_tag' in outcome.left) {
        expect(outcome.left._tag).toBe('ResearchExecutionStopped')
        if (outcome.left._tag === 'ResearchExecutionStopped') {
          expect(outcome.left.reason.kind).toBe('tool-budget')
        }
      }
      expect(yield* Ref.get(interrupted)).toBe(true)
    }))
  })

  it('runs the hybrid coordinator through providerless core Fred', async () => {
    const deps: ResearchRunGraphDependencies = {
      tools: {
        resolve: () => Effect.succeed({
          execute: (node) => Effect.succeed(result(`progress:${node.id}`)),
        }),
      },
      models: {
        resolve: () => Effect.succeed({
          execute: (node) => Effect.succeed(result(`progress:${node.id}`)),
        }),
      },
      now: () => 1_001,
      estimatedCostMicros: () => 1,
    }
    expect(requiresHybridBranchExecution(plan)).toBe(true)
    const workflow = await Effect.runPromise(compileHybridResearchWorkflow(
      plan,
      routing,
      policy,
      deps,
    ))
    const fred = await createFred()
    try {
      await fred.workflows.define(workflow)
      const execution = await fred.workflows.run(
        HYBRID_RESEARCH_WORKFLOW_ID,
        initial(),
      )
      expect(execution.success).toBe(true)
      if (!('finalOutput' in execution)) {
        throw new Error('Core Fred did not return a terminal output')
      }
      expect(Schema.decodeUnknownSync(
        Schema.Struct({ status: Schema.Literal('completed') }),
      )(execution.finalOutput).status).toBe('completed')
    } finally {
      await fred.shutdown()
    }
  })

  it('rejects a mismatched fully-completed checkpoint before provider work', async () => {
    const mismatched = {
      ...initial(),
      runId: ResearchRunId.make(
        '980e8400-e29b-41d4-a716-446655449999',
      ),
      status: 'completed' as const,
      completedNodeIds: plan.nodes.map((node) => node.id),
    }
    const outcome = await Effect.runPromise(runHybridResearchGraph(
      plan,
      mismatched,
      routing,
      policy,
      {
        tools: { resolve: () => Effect.die('tool must not resolve') },
        models: { resolve: () => Effect.die('model must not resolve') },
        now: () => 1_001,
        estimatedCostMicros: () => 1,
      },
      new AbortController().signal,
    ).pipe(Effect.either))

    expect(outcome._tag).toBe('Left')
    if (outcome._tag === 'Left') {
      expect(outcome.left._tag).toBe('ResearchExecutionStopped')
      if (outcome.left._tag === 'ResearchExecutionStopped') {
        expect(outcome.left.reason).toEqual({
          kind: 'state-mismatch',
          field: 'runId',
        })
      }
    }
  })
})
