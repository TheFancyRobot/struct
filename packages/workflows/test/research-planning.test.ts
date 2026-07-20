import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ResearchPlanId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { Schema } from 'effect'
import {
  QUESTION_CLASSIFIER_AGENT_ID,
  QuestionClassifierInput,
  questionClassifierAgent,
  RESEARCH_PLANNER_AGENT_ID,
  ResearchPlannerInput,
  researchPlannerAgent,
  researchPlannerProviderFailure,
} from '../src/index.js'

const ids = {
  workspace: WorkspaceId.make('930e8400-e29b-41d4-a716-446655440000'),
  project: ProjectId.make('930e8400-e29b-41d4-a716-446655440001'),
  run: ResearchRunId.make('930e8400-e29b-41d4-a716-446655440002'),
  plan: ResearchPlanId.make('930e8400-e29b-41d4-a716-446655440003'),
  sourceVersion: SourceVersionId.make(
    '930e8400-e29b-41d4-a716-446655440004',
  ),
}

const sourceScopes = [{
  kind: 'document' as const,
  sourceVersionId: ids.sourceVersion,
}]

describe('Fred research-planning agents', () => {
  it('keeps the classifier and planner to one tool-free model step', () => {
    const classifier = questionClassifierAgent('mock', 'fixed')
    const planner = researchPlannerAgent('mock', 'fixed')

    expect(classifier.id).toBe(QUESTION_CLASSIFIER_AGENT_ID)
    expect(planner.id).toBe(RESEARCH_PLANNER_AGENT_ID)
    for (const agent of [classifier, planner]) {
      expect(agent.maxSteps).toBe(1)
      expect(agent.toolChoice).toBe('none')
      expect(agent.tools).toBeUndefined()
      expect(agent.systemMessage).toContain('Do not invoke tools')
    }
  })

  it('preserves immutable scope and ceilings in schema-decoded planner input', () => {
    const classifierInput = Schema.decodeUnknownSync(QuestionClassifierInput)({
      workspaceId: ids.workspace,
      projectId: ids.project,
      question: 'What does the policy require?',
      sourceScopes,
    })
    const plannerInput = Schema.decodeUnknownSync(ResearchPlannerInput)({
      ...classifierInput,
      planId: ids.plan,
      runId: ids.run,
      classification: {
        version: '1',
        kind: 'document',
        mode: 'quick',
        requiresExactComputation: false,
        confidence: 0.95,
      },
      toolPolicy: {
        grants: [{
          toolId: 'hybrid-retrieval',
          capability: 'document:retrieve',
          maximumCalls: 1,
        }],
      },
      budgetCeiling: {
        maximumSteps: 2,
        maximumModelCalls: 1,
        maximumToolCalls: 1,
        maximumTokens: 8_000,
        maximumElapsedMilliseconds: 30_000,
        maximumEstimatedCostMicros: 100_000,
        maximumFanOut: 1,
        maximumRevisions: 0,
      },
    })

    expect(plannerInput.planId).toBe(ids.plan)
    expect(plannerInput.runId).toBe(ids.run)
    expect(plannerInput.workspaceId).toBe(ids.workspace)
    expect(plannerInput.projectId).toBe(ids.project)
    expect(plannerInput.sourceScopes).toEqual(sourceScopes)
    expect(plannerInput.toolPolicy.grants).toHaveLength(1)
    expect(plannerInput.budgetCeiling.maximumToolCalls).toBe(1)
  })

  it('rejects whitespace-only questions before either provider call', () => {
    const classifierInput = {
      workspaceId: ids.workspace,
      projectId: ids.project,
      question: ' \n\t ',
      sourceScopes,
    }
    expect(() =>
      Schema.decodeUnknownSync(QuestionClassifierInput)(classifierInput)
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(ResearchPlannerInput)({
        ...classifierInput,
        planId: ids.plan,
        runId: ids.run,
        classification: {
          version: '1',
          kind: 'document',
          mode: 'quick',
          requiresExactComputation: false,
          confidence: 0.95,
        },
        toolPolicy: { grants: [] },
        budgetCeiling: {
          maximumSteps: 1,
          maximumModelCalls: 1,
          maximumToolCalls: 0,
          maximumTokens: 1,
          maximumElapsedMilliseconds: 1,
          maximumEstimatedCostMicros: 0,
          maximumFanOut: 1,
          maximumRevisions: 0,
        },
      })
    ).toThrow()
  })

  it('rejects malformed model output through the declared plan schema', () => {
    const planner = researchPlannerAgent('mock', 'fixed')
    if (planner.output === undefined) {
      throw new Error('Research planner output schema is required')
    }
    const output = planner.output
    expect(() =>
      Schema.decodeUnknownSync(output)({
        output: { objective: 'unvalidated envelope' },
      })
    ).toThrow()
  })

  it('normalizes provider failure into a bounded typed workflow error', () => {
    const failure = researchPlannerProviderFailure(
      new Error('provider unavailable'),
    )
    expect(failure).toMatchObject({
      _tag: 'ResearchWorkflowError',
      stage: 'research-planner-provider',
      message: 'Research planner provider failed',
    })
    expect(
      researchPlannerProviderFailure({ apiKey: 'must-not-leak' }).message,
    ).not.toContain('apiKey')
  })
})
