import { Schema } from 'effect';

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
const NonNegativeNumber = Schema.Number.pipe(Schema.nonNegative());
const PositiveNumber = Schema.Number.pipe(Schema.positive());
const Sha256Hex = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));

export const EVENT_PAYLOAD_TARGET_BYTES = 16 * 1024;
export const CHECKPOINT_TARGET_BYTES = 64 * 1024;
export const HEARTBEAT_TARGET_SECONDS = 15;

export const ResearchEventTypeSchema = Schema.Literal(
  'research-started',
  'plan-created',
  'step-started',
  'step-completed',
  'answer-streaming',
  'research-completed',
  'research-failed',
  'research-cancelled',
);
export type ResearchEventType = Schema.Schema.Type<typeof ResearchEventTypeSchema>;

export const TerminalResearchEventTypeSchema = Schema.Literal(
  'research-completed',
  'research-failed',
  'research-cancelled',
);
export type TerminalResearchEventType = Schema.Schema.Type<typeof TerminalResearchEventTypeSchema>;

export const ArtifactReferenceSchema = Schema.Struct({
  artifactId: NonEmptyString,
  sha256: Sha256Hex,
  bytes: PositiveNumber,
  mediaType: NonEmptyString,
});
export type ArtifactReference = Schema.Schema.Type<typeof ArtifactReferenceSchema>;

export const EventIdentitySchema = Schema.Struct({
  runId: NonEmptyString,
  attempt: PositiveNumber,
  sequence: PositiveNumber,
  cursor: NonEmptyString,
});
export type EventIdentity = Schema.Schema.Type<typeof EventIdentitySchema>;

const ResearchStartedEventSchema = Schema.Struct({
  type: Schema.Literal('research-started'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    question: NonEmptyString,
    sourceVersionId: NonEmptyString,
    heartbeatSeconds: PositiveNumber,
  }),
});

const PlanCreatedEventSchema = Schema.Struct({
  type: Schema.Literal('plan-created'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    stepIds: Schema.NonEmptyArray(NonEmptyString),
    budgetPolicy: NonEmptyString,
  }),
});

const StepStartedEventSchema = Schema.Struct({
  type: Schema.Literal('step-started'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    stepId: NonEmptyString,
    resumedFromAttempt: Schema.optional(PositiveNumber),
  }),
});

const StepCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('step-completed'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    stepId: NonEmptyString,
    artifactRef: ArtifactReferenceSchema,
    checkpointCursor: NonEmptyString,
  }),
});

const AnswerStreamingEventSchema = Schema.Struct({
  type: Schema.Literal('answer-streaming'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    delta: NonEmptyString,
    done: Schema.Boolean,
  }),
});

const ResearchCompletedEventSchema = Schema.Struct({
  type: Schema.Literal('research-completed'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    reportArtifactId: NonEmptyString,
  }),
});

const ResearchFailedEventSchema = Schema.Struct({
  type: Schema.Literal('research-failed'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    code: NonEmptyString,
    message: NonEmptyString,
  }),
});

const ResearchCancelledEventSchema = Schema.Struct({
  type: Schema.Literal('research-cancelled'),
  identity: EventIdentitySchema,
  serializedBytes: NonNegativeNumber,
  payload: Schema.Struct({
    reason: NonEmptyString,
    winner: Schema.Literal('cancel-intent'),
  }),
});

export const ResearchEventSchema = Schema.Union(
  ResearchStartedEventSchema,
  PlanCreatedEventSchema,
  StepStartedEventSchema,
  StepCompletedEventSchema,
  AnswerStreamingEventSchema,
  ResearchCompletedEventSchema,
  ResearchFailedEventSchema,
  ResearchCancelledEventSchema,
);
export type ResearchEvent = Schema.Schema.Type<typeof ResearchEventSchema>;

export const BudgetSnapshotSchema = Schema.Struct({
  modelCalls: NonNegativeNumber,
  toolCalls: NonNegativeNumber,
  elapsedMs: NonNegativeNumber,
});
export type BudgetSnapshot = Schema.Schema.Type<typeof BudgetSnapshotSchema>;

export const FredCorrelationSchema = Schema.Struct({
  workflowId: NonEmptyString,
  runCorrelationId: NonEmptyString,
});
export type FredCorrelation = Schema.Schema.Type<typeof FredCorrelationSchema>;

export const CheckpointRecordSchema = Schema.Struct({
  runId: NonEmptyString,
  attempt: PositiveNumber,
  currentStep: NonEmptyString,
  completedStepRefs: Schema.Array(NonEmptyString),
  budgetSnapshot: BudgetSnapshotSchema,
  cancelRequested: Schema.Boolean,
  fredCorrelation: FredCorrelationSchema,
  artifactRefs: Schema.Array(ArtifactReferenceSchema),
  lastEventSequence: NonNegativeNumber,
  serializedBytes: NonNegativeNumber,
});
export type CheckpointRecord = Schema.Schema.Type<typeof CheckpointRecordSchema>;

const ProjectionEventsSchema = Schema.Struct({
  kind: Schema.Literal('events'),
  events: Schema.Array(ResearchEventSchema),
  lastCursor: NonEmptyString,
});

const ProjectionResyncRequiredSchema = Schema.Struct({
  kind: Schema.Literal('resync-required'),
  retentionFloor: NonEmptyString,
  resumeFromCursor: NonEmptyString,
});

const ProjectionForbiddenSchema = Schema.Struct({
  kind: Schema.Literal('forbidden'),
  reason: NonEmptyString,
});

export const ProjectionResultSchema = Schema.Union(
  ProjectionEventsSchema,
  ProjectionResyncRequiredSchema,
  ProjectionForbiddenSchema,
);
export type ProjectionResult = Schema.Schema.Type<typeof ProjectionResultSchema>;

export const AuditEntrySchema = Schema.Struct({
  code: NonEmptyString,
  detail: NonEmptyString,
});
export type AuditEntry = Schema.Schema.Type<typeof AuditEntrySchema>;
