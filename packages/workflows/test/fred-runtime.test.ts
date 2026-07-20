import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
  type ResearchPlan,
} from '@struct/domain'
import { initialResearchGraphState } from '@struct/research-engine'
import { Effect, Exit } from 'effect'
import {
  runFredResearchCritique,
  runFredBoundedResearchGraph,
  runFredResearchSynthesis,
  type FredClientFactory,
} from '../src/index.js'

const input = {
  question: 'What happened?',
  node: {
    id: ResearchPlanNodeId.make('760e8400-e29b-41d4-a716-446655440000'),
    kind: 'answer-synthesis' as const,
    goal: 'Answer the question.',
    dependencies: [],
    inputRefs: [],
    evidenceRefs: [],
  },
  evidence: [],
  datasetResults: [],
}
const config = {
  providerPackage: 'unused',
  model: 'unused',
  maxElapsedMs: 5,
}

const hangingFactory: FredClientFactory = {
  create: () => new Promise(() => undefined),
  execute: () => Promise.reject(new Error('must not execute')),
}

describe('Fred research model deadlines', () => {
  it('bounds critique runtime creation with a typed provider failure', async () => {
    const exit = await Effect.runPromiseExit(
      runFredResearchCritique(
        input,
        config.model,
        config,
        hangingFactory,
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(String(exit)).toContain('ResearchProviderFailure')
  })

  it('bounds synthesis runtime creation with a typed provider failure', async () => {
    const exit = await Effect.runPromiseExit(
      runFredResearchSynthesis(
        input,
        config.model,
        config,
        hangingFactory,
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(String(exit)).toContain('ResearchProviderFailure')
  })

  it('aborts bounded-graph client creation through the deadline signal', async () => {
    const runId = ResearchRunId.make(
      '760e8400-e29b-41d4-a716-446655440001',
    )
    const workspaceId = WorkspaceId.make(
      '760e8400-e29b-41d4-a716-446655440002',
    )
    const projectId = ProjectId.make(
      '760e8400-e29b-41d4-a716-446655440003',
    )
    const planId = ResearchPlanId.make(
      '760e8400-e29b-41d4-a716-446655440004',
    )
    const sourceVersionId = SourceVersionId.make(
      '760e8400-e29b-41d4-a716-446655440005',
    )
    const plan: ResearchPlan = {
      version: '1',
      id: planId,
      runId,
      workspaceId,
      projectId,
      objective: 'Bound creation.',
      sourceScopes: [{ kind: 'document', sourceVersionId }],
      nodes: [input.node],
      evidenceRequirements: [],
      toolPolicy: { grants: [] },
      budget: {
        maximumSteps: 1,
        maximumModelCalls: 1,
        maximumToolCalls: 0,
        maximumTokens: 100,
        maximumElapsedMilliseconds: 5,
        maximumEstimatedCostMicros: 10,
        maximumFanOut: 1,
        maximumRevisions: 0,
      },
    }
    let creationSignal: AbortSignal | undefined
    const factory: FredClientFactory = {
      create: (signal) => {
        creationSignal = signal
        return new Promise(() => undefined)
      },
      execute: () => Promise.reject(new Error('must not execute')),
    }
    const route = {
      primary: {
        platform: 'unused',
        model: 'unused',
        maxSteps: 1 as const,
        outputContract: 'research-answer.v1' as const,
      },
      fallback: null,
    }
    const exit = await Effect.runPromiseExit(runFredBoundedResearchGraph(
      plan,
      initialResearchGraphState({
        runId,
        planId,
        workspaceId,
        projectId,
      }, 0),
      {
        classification: {
          ...route,
          primary: {
            ...route.primary,
            outputContract: 'question-classification.v1',
          },
        },
        planning: {
          ...route,
          primary: { ...route.primary, outputContract: 'research-plan.v1' },
        },
        critique: {
          ...route,
          primary: {
            ...route.primary,
            outputContract: 'evidence-assessment.v1',
          },
        },
        synthesis: route,
      },
      { maximumDuplicateActions: 1, maximumNoProgressActions: 1 },
      {
        tools: {
          resolve: () => Effect.dieMessage('must not resolve tools'),
        },
        models: {
          resolve: () => Effect.dieMessage('must not resolve models'),
        },
        now: () => 0,
        estimatedCostMicros: () => 0,
        isCancellationRequested: () => Effect.succeed(false),
      },
      config,
      new AbortController().signal,
      factory,
    ))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(creationSignal?.aborted).toBe(true)
  })
})
