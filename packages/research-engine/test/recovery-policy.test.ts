import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ResearchCheckpointId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
  type ResearchExecutionCheckpoint,
  type ResearchPlan,
} from '@struct/domain'
import { Effect, Option } from 'effect'
import { selectResearchRecovery } from '../src/recovery-policy.js'

const ids = {
  run: ResearchRunId.make('780e8400-e29b-41d4-a716-446655440000'),
  plan: ResearchPlanId.make('780e8400-e29b-41d4-a716-446655440001'),
  workspace: WorkspaceId.make('780e8400-e29b-41d4-a716-446655440002'),
  project: ProjectId.make('780e8400-e29b-41d4-a716-446655440003'),
  source: SourceVersionId.make('780e8400-e29b-41d4-a716-446655440004'),
  node: ResearchPlanNodeId.make('780e8400-e29b-41d4-a716-446655440005'),
}
const budget = {
  maximumSteps: 1,
  maximumModelCalls: 0,
  maximumToolCalls: 1,
  maximumTokens: 1,
  maximumElapsedMilliseconds: 1_000,
  maximumEstimatedCostMicros: 1,
  maximumFanOut: 1,
  maximumRevisions: 0,
}
const plan: ResearchPlan = {
  version: '1',
  id: ids.plan,
  runId: ids.run,
  workspaceId: ids.workspace,
  projectId: ids.project,
  objective: 'Retrieve evidence.',
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
  budget,
}
const checkpoint: ResearchExecutionCheckpoint = {
  version: '1',
  id: ResearchCheckpointId.make(
    '780e8400-e29b-41d4-a716-446655440006',
  ),
  state: {
    version: '1',
    runId: ids.run,
    planId: ids.plan,
    status: 'running',
    currentNodeId: ids.node,
    completed: [],
    budget: {
      limits: budget,
      used: {
        steps: 0,
        modelCalls: 0,
        toolCalls: 0,
        tokens: 0,
        elapsedMilliseconds: 0,
        estimatedCostMicros: 0,
        revisions: 0,
      },
    },
    cancellation: 'none',
    duplicateActionCount: 0,
    noProgressCount: 0,
    fredCorrelation: null,
    lastEventSequence: 1,
  },
}

describe('research recovery policy', () => {
  it('resumes only the committed checkpoint for the exact plan', async () => {
    const selected = await Effect.runPromise(selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some(checkpoint),
      cancellationStatus: 'none',
      terminalStatus: Option.none(),
    }))
    expect(selected).toEqual({ kind: 'resume', plan, checkpoint })
  })

  it('gives cancellation and terminal state precedence over replay', async () => {
    expect(await Effect.runPromise(selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some(checkpoint),
      cancellationStatus: 'requested',
      terminalStatus: Option.none(),
    }))).toEqual({ kind: 'cancel' })
    expect(await Effect.runPromise(selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some(checkpoint),
      cancellationStatus: 'none',
      terminalStatus: Option.some('completed'),
    }))).toEqual({ kind: 'terminal', status: 'completed' })
  })

  it('rejects a checkpoint from another run or plan', async () => {
    const exit = await Effect.runPromiseExit(selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some({
        ...checkpoint,
        state: {
          ...checkpoint.state,
          planId: ResearchPlanId.make(
            '780e8400-e29b-41d4-a716-446655440099',
          ),
        },
      }),
      cancellationStatus: 'none',
      terminalStatus: Option.none(),
    }))
    expect(String(exit)).toContain('ResearchContractValidationError')
  })

  it('selects finalize-only recovery for a fully committed paused graph', async () => {
    const finalized = {
      ...checkpoint,
      state: {
        ...checkpoint.state,
        status: 'paused' as const,
        currentNodeId: null,
        completed: [{ nodeId: ids.node, artifacts: [] }],
      },
    }
    expect(await Effect.runPromise(selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some(finalized),
      cancellationStatus: 'none',
      terminalStatus: Option.none(),
    }))).toEqual({ kind: 'finalize', plan, checkpoint: finalized })
  })
})
