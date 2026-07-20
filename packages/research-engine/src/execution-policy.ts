import {
  ProjectId,
  ResearchArtifactRef,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchToolCapability,
  ResearchToolId,
  WorkspaceId,
} from '@struct/domain'
import { Schema } from 'effect'

const Counter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)
const Fingerprint = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512))
const BoundedMessage = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512))
const StateIdentityField = Schema.Literal(
  'runId',
  'planId',
  'workspaceId',
  'projectId',
)
const StateResource = Schema.Literal(
  'artifacts',
  'action-fingerprints',
  'completed-node-ids',
  'tool-grant-usage',
  'tool-grant-calls',
)

export const ResearchModelRole = Schema.Literal(
  'classification',
  'planning',
  'critique',
  'synthesis',
)
export type ResearchModelRole = Schema.Schema.Type<typeof ResearchModelRole>

export const ResearchExecutionPolicy = Schema.Struct({
  maximumDuplicateActions: Counter.pipe(Schema.between(1, 8)),
  maximumNoProgressActions: Counter.pipe(Schema.between(1, 8)),
})
export type ResearchExecutionPolicy =
  Schema.Schema.Type<typeof ResearchExecutionPolicy>

export const ResearchStopReason = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('step-budget'),
    limit: Counter,
    attempted: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('model-budget'),
    limit: Counter,
    attempted: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('tool-budget'),
    limit: Counter,
    attempted: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('tool-grant-budget'),
    toolId: ResearchToolId,
    capability: ResearchToolCapability,
    limit: Counter,
    attempted: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('cost-budget'),
    limit: Counter,
    attempted: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('time-budget'),
    limit: Counter,
    attempted: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('concurrency-budget'),
    limit: Counter,
    attempted: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('duplicate-action'),
    fingerprint: Fingerprint,
    limit: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('no-progress'),
    fingerprint: Schema.NullOr(Fingerprint),
    limit: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('undeclared-tool'),
    toolId: ResearchToolId,
  }),
  Schema.Struct({
    kind: Schema.Literal('undeclared-capability'),
    toolId: ResearchToolId,
    capability: ResearchToolCapability,
  }),
  Schema.Struct({
    kind: Schema.Literal('provider-failure'),
    role: Schema.NullOr(ResearchModelRole),
    message: BoundedMessage,
  }),
  Schema.Struct({
    kind: Schema.Literal('interrupted'),
    message: BoundedMessage,
  }),
  Schema.Struct({
    kind: Schema.Literal('state-mismatch'),
    field: StateIdentityField,
  }),
  Schema.Struct({
    kind: Schema.Literal('state-budget'),
    resource: StateResource,
    limit: Counter,
    attempted: Counter,
  }),
)
export type ResearchStopReason = Schema.Schema.Type<typeof ResearchStopReason>

export class ResearchExecutionStopped extends Schema.TaggedError<ResearchExecutionStopped>()(
  'ResearchExecutionStopped',
  {
    reason: ResearchStopReason,
    message: BoundedMessage,
  },
) {}

export class ResearchProviderFailure extends Schema.TaggedError<ResearchProviderFailure>()(
  'ResearchProviderFailure',
  {
    message: BoundedMessage,
  },
) {}

export const ResearchAction = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('tool'),
    nodeId: ResearchPlanNodeId,
    toolId: ResearchToolId,
    capability: ResearchToolCapability,
    fingerprint: Fingerprint,
    estimatedCostMicros: Counter,
  }),
  Schema.Struct({
    kind: Schema.Literal('model'),
    nodeId: ResearchPlanNodeId,
    role: ResearchModelRole,
    fingerprint: Fingerprint,
    estimatedCostMicros: Counter,
  }),
)
export type ResearchAction = Schema.Schema.Type<typeof ResearchAction>

export const ResearchActionResult = Schema.Struct({
  progressFingerprint: Fingerprint,
  artifacts: Schema.Array(ResearchArtifactRef).pipe(Schema.maxItems(64)),
})
export type ResearchActionResult =
  Schema.Schema.Type<typeof ResearchActionResult>

export const ResearchToolGrantUsage = Schema.Struct({
  toolId: ResearchToolId,
  capability: ResearchToolCapability,
  count: Counter.pipe(Schema.lessThanOrEqualTo(256)),
})
export type ResearchToolGrantUsage =
  Schema.Schema.Type<typeof ResearchToolGrantUsage>

export const ResearchGraphState = Schema.Struct({
  version: Schema.Literal('1'),
  runId: ResearchRunId,
  planId: ResearchPlanId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  status: Schema.Literal('ready', 'running', 'completed', 'stopped'),
  startedAtMilliseconds: Counter,
  elapsedMilliseconds: Counter,
  steps: Counter,
  modelCalls: Counter,
  toolCalls: Counter,
  estimatedCostMicros: Counter,
  activeConcurrency: Counter,
  duplicateActionCount: Counter,
  noProgressCount: Counter,
  lastProgressFingerprint: Schema.NullOr(Fingerprint),
  actionFingerprints: Schema.Array(Fingerprint).pipe(Schema.maxItems(64)),
  toolGrantUsage: Schema.Array(ResearchToolGrantUsage).pipe(Schema.maxItems(3)),
  completedNodeIds: Schema.Array(ResearchPlanNodeId).pipe(Schema.maxItems(64)),
  artifacts: Schema.Array(ResearchArtifactRef).pipe(Schema.maxItems(256)),
  stopReason: Schema.NullOr(ResearchStopReason),
})
export type ResearchGraphState =
  Schema.Schema.Type<typeof ResearchGraphState>

export function initialResearchGraphState(
  identifiers: Pick<
    ResearchGraphState,
    'runId' | 'planId' | 'workspaceId' | 'projectId'
  >,
  startedAtMilliseconds: number,
): ResearchGraphState {
  return {
    version: '1',
    ...identifiers,
    status: 'ready',
    startedAtMilliseconds,
    elapsedMilliseconds: 0,
    steps: 0,
    modelCalls: 0,
    toolCalls: 0,
    estimatedCostMicros: 0,
    activeConcurrency: 0,
    duplicateActionCount: 0,
    noProgressCount: 0,
    lastProgressFingerprint: null,
    actionFingerprints: [],
    toolGrantUsage: [],
    completedNodeIds: [],
    artifacts: [],
    stopReason: null,
  }
}
