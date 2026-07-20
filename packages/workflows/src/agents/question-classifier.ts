// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Fred from '@fancyrobot/fred'
import {
  ProjectId,
  QuestionClassification,
  ResearchSourceScope,
  WorkspaceId,
} from '@struct/domain'
import { ResearchQuestion } from '@struct/research-engine'
import { Schema } from 'effect'

export const QUESTION_CLASSIFIER_AGENT_ID = 'struct.question-classifier'

export const QuestionClassifierInput = Schema.Struct({
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  question: ResearchQuestion,
  sourceScopes: Schema.Array(ResearchSourceScope).pipe(
    Schema.minItems(1),
    Schema.maxItems(256),
  ),
})
export type QuestionClassifierInput =
  Schema.Schema.Type<typeof QuestionClassifierInput>

export const questionClassifierAgent = (
  platform: string,
  model: string,
): Fred.AgentConfig<
  typeof QuestionClassifierInput,
  typeof QuestionClassification
> => ({
  id: QUESTION_CLASSIFIER_AGENT_ID,
  platform,
  model,
  input: QuestionClassifierInput,
  output: QuestionClassification,
  maxSteps: 1,
  toolChoice: 'none',
  systemMessage:
    'Classify the research question against only the supplied immutable source scope as document, dataset, recursive, or mixed. Select the smallest explicit routes array needed by this question: a single classification selects only its matching route, while mixed selects at least two distinct authorized routes. Do not select recursive merely because a recursive scope exists. Exact calculations require dataset routing; questions spanning an authorized multi-file corpus may require recursive routing. Return the versioned classification fields only. Do not invoke tools, change source scope, or reveal private reasoning.',
})
