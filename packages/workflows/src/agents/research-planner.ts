// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Fred from '@fancyrobot/fred'
import {
  ResearchPlan,
  ResearchWorkflowError,
} from '@struct/domain'
import { ResearchPlanningInput } from '@struct/research-engine'
import { Schema } from 'effect'

export const RESEARCH_PLANNER_AGENT_ID = 'struct.research-planner'

export const ResearchPlannerInput = ResearchPlanningInput
export type ResearchPlannerInput =
  Schema.Schema.Type<typeof ResearchPlannerInput>

export const researchPlannerAgent = (
  platform: string,
  model: string,
): Fred.AgentConfig<typeof ResearchPlannerInput, typeof ResearchPlan> => ({
  id: RESEARCH_PLANNER_AGENT_ID,
  platform,
  model,
  input: ResearchPlannerInput,
  output: ResearchPlan,
  maxSteps: 1,
  toolChoice: 'none',
  systemMessage:
    'Propose a concise typed research-plan DAG. Preserve the exact plan, run, workspace, project, question, and authorized source identities. Route document evidence to document-retrieval, exact computation to dataset-query, and authorized multi-file corpus work to recursive-analysis. A mixed answer-synthesis node must depend on every required evidence branch. Dataset-query nodes may select only typed inspect or count operations; recursive-analysis nodes must preserve the supplied immutable source set and bounded policy. Trusted code compiles operations, so never emit SQL or code. Never add source scope, capabilities, tool calls, or budget. Return plan fields only; deterministic validation runs before execution. Do not invoke tools or reveal private reasoning.',
})

/**
 * Keeps provider failures typed at the planner boundary without retaining
 * provider payloads, credentials, or unbounded diagnostic data.
 */
export function researchPlannerProviderFailure(
  _cause: unknown,
): ResearchWorkflowError {
  return new ResearchWorkflowError({
    stage: 'research-planner-provider',
    message: 'Research planner provider failed',
  })
}
