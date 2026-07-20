// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Fred from '@fancyrobot/fred'
import {
  RecursiveContradictionId,
  RecursiveAnalysisRequestId,
  RecursiveDecompositionNodeId,
  RecursiveEvidenceId,
  RecursiveFindingId,
  ResearchRunId,
  ResearchFinding,
  Sha256Digest,
} from '@struct/domain'
import { Schema } from 'effect'

const BoundedLimitation = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(512),
  Schema.filter((value) =>
    value.trim().length > 0
    || 'limitation must contain a non-whitespace character'),
)

export const RecursiveContradictionProposal = Schema.Struct({
  claimSignature: Sha256Digest,
  supportingEvidence: Schema.Array(RecursiveEvidenceId).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  conflictingEvidence: Schema.Array(RecursiveEvidenceId).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  status: Schema.Literal('unresolved'),
  limitations: Schema.Array(BoundedLimitation).pipe(Schema.maxItems(32)),
})
export type RecursiveContradictionProposal =
  Schema.Schema.Type<typeof RecursiveContradictionProposal>

export const RecursiveEvidenceCriticInput = Schema.Struct({
  runId: ResearchRunId,
  requestId: RecursiveAnalysisRequestId,
  nodeId: RecursiveDecompositionNodeId,
  findings: Schema.Array(ResearchFinding).pipe(Schema.maxItems(64)),
  missingEvidence: Schema.Array(BoundedLimitation).pipe(Schema.maxItems(32)),
  excludedEvidence: Schema.Array(BoundedLimitation).pipe(Schema.maxItems(32)),
  instruction: Schema.Literal(
    'Retain every material contradiction and evidence limitation.',
  ),
})
export type RecursiveEvidenceCriticInput =
  Schema.Schema.Type<typeof RecursiveEvidenceCriticInput>

export const RecursiveEvidenceCriticOutput = Schema.Struct({
  contradictions: Schema.Array(RecursiveContradictionProposal).pipe(
    Schema.maxItems(32),
  ),
  sufficiency: Schema.Literal('sufficient', 'insufficient', 'contradictory'),
  evidenceIds: Schema.Array(RecursiveEvidenceId).pipe(Schema.maxItems(256)),
  limitations: Schema.Array(BoundedLimitation).pipe(Schema.maxItems(64)),
})
export type RecursiveEvidenceCriticOutput =
  Schema.Schema.Type<typeof RecursiveEvidenceCriticOutput>

export const RECURSIVE_EVIDENCE_CRITIC_AGENT_ID =
  'struct.recursive.evidence-critic'
export const RECURSIVE_EVIDENCE_CRITIC_SYSTEM_MESSAGE =
  'Assess the bounded structured findings for sufficiency and contradictions. Retain minority and conflicting evidence with exact supplied evidence IDs. Missing and excluded evidence are limitations, not permission to infer. Return only the typed decision; do not invoke tools, suppress conflicts, invent evidence, or reveal chain-of-thought.'

export function recursiveEvidenceCriticAgent(
  platform: string,
  model: string,
): Fred.AgentConfig<
  typeof RecursiveEvidenceCriticInput,
  typeof RecursiveEvidenceCriticOutput
> {
  return {
    id: RECURSIVE_EVIDENCE_CRITIC_AGENT_ID,
    platform,
    model,
    input: RecursiveEvidenceCriticInput,
    output: RecursiveEvidenceCriticOutput,
    maxSteps: 1,
    toolChoice: 'none',
    systemMessage: RECURSIVE_EVIDENCE_CRITIC_SYSTEM_MESSAGE,
  }
}

export const HierarchicalSynthesisInput = Schema.Struct({
  runId: ResearchRunId,
  requestId: RecursiveAnalysisRequestId,
  nodeId: RecursiveDecompositionNodeId,
  findings: Schema.Array(ResearchFinding).pipe(Schema.maxItems(64)),
  contradictionIds: Schema.Array(RecursiveContradictionId).pipe(
    Schema.maxItems(64),
  ),
  instruction: Schema.Literal(
    'Prioritize without discarding evidence, contradictions, or limitations.',
  ),
})
export type HierarchicalSynthesisInput =
  Schema.Schema.Type<typeof HierarchicalSynthesisInput>

export const HierarchicalSynthesisOutput = Schema.Struct({
  retainedFindingIds: Schema.Array(RecursiveFindingId).pipe(Schema.maxItems(64)),
  limitations: Schema.Array(BoundedLimitation).pipe(Schema.maxItems(64)),
})
export type HierarchicalSynthesisOutput =
  Schema.Schema.Type<typeof HierarchicalSynthesisOutput>

export const HIERARCHICAL_SYNTHESIZER_AGENT_ID =
  'struct.recursive.hierarchical-synthesizer'
export const HIERARCHICAL_SYNTHESIZER_SYSTEM_MESSAGE =
  'Prioritize the supplied structured findings for hierarchical synthesis while retaining every supported finding, contradiction, and limitation in the durable result. Return only supplied finding IDs and concise limitations. Do not invoke tools, invent claims or IDs, perform exact computation, or reveal chain-of-thought.'

export function hierarchicalSynthesizerAgent(
  platform: string,
  model: string,
): Fred.AgentConfig<
  typeof HierarchicalSynthesisInput,
  typeof HierarchicalSynthesisOutput
> {
  return {
    id: HIERARCHICAL_SYNTHESIZER_AGENT_ID,
    platform,
    model,
    input: HierarchicalSynthesisInput,
    output: HierarchicalSynthesisOutput,
    maxSteps: 1,
    toolChoice: 'none',
    systemMessage: HIERARCHICAL_SYNTHESIZER_SYSTEM_MESSAGE,
  }
}
