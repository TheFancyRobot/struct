import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  type ResearchPlan,
} from '@struct/domain'
import { Effect, Either, Schema } from 'effect'
import {
  beginResearchAction,
  completeResearchAction,
  initialResearchGraphState,
  ResearchGraphState,
  type ResearchAction,
  type ResearchExecutionPolicy,
  type ResearchStopReason,
} from '../src/index.js'

const ids = {
  run: ResearchRunId.make('910e8400-e29b-41d4-a716-446655440000'),
  plan: ResearchPlanId.make('910e8400-e29b-41d4-a716-446655440001'),
  workspace: WorkspaceId.make('910e8400-e29b-41d4-a716-446655440002'),
  project: ProjectId.make('910e8400-e29b-41d4-a716-446655440003'),
  node: ResearchPlanNodeId.make('910e8400-e29b-41d4-a716-446655440004'),
  source: SourceVersionId.make('910e8400-e29b-41d4-a716-446655440005'),
}

const policy: ResearchExecutionPolicy = {
  maximumDuplicateActions: 1,
  maximumNoProgressActions: 2,
}

const plan: ResearchPlan = {
  version: '1',
  id: ids.plan,
  runId: ids.run,
  workspaceId: ids.workspace,
  projectId: ids.project,
  objective: 'Find supported evidence.',
  sourceScopes: [{ kind: 'document', sourceVersionId: ids.source }],
  nodes: [{
    id: ids.node,
    kind: 'document-retrieval',
    goal: 'Retrieve evidence.',
    dependencies: [],
    inputRefs: [{ kind: 'source-version', sourceVersionId: ids.source }],
    evidenceRefs: [],
  }],
  evidenceRequirements: [],
  toolPolicy: {
    grants: [{
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
      maximumCalls: 1,
    }],
  },
  budget: {
    maximumSteps: 1,
    maximumModelCalls: 1,
    maximumToolCalls: 1,
    maximumTokens: 1_000,
    maximumElapsedMilliseconds: 100,
    maximumEstimatedCostMicros: 10,
    maximumFanOut: 1,
    maximumRevisions: 0,
  },
}

const toolAction: ResearchAction = {
  kind: 'tool',
  nodeId: ids.node,
  toolId: 'hybrid-retrieval',
  capability: 'document:retrieve',
  fingerprint: `${ids.node}:hybrid-retrieval:document:retrieve`,
  estimatedCostMicros: 5,
}

function state() {
  return initialResearchGraphState({
    runId: ids.run,
    planId: ids.plan,
    workspaceId: ids.workspace,
    projectId: ids.project,
  }, 1_000)
}

async function stopReason(
  candidatePlan: ResearchPlan,
  candidateState: ReturnType<typeof state>,
  action: ResearchAction,
  now = 1_001,
): Promise<ResearchStopReason> {
  const result = await Effect.runPromise(
    Effect.either(
      beginResearchAction(candidatePlan, policy, candidateState, action, now),
    ),
  )
  if (Either.isRight(result)) throw new Error('Expected execution to stop')
  return result.left.reason
}

describe('research budget enforcer', () => {
  it.each([
    [
      'step-budget',
      { steps: 1 },
      toolAction,
      plan,
      1_001,
    ],
    [
      'tool-budget',
      { toolCalls: 1 },
      toolAction,
      plan,
      1_001,
    ],
    [
      'model-budget',
      { modelCalls: 1 },
      {
        kind: 'model',
        nodeId: ids.node,
        role: 'critique',
        fingerprint: `${ids.node}:critique`,
        estimatedCostMicros: 1,
      } satisfies ResearchAction,
      { ...plan, budget: { ...plan.budget, maximumSteps: 2, maximumModelCalls: 1 } },
      1_001,
    ],
    [
      'cost-budget',
      { estimatedCostMicros: 6 },
      toolAction,
      { ...plan, budget: { ...plan.budget, maximumSteps: 2, maximumToolCalls: 2 } },
      1_001,
    ],
    [
      'time-budget',
      {},
      toolAction,
      { ...plan, budget: { ...plan.budget, maximumSteps: 2, maximumToolCalls: 2 } },
      1_101,
    ],
    [
      'concurrency-budget',
      { activeConcurrency: 1 },
      toolAction,
      { ...plan, budget: { ...plan.budget, maximumSteps: 2, maximumToolCalls: 2 } },
      1_001,
    ],
  ] as const)(
    'stops for %s before starting the action',
    async (kind, overrides, action, candidatePlan, now) => {
      expect(
        (await stopReason(
          candidatePlan,
          { ...state(), ...overrides },
          action,
          now,
        )).kind,
      ).toBe(kind)
    },
  )

  it('stops duplicate actions and repeated no-progress before another action', async () => {
    const repeatablePlan = {
      ...plan,
      toolPolicy: {
        grants: [{ ...plan.toolPolicy.grants[0]!, maximumCalls: 2 }],
      },
      budget: { ...plan.budget, maximumSteps: 2, maximumToolCalls: 2 },
    }
    expect((await stopReason(
      repeatablePlan,
      { ...state(), actionFingerprints: [toolAction.fingerprint] },
      toolAction,
    )).kind).toBe('duplicate-action')

    expect((await stopReason(
      repeatablePlan,
      {
        ...state(),
        noProgressCount: policy.maximumNoProgressActions,
        lastProgressFingerprint: 'unchanged',
      },
      toolAction,
    )).kind).toBe('no-progress')
  })

  it('rejects undeclared tools and mismatched capabilities', async () => {
    expect((await stopReason(
      plan,
      state(),
      { ...toolAction, toolId: 'dataset-query', capability: 'dataset:query' },
    )).kind).toBe('undeclared-tool')
    expect((await stopReason(
      plan,
      state(),
      { ...toolAction, capability: 'citation:validate' },
    )).kind).toBe('undeclared-capability')
  })

  it('commits counters and artifact references only after completion', async () => {
    const begun = await Effect.runPromise(
      beginResearchAction(plan, policy, state(), toolAction, 1_001),
    )
    expect(begun.steps).toBe(0)
    expect(begun.activeConcurrency).toBe(1)

    const completed = await Effect.runPromise(completeResearchAction(
      plan,
      begun,
      toolAction,
      {
        progressFingerprint: 'artifact:one',
        artifacts: [{
          digest: Sha256Digest.make(`sha256:${'a'.repeat(64)}`),
          byteLength: 2_000_000,
          mediaType: 'application/json',
        }],
      },
      1_002,
    ))
    expect(completed).toMatchObject({
      steps: 1,
      toolCalls: 1,
      activeConcurrency: 0,
      toolGrantUsage: [{
        toolId: 'hybrid-retrieval',
        capability: 'document:retrieve',
        count: 1,
      }],
      completedNodeIds: [ids.node],
    })
    const encoded = Schema.encodeSync(ResearchGraphState)(completed)
    expect(
      Schema.decodeUnknownSync(ResearchGraphState)(
        JSON.parse(JSON.stringify(encoded)),
      ),
    ).toEqual(completed)
    expect(JSON.stringify(encoded)).not.toContain('large tool output')
    expect(JSON.stringify(encoded).length).toBeLessThan(8_192)
  })

  it('enforces grant usage structurally regardless of caller fingerprint', async () => {
    const grantLimitedPlan = {
      ...plan,
      budget: {
        ...plan.budget,
        maximumSteps: 2,
        maximumToolCalls: 2,
      },
    }
    const begun = await Effect.runPromise(beginResearchAction(
      grantLimitedPlan,
      policy,
      state(),
      { ...toolAction, fingerprint: 'caller-controlled:first' },
      1_001,
    ))
    const completed = await Effect.runPromise(completeResearchAction(
      grantLimitedPlan,
      begun,
      { ...toolAction, fingerprint: 'caller-controlled:first' },
      { progressFingerprint: 'first-result', artifacts: [] },
      1_002,
    ))

    const reason = await stopReason(
      grantLimitedPlan,
      completed,
      { ...toolAction, fingerprint: 'caller-controlled:unrelated' },
      1_003,
    )
    expect(reason).toEqual({
      kind: 'tool-grant-budget',
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
      limit: 1,
      attempted: 2,
    })
  })

  it('does not commit a result that finishes after the elapsed-time ceiling', async () => {
    const begun = await Effect.runPromise(
      beginResearchAction(plan, policy, state(), toolAction, 1_001),
    )
    const completion = await Effect.runPromise(Effect.either(
      completeResearchAction(
        plan,
        begun,
        toolAction,
        { progressFingerprint: 'too-late', artifacts: [] },
        1_101,
      ),
    ))
    expect(Either.isLeft(completion)).toBe(true)
    if (Either.isRight(completion)) throw new Error('Expected time-budget stop')
    expect(completion.left.reason.kind).toBe('time-budget')
    expect(state().completedNodeIds).toEqual([])
  })

  it('rejects aggregate state growth beyond every serialized collection limit before commit', async () => {
    const artifact = {
      digest: Sha256Digest.make(`sha256:${'b'.repeat(64)}`),
      byteLength: 1,
      mediaType: 'application/json',
    }
    const cases = [
      {
        resource: 'artifacts',
        overrides: { artifacts: Array.from({ length: 256 }, () => artifact) },
        result: { progressFingerprint: 'overflow', artifacts: [artifact] },
      },
      {
        resource: 'action-fingerprints',
        overrides: {
          actionFingerprints: Array.from(
            { length: 64 },
            (_, index) => `previous:${index}`,
          ),
        },
        result: { progressFingerprint: 'overflow', artifacts: [] },
      },
      {
        resource: 'completed-node-ids',
        overrides: {
          completedNodeIds: Array.from({ length: 64 }, () => ids.node),
        },
        result: { progressFingerprint: 'overflow', artifacts: [] },
      },
      {
        resource: 'tool-grant-usage',
        overrides: {
          toolGrantUsage: [
            { toolId: 'dataset-query' as const, capability: 'dataset:query' as const, count: 1 },
            { toolId: 'citation-validation' as const, capability: 'citation:validate' as const, count: 1 },
            { toolId: 'directory-navigation' as const, capability: 'directory:navigate' as const, count: 1 },
            { toolId: 'hybrid-retrieval' as const, capability: 'citation:validate' as const, count: 1 },
          ],
        },
        result: { progressFingerprint: 'overflow', artifacts: [] },
      },
      {
        resource: 'tool-grant-calls',
        overrides: {
          toolGrantUsage: [{
            toolId: 'hybrid-retrieval' as const,
            capability: 'document:retrieve' as const,
            count: 256,
          }],
        },
        result: { progressFingerprint: 'overflow', artifacts: [] },
      },
    ] as const

    for (const candidate of cases) {
      const original: typeof ResearchGraphState.Type = {
        ...state(),
        ...candidate.overrides,
      }
      const completion = await Effect.runPromise(Effect.either(
        completeResearchAction(
          plan,
          original,
          toolAction,
          candidate.result,
          1_002,
        ),
      ))
      expect(Either.isLeft(completion)).toBe(true)
      if (Either.isRight(completion)) throw new Error('Expected state-budget stop')
      expect(completion.left.reason).toMatchObject({
        kind: 'state-budget',
        resource: candidate.resource,
      })
      expect(original.steps).toBe(0)
      expect(original.completedNodeIds.length).toBe(
        candidate.resource === 'completed-node-ids' ? 64 : 0,
      )
      expect(original.artifacts.length).toBe(
        candidate.resource === 'artifacts' ? 256 : 0,
      )
    }
  })
})
