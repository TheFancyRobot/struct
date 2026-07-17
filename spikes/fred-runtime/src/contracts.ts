import { Schema } from 'effect';

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
const Sha256Hex = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
const NonNegativeNumber = Schema.Number.pipe(Schema.nonNegative());
const HookNameSchema = Schema.Literal(
  'beforePipeline',
  'beforeStep',
  'afterStep',
  'afterPipeline',
  'onStepError',
);

export const ArtifactReferenceSchema = Schema.Struct({
  artifactId: NonEmptyString,
  sha256: Sha256Hex,
  bytes: NonNegativeNumber,
});
export type ArtifactReference = Schema.Schema.Type<typeof ArtifactReferenceSchema>;

export const ResearchRunInputSchema = Schema.Struct({
  runId: NonEmptyString,
  question: NonEmptyString,
  retrievalQuery: NonEmptyString,
  sourceVersionId: NonEmptyString,
  artifact: ArtifactReferenceSchema,
  expectedEvidence: Schema.Array(NonEmptyString),
});
export type ResearchRunInput = Schema.Schema.Type<typeof ResearchRunInputSchema>;

export const DeterministicToolInputSchema = Schema.Struct({
  question: NonEmptyString,
  retrievalQuery: NonEmptyString,
  sourceVersionId: NonEmptyString,
  artifactRef: ArtifactReferenceSchema,
  expectedEvidence: Schema.Array(NonEmptyString),
});
export type DeterministicToolInput = Schema.Schema.Type<typeof DeterministicToolInputSchema>;

export const DeterministicToolOutputSchema = Schema.Struct({
  strategy: Schema.Literal('hybrid-retrieval'),
  boundedSummary: NonEmptyString,
  evidenceKeys: Schema.Array(NonEmptyString),
  artifactRef: ArtifactReferenceSchema,
  limitations: Schema.Array(NonEmptyString),
});
export type DeterministicToolOutput = Schema.Schema.Type<typeof DeterministicToolOutputSchema>;

export const HookRecordSchema = Schema.Struct({
  order: NonNegativeNumber,
  hook: HookNameSchema,
  nodeId: Schema.optional(NonEmptyString),
});
export type HookRecord = Schema.Schema.Type<typeof HookRecordSchema>;

export const RunCorrelationSchema = Schema.Struct({
  productRunId: NonEmptyString,
  fredWorkflowId: NonEmptyString,
  fredRunCorrelationId: NonEmptyString,
  attempt: NonNegativeNumber,
  eventSequenceBase: NonNegativeNumber,
});
export type RunCorrelation = Schema.Schema.Type<typeof RunCorrelationSchema>;

export const CheckpointMetadataSchema = Schema.Struct({
  runId: NonEmptyString,
  fredWorkflowId: NonEmptyString,
  productCursor: NonEmptyString,
  currentNodeId: NonEmptyString,
  inlineBytes: NonNegativeNumber,
  artifactRef: ArtifactReferenceSchema,
  persistedFields: Schema.Array(NonEmptyString),
  hookPoints: Schema.Array(HookNameSchema),
});
export type CheckpointMetadata = Schema.Schema.Type<typeof CheckpointMetadataSchema>;

export const Step02HandoffSchema = Schema.Struct({
  runCorrelationRule: NonEmptyString,
  checkpointOwner: NonEmptyString,
  eventHooks: Schema.Array(HookNameSchema),
  unresolvedGaps: Schema.Array(NonEmptyString),
});
export type Step02Handoff = Schema.Schema.Type<typeof Step02HandoffSchema>;

export const BoundaryRecommendationSchema = Schema.Struct({
  fredOwns: Schema.Array(NonEmptyString),
  productOwns: Schema.Array(NonEmptyString),
  step02Handoff: Step02HandoffSchema,
});
export type BoundaryRecommendation = Schema.Schema.Type<typeof BoundaryRecommendationSchema>;

export const ResearchRunTerminalSchema = Schema.Struct({
  status: Schema.Literal('completed'),
  runCorrelation: RunCorrelationSchema,
  checkpoint: CheckpointMetadataSchema,
  toolResult: DeterministicToolOutputSchema,
  recommendation: BoundaryRecommendationSchema,
});
export type ResearchRunTerminal = Schema.Schema.Type<typeof ResearchRunTerminalSchema>;

export const ProgressInputSchema = Schema.Struct({
  job: NonEmptyString,
});
export type ProgressInput = Schema.Schema.Type<typeof ProgressInputSchema>;

export const ProgressOutputSchema = Schema.Struct({
  accepted: Schema.Boolean,
  job: NonEmptyString,
});
export type ProgressOutput = Schema.Schema.Type<typeof ProgressOutputSchema>;
