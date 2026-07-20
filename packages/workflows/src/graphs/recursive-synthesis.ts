// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Fred from '@fancyrobot/fred'
import {
  RecursiveAnalysisRequestId,
  RecursiveBatchId,
  RecursiveContradiction,
  RecursiveCoverage,
  RecursiveDecompositionNodeId,
  ResearchFinding,
  ResearchRunId,
  Sha256Digest,
} from '@struct/domain'
import { Schema } from 'effect'
import {
  CORPUS_ANALYST_AGENT_ID,
  CorpusAnalystInput,
  CorpusAnalystOutput,
  RecursiveEvidenceExcerpt,
} from '../agents/corpus-analyst.js'
import {
  RECURSIVE_EVIDENCE_CRITIC_AGENT_ID,
  RecursiveEvidenceCriticInput,
  RecursiveEvidenceCriticOutput,
  HIERARCHICAL_SYNTHESIZER_AGENT_ID,
  HierarchicalSynthesisInput,
  HierarchicalSynthesisOutput,
} from '../agents/evidence-critic.js'

const SafeCounter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
)
const SafePositiveInteger = SafeCounter.pipe(Schema.positive())

export const RecursiveNodeBudget = Schema.Struct({
  maximumPromptBytes: SafePositiveInteger.pipe(
    Schema.lessThanOrEqualTo(1_048_576),
  ),
  maximumModelCalls: SafeCounter.pipe(Schema.lessThanOrEqualTo(16)),
  maximumTokens: SafeCounter,
  maximumEstimatedCostMicros: SafeCounter,
  estimatedTokensPerCall: SafePositiveInteger,
  estimatedCostMicrosPerCall: SafeCounter,
})
export type RecursiveNodeBudget =
  Schema.Schema.Type<typeof RecursiveNodeBudget>

export const RecursiveNodeSynthesisInput = Schema.Struct({
  runId: ResearchRunId,
  requestId: RecursiveAnalysisRequestId,
  nodeId: RecursiveDecompositionNodeId,
  inputBatchIds: Schema.Array(RecursiveBatchId).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  objectiveSignature: Sha256Digest,
  evidence: Schema.Array(RecursiveEvidenceExcerpt).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  coverage: RecursiveCoverage,
  maximumFindings: SafePositiveInteger.pipe(Schema.lessThanOrEqualTo(32)),
  budget: RecursiveNodeBudget,
}).pipe(Schema.filter((input) => [
  new Set(input.inputBatchIds).size === input.inputBatchIds.length
    ? undefined
    : 'inputBatchIds must be unique',
  new Set(input.evidence.map((item) => item.reference.id)).size
    === input.evidence.length
    ? undefined
    : 'evidence reference IDs must be unique',
]))
export type RecursiveNodeSynthesisInput =
  Schema.Schema.Type<typeof RecursiveNodeSynthesisInput>

export const RecursiveNodeSynthesisOutput = Schema.Struct({
  requestId: RecursiveAnalysisRequestId,
  nodeId: RecursiveDecompositionNodeId,
  inputBatchIds: Schema.Array(RecursiveBatchId).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  findings: Schema.Array(ResearchFinding).pipe(Schema.maxItems(64)),
  coverage: RecursiveCoverage,
  contradictions: Schema.Array(RecursiveContradiction).pipe(Schema.maxItems(64)),
  sufficiency: RecursiveEvidenceCriticOutput.fields.sufficiency,
  evidenceIds: RecursiveEvidenceCriticOutput.fields.evidenceIds,
  missingEvidence: CorpusAnalystOutput.fields.missingEvidence,
  excludedEvidence: CorpusAnalystOutput.fields.excludedEvidence,
  limitations: RecursiveEvidenceCriticOutput.fields.limitations,
  synthesisLimitations: HierarchicalSynthesisOutput.fields.limitations,
  modelCalls: Schema.Literal(0, 1, 2, 3),
}).pipe(Schema.filter((output) => {
  const knownEvidence = new Set(output.findings.flatMap((finding) =>
    finding.evidence.map((item) => item.id)))
  return [
    new Set(output.inputBatchIds).size === output.inputBatchIds.length
      ? undefined
      : 'output inputBatchIds must be unique',
    new Set(output.evidenceIds).size === output.evidenceIds.length
      ? undefined
      : 'output evidenceIds must be unique',
    new Set(output.findings.map((finding) => finding.id)).size
      === output.findings.length
      ? undefined
      : 'output finding IDs must be unique',
    new Set(output.contradictions.map((contradiction) => contradiction.id)).size
      === output.contradictions.length
      ? undefined
      : 'output contradiction IDs must be unique',
    output.evidenceIds.length === knownEvidence.size
      && output.evidenceIds.every((id) => knownEvidence.has(id))
      ? undefined
      : 'output evidenceIds must exactly cover retained finding evidence',
    output.sufficiency === 'sufficient'
      && (
        output.coverage.status !== 'complete'
        || output.contradictions.length > 0
        || output.missingEvidence.length > 0
        || output.excludedEvidence.length > 0
        || output.modelCalls !== 3
      )
      ? 'sufficient output requires complete, conflict-free three-call analysis'
      : undefined,
    output.sufficiency === 'contradictory'
      && (output.contradictions.length === 0 || output.modelCalls !== 2)
      ? 'contradictory output requires retained contradictions at critic stop'
      : undefined,
    output.sufficiency !== 'contradictory'
      && output.contradictions.length > 0
      ? 'retained contradictions require contradictory output'
      : undefined,
    output.sufficiency === 'insufficient'
      && output.modelCalls !== 1
      && output.modelCalls !== 2
      ? 'insufficient output must stop after analysis or critique'
      : undefined,
  ]
}))
export type RecursiveNodeSynthesisOutput =
  Schema.Schema.Type<typeof RecursiveNodeSynthesisOutput>

export const CORPUS_ANALYSIS_WORKFLOW_ID =
  'struct.recursive.corpus-analysis'
export const RECURSIVE_CRITIQUE_WORKFLOW_ID =
  'struct.recursive.evidence-critique'
export const HIERARCHICAL_SYNTHESIS_WORKFLOW_ID =
  'struct.recursive.hierarchical-synthesis'

function oneAgentWorkflow(
  id: string,
  agentId: string,
  input: Schema.Schema.AnyNoContext,
  output: Schema.Schema.AnyNoContext,
): Fred.WorkflowIR {
  return {
    id,
    source: 'native',
    entry: 'agent',
    input,
    output,
    nodes: [{ id: 'agent', kind: 'agent', agentId }],
    edges: [],
  }
}

export function makeCorpusAnalysisWorkflow(): Fred.WorkflowIR {
  return oneAgentWorkflow(
    CORPUS_ANALYSIS_WORKFLOW_ID,
    CORPUS_ANALYST_AGENT_ID,
    CorpusAnalystInput,
    CorpusAnalystOutput,
  )
}

export function makeRecursiveCritiqueWorkflow(): Fred.WorkflowIR {
  return oneAgentWorkflow(
    RECURSIVE_CRITIQUE_WORKFLOW_ID,
    RECURSIVE_EVIDENCE_CRITIC_AGENT_ID,
    RecursiveEvidenceCriticInput,
    RecursiveEvidenceCriticOutput,
  )
}

export function makeHierarchicalSynthesisWorkflow(): Fred.WorkflowIR {
  return oneAgentWorkflow(
    HIERARCHICAL_SYNTHESIS_WORKFLOW_ID,
    HIERARCHICAL_SYNTHESIZER_AGENT_ID,
    HierarchicalSynthesisInput,
    HierarchicalSynthesisOutput,
  )
}
