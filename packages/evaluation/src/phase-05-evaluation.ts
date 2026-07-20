/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  ResearchCheckpointId,
  decodeResearchExecutionCheckpoint,
  ResearchPlan,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchToolProviderUnavailableError,
  WorkspaceId,
  ProjectId,
} from '@struct/domain'
import {
  beginResearchAction,
  executeResearchToolWithRetry,
  initialResearchGraphState,
  ResearchPlanningInput,
  selectResearchRecovery,
  type ResearchAction as typeResearchAction,
  type ResearchExecutionPolicy as typeResearchExecutionPolicy,
  validateResearchPlan,
} from '@struct/research-engine'
import {
  makeResearchToolRegistry,
  type ResearchToolDefinition as typeResearchToolDefinition,
  type ResearchToolTrace as typeResearchToolTrace,
} from '@struct/workflows'
import { Effect, Either, Option, Schema } from 'effect'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { canonicalJson } from './corpus.js'
/* eslint-enable no-unused-vars */

const uuid = (suffix: string) => `950e8400-e29b-41d4-a716-${suffix}`
const ids = {
  workspace: uuid('446655440000'),
  project: uuid('446655440001'),
  run: uuid('446655440002'),
  plan: uuid('446655440003'),
  documentVersion: uuid('446655440004'),
  datasetVersion: uuid('446655440005'),
  dataset: uuid('446655440006'),
  snapshot: uuid('446655440007'),
  documentEvidence: uuid('446655440008'),
  datasetEvidence: uuid('446655440009'),
  documentNode: uuid('446655440010'),
  datasetNode: uuid('446655440011'),
  synthesisNode: uuid('446655440012'),
  checkpoint: uuid('446655440013'),
  extraNodeOne: uuid('446655440014'),
  extraNodeTwo: uuid('446655440015'),
  missingNode: uuid('446655440016'),
} as const

export const PHASE_05_EVALUATION_ID =
  'phase-05-planning-execution-replay-recovery-v1' as const
export const PHASE_05_LIVE_RUN_ID =
  '960e8400-e29b-41d4-a716-446655440003' as const

export const phase05CriterionIds = [
  'planning-contract',
  'invalid-plan-rejections',
  'fred-tool-registry',
  'committed-event-recovery',
  'recovery-boundary-gates',
  'execution-budget-policy',
  'typed-failure-diagnostics',
  'golden-trace-regression',
  'runtime-boundary',
  'fred-gap-portability',
] as const
export type Phase05CriterionId = typeof phase05CriterionIds[number]

export interface Phase05EvaluationCriterion {
  readonly id: Phase05CriterionId
  readonly fixture: Readonly<Record<string, unknown>>
  readonly result: Readonly<Record<string, unknown>>
  readonly status: 'passed' | 'failed'
  readonly evidenceSha256: string
}

interface Phase05EvaluationReportBody {
  readonly schemaVersion: '1.0.0'
  readonly evaluationId: typeof PHASE_05_EVALUATION_ID
  readonly status: 'passed' | 'failed'
  readonly runtime: {
    readonly host: 'bun'
    readonly sidecar: 'node-24'
    readonly sidecarProtocol: 'authenticated-http-v1'
    readonly isolation: 'compose-no-egress'
  }
  readonly counts: {
    readonly criteria: number
    readonly passed: number
    readonly failed: number
  }
  readonly criteria: ReadonlyArray<Phase05EvaluationCriterion>
}

export interface Phase05EvaluationReport extends Phase05EvaluationReportBody {
  readonly reportSha256: string
}

const EvidenceCounter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)
const Phase05LiveIntegrationEvidenceBase = Schema.Struct({
  evidenceVersion: Schema.Literal('1'),
  source: Schema.Literal('live-postgresql-compose'),
  runId: Schema.Literal(PHASE_05_LIVE_RUN_ID),
  recovery: Schema.Struct({
    reconnectCursor: EvidenceCounter,
    committedEventSequences: Schema.Array(EvidenceCounter).pipe(
      Schema.minItems(1),
    ),
    reconnectEventSequences: Schema.Array(EvidenceCounter).pipe(
      Schema.minItems(1),
    ),
    terminalStates: EvidenceCounter,
    duplicateDurableEffects: EvidenceCounter,
    completedDatasetQueryReplays: EvidenceCounter,
    datasetProviderCallsAfterReplacement: EvidenceCounter,
    uncommittedDatasetProviderCallsAfterReplacement: EvidenceCounter,
    artifactCheckpointMode: Schema.Literal('by-reference'),
    datasetArtifactCommitted: Schema.Literal(true),
    datasetIdempotencyCommitPersisted: Schema.Literal(true),
    checkpointBytes: EvidenceCounter.pipe(Schema.positive()),
    initialProcessId: EvidenceCounter.pipe(Schema.positive()),
    replacementProcessId: EvidenceCounter.pipe(Schema.positive()),
    gates: Schema.Struct({
      restartAfterPlan: Schema.Literal(true),
      restartAfterToolAttemptBeforeCommit: Schema.Literal(true),
      restartAfterCheckpointCommit: Schema.Literal(true),
      restartDuringCancellation: Schema.Literal(true),
    }),
    failureHistory: Schema.Array(Schema.Struct({
      kind: Schema.Literal('provider', 'model'),
      tag: Schema.String.pipe(Schema.minLength(1)),
    })).pipe(Schema.minItems(2)),
  }),
  runtime: Schema.Struct({
    host: Schema.Literal('bun'),
    bunVersion: Schema.String.pipe(Schema.minLength(1)),
    sidecarNodeVersion: Schema.String.pipe(Schema.pattern(/^v24\./)),
    authenticatedHealth: Schema.Literal(true),
    isolatedNoEgress: Schema.Literal(true),
    bunHostHealthyDuringSidecarRestart: Schema.Literal(true),
    sidecarRecovered: Schema.Literal(true),
  }),
})
export const Phase05LiveIntegrationEvidence =
  Phase05LiveIntegrationEvidenceBase.pipe(
    Schema.filter((evidence) => {
      const committed = evidence.recovery.committedEventSequences
      const reconnect = evidence.recovery.reconnectEventSequences
      const expectedReconnect = committed.filter(
        (sequence) => sequence > evidence.recovery.reconnectCursor,
      )
      return [
        committed.every(
          (sequence, index) => index === 0 || sequence > committed[index - 1]!,
        )
          ? undefined
          : 'committed event sequences must be strictly increasing',
        reconnect.every(
          (sequence, index) => index === 0 || sequence > reconnect[index - 1]!,
        )
          ? undefined
          : 'reconnect event sequences must be strictly increasing',
        canonicalJson(reconnect) === canonicalJson(expectedReconnect)
          ? undefined
          : 'reconnect events must equal the committed suffix after reconnectCursor',
      ]
    }),
  )
export type Phase05LiveIntegrationEvidence =
  Schema.Schema.Type<typeof Phase05LiveIntegrationEvidence>

export async function readPhase05LiveIntegrationEvidence(
  path: string,
): Promise<Phase05LiveIntegrationEvidence> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  return Schema.decodeUnknownSync(Phase05LiveIntegrationEvidence)(parsed)
}

export class Phase05EvaluationError
  extends Schema.TaggedError<Phase05EvaluationError>()(
    'Phase05EvaluationError',
    {
      criterionId: Schema.String,
      message: Schema.String,
    },
  ) {}

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

function evidenceSha256(value: unknown): string {
  return sha256(canonicalJson(value))
}

function planningInput() {
  return Schema.decodeUnknownSync(ResearchPlanningInput)({
    planId: ids.plan,
    runId: ids.run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    question: 'Compare the policy evidence with the exact dataset count.',
    classification: {
      version: '1',
      kind: 'mixed',
      routes: ['document', 'dataset'],
      mode: 'quick',
      requiresExactComputation: true,
      confidence: 1,
    },
    sourceScopes: [
      { kind: 'document', sourceVersionId: ids.documentVersion },
      {
        kind: 'dataset',
        datasetId: ids.dataset,
        datasetSnapshotId: ids.snapshot,
        sourceVersionIds: [ids.datasetVersion],
      },
    ],
    toolPolicy: {
      grants: [
        {
          toolId: 'hybrid-retrieval',
          capability: 'document:retrieve',
          maximumCalls: 1,
        },
        {
          toolId: 'dataset-query',
          capability: 'dataset:query',
          maximumCalls: 1,
        },
        {
          toolId: 'citation-validation',
          capability: 'citation:validate',
          maximumCalls: 1,
        },
      ],
    },
    budgetCeiling: {
      maximumSteps: 8,
      maximumModelCalls: 3,
      maximumToolCalls: 3,
      maximumTokens: 40_000,
      maximumElapsedMilliseconds: 120_000,
      maximumEstimatedCostMicros: 800_000,
      maximumFanOut: 2,
      maximumRevisions: 1,
    },
  })
}

function validPlanProposal() {
  const input = planningInput()
  return {
    version: '1',
    id: ids.plan,
    runId: ids.run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    objective: input.question,
    sourceScopes: [...input.sourceScopes],
    nodes: [
      {
        id: ids.documentNode,
        kind: 'document-retrieval',
        goal: 'Retrieve policy evidence.',
        dependencies: [],
        inputRefs: [{
          kind: 'source-version',
          sourceVersionId: ids.documentVersion,
        }],
        evidenceRefs: [ids.documentEvidence],
      },
      {
        id: ids.datasetNode,
        kind: 'dataset-query',
        goal: 'Compute the exact count.',
        dependencies: [],
        inputRefs: [{
          kind: 'dataset-snapshot',
          datasetId: ids.dataset,
          datasetSnapshotId: ids.snapshot,
        }],
        evidenceRefs: [ids.datasetEvidence],
        toolInput: {
          kind: 'dataset-query',
          operation: 'count',
          snapshot: {
            alias: 'records',
            datasetId: ids.dataset,
            datasetSnapshotId: ids.snapshot,
          },
          columns: [],
          rowLimit: 1,
          limits: {
            maxRows: 1,
            maxOutputBytes: 1_000,
            maxMemoryMb: 64,
            timeoutMs: 1_000,
          },
        },
      },
      {
        id: ids.synthesisNode,
        kind: 'answer-synthesis',
        goal: 'Synthesize the supported comparison.',
        dependencies: [ids.datasetNode, ids.documentNode],
        inputRefs: [
          { kind: 'node-output', nodeId: ids.datasetNode },
          { kind: 'node-output', nodeId: ids.documentNode },
        ],
        evidenceRefs: [ids.datasetEvidence, ids.documentEvidence],
      },
    ],
    evidenceRequirements: [
      {
        id: ids.documentEvidence,
        kind: 'document',
        sourceVersionIds: [ids.documentVersion],
        minimumCitations: 1,
      },
      {
        id: ids.datasetEvidence,
        kind: 'dataset',
        datasetId: ids.dataset,
        datasetSnapshotId: ids.snapshot,
        minimumCitations: 1,
      },
    ],
    toolPolicy: {
      grants: [
        {
          toolId: 'dataset-query',
          capability: 'dataset:query',
          maximumCalls: 1,
        },
        {
          toolId: 'hybrid-retrieval',
          capability: 'document:retrieve',
          maximumCalls: 1,
        },
      ],
    },
    budget: {
      ...input.budgetCeiling,
      maximumSteps: 3,
      maximumModelCalls: 1,
      maximumToolCalls: 2,
    },
  }
}

function criterion(
  id: Phase05CriterionId,
  fixture: Readonly<Record<string, unknown>>,
  result: Readonly<Record<string, unknown>>,
  passed: boolean,
): Phase05EvaluationCriterion {
  const evidence = { fixture, result }
  return {
    id,
    fixture,
    result,
    status: passed ? 'passed' : 'failed',
    evidenceSha256: evidenceSha256(evidence),
  }
}

function toolDefinition(
  toolId: 'hybrid-retrieval' | 'dataset-query' | 'citation-validation',
  capability: 'document:retrieve' | 'dataset:query' | 'citation:validate',
): typeResearchToolDefinition {
  return {
    toolId,
    capability,
    input: Schema.Struct({ request: Schema.String }),
    output: Schema.Struct({ accepted: Schema.Boolean }),
    timeoutMilliseconds: 1_000,
    idempotent: true,
    authorize: () => Effect.succeed(true),
    execute: () => Effect.succeed({ accepted: true }),
  }
}

function checkpoint(plan: typeof ResearchPlan.Type) {
  return {
    version: '1' as const,
    id: ResearchCheckpointId.make(ids.checkpoint),
    state: {
      version: '1' as const,
      runId: plan.runId,
      planId: plan.id,
      status: 'running' as const,
      currentNodeId: plan.nodes[1]?.id ?? null,
      completed: [{
        nodeId: plan.nodes[0]?.id ?? ResearchPlanNodeId.make(ids.documentNode),
        artifacts: [{
          digest: `sha256:${'a'.repeat(64)}`,
          byteLength: 1_024,
          mediaType: 'application/json',
        }],
      }],
      budget: {
        limits: plan.budget,
        used: {
          steps: 1,
          modelCalls: 0,
          toolCalls: 1,
          tokens: 0,
          elapsedMilliseconds: 25,
          estimatedCostMicros: 0,
          revisions: 0,
        },
      },
      cancellation: 'none' as const,
      duplicateActionCount: 0,
      noProgressCount: 0,
      fredCorrelation: 'phase-05-golden',
      lastEventSequence: 2,
    },
  }
}

export const runPhase05Evaluation = Effect.fn('runPhase05Evaluation')(
  function* (live: Phase05LiveIntegrationEvidence) {
    const input = planningInput()
    const proposal = validPlanProposal()
    const plan = yield* validateResearchPlan(input, proposal)
    const malformed = yield* Effect.either(validateResearchPlan(input, {
      output: proposal,
      diagnostics: 'provider-private-payload',
    }))
    const planning = criterion(
      'planning-contract',
      {
        validProposal: true,
        malformedProviderEnvelope: true,
      },
      {
        schemaValid: Schema.is(ResearchPlan)(plan),
        preExecutionFailureTag: Either.isLeft(malformed)
          ? malformed.left._tag
          : 'none',
        rawProviderPayloadRetained: Either.isLeft(malformed)
          && JSON.stringify(malformed.left).includes('provider-private-payload'),
      },
      Schema.is(ResearchPlan)(plan)
        && Either.isLeft(malformed)
        && malformed.left._tag === 'ResearchContractValidationError'
        && !JSON.stringify(malformed.left).includes('provider-private-payload'),
    )

    const cyclic = {
      ...proposal,
      nodes: proposal.nodes.map((node, index) => index === 0
        ? {
            ...node,
            dependencies: [ids.synthesisNode],
            inputRefs: [
              ...node.inputRefs,
              { kind: 'node-output', nodeId: ids.synthesisNode },
            ],
          }
        : node),
    }
    const unsupportedTool = {
      ...proposal,
      toolPolicy: {
        grants: [{
          ...proposal.toolPolicy.grants[0],
          toolId: 'shell',
        }],
      },
    }
    const unsupportedCapability = {
      ...proposal,
      toolPolicy: {
        grants: [{
          ...proposal.toolPolicy.grants[0],
          capability: 'document:retrieve',
        }],
      },
    }
    const missingDependency = {
      ...proposal,
      nodes: proposal.nodes.map((node, index) => index === 2
        ? { ...node, dependencies: [ids.missingNode] }
        : node),
    }
    const excessFanOut = {
      ...proposal,
      nodes: [
        proposal.nodes[0],
        ...[
          [ids.datasetNode, ids.documentEvidence],
          [ids.extraNodeOne, ids.documentEvidence],
          [ids.extraNodeTwo, ids.documentEvidence],
        ].map(([nodeId, evidenceId]) => ({
          id: nodeId,
          kind: 'answer-synthesis',
          goal: 'Use the retrieved evidence.',
          dependencies: [ids.documentNode],
          inputRefs: [{
            kind: 'node-output',
            nodeId: ids.documentNode,
          }],
          evidenceRefs: [evidenceId],
        })),
      ],
      budget: {
        ...proposal.budget,
        maximumSteps: 4,
        maximumModelCalls: 3,
      },
    }
    const budgetFields = [
      'maximumSteps',
      'maximumModelCalls',
      'maximumToolCalls',
      'maximumTokens',
      'maximumElapsedMilliseconds',
      'maximumEstimatedCostMicros',
      'maximumFanOut',
      'maximumRevisions',
    ] as const
    const excessiveBudgets = budgetFields.map((field) => ({
      ...proposal,
      budget: {
        ...proposal.budget,
        [field]: input.budgetCeiling[field] + 1,
      },
    }))
    const rejected = yield* Effect.all(
      [
        cyclic,
        missingDependency,
        excessFanOut,
        unsupportedTool,
        unsupportedCapability,
        ...excessiveBudgets,
      ].map((candidate) =>
        validateResearchPlan(input, candidate).pipe(Effect.either)),
    )
    const rejectionReasons = rejected.map((outcome) =>
      Either.isLeft(outcome) ? outcome.left.reason : 'accepted')
    const invalidPlans = criterion(
      'invalid-plan-rejections',
      {
        cases: [
          'cyclic-graph',
          'missing-dependency',
          'excess-fanout',
          'unsupported-tool',
          'unsupported-capability',
          ...budgetFields.map((field) => `budget-expansion:${field}`),
        ],
      },
      { rejectionReasons },
      canonicalJson(rejectionReasons)
        === canonicalJson([
          'cyclic-dependency',
          'missing-dependency',
          'fan-out-exceeded',
          'unsupported-tool',
          'unsupported-capability',
          ...budgetFields.map(() => 'invalid-budget'),
        ]),
    )

    const traces: typeResearchToolTrace[] = []
    const definitions = [
      toolDefinition('hybrid-retrieval', 'document:retrieve'),
      toolDefinition('dataset-query', 'dataset:query'),
      toolDefinition('citation-validation', 'citation:validate'),
    ]
    const registry = makeResearchToolRegistry(definitions, {
      trace: (entry) => Effect.sync(() => {
        traces.push(entry)
      }),
    })
    const policies = yield* Effect.all(definitions.map((definition) =>
      registry.policy(definition.toolId)))
    yield* registry.dispatch('hybrid-retrieval', { request: 'policy' }, {
      workspaceId: WorkspaceId.make(ids.workspace),
      projectId: ProjectId.make(ids.project),
      runId: ResearchRunId.make(ids.run),
      nodeId: ResearchPlanNodeId.make(ids.documentNode),
      capability: 'document:retrieve',
      attempt: 1,
      idempotencyKey: 'phase-05:document',
      signal: new AbortController().signal,
    })
    const toolRegistry = criterion(
      'fred-tool-registry',
      { registeredToolIds: definitions.map((item) => item.toolId) },
      {
        policies,
        traceOutcomes: traces.map((trace) => trace.outcome),
      },
      policies.length === 3
        && policies.every((policy) =>
          policy.idempotent && policy.timeoutMilliseconds === 1_000)
        && canonicalJson(traces.map((trace) => trace.outcome))
          === canonicalJson(['started', 'succeeded']),
    )

    const committedCheckpoint = yield* decodeResearchExecutionCheckpoint(
      checkpoint(plan),
    )
    const resume = yield* selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some(committedCheckpoint),
      cancellationStatus: 'none',
      terminalStatus: Option.none(),
    })
    const cancellation = yield* selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some(committedCheckpoint),
      cancellationStatus: 'requested',
      terminalStatus: Option.none(),
    })
    const terminal = yield* selectResearchRecovery(plan, {
      plan: Option.some(plan),
      checkpoint: Option.some(committedCheckpoint),
      cancellationStatus: 'acknowledged',
      terminalStatus: Option.some('cancelled'),
    })
    const recovery = criterion(
      'committed-event-recovery',
      {
        evidenceSource: live.source,
        runId: live.runId,
        committedEventCount: live.recovery.committedEventSequences.length,
        reconnectCursor: live.recovery.reconnectCursor,
        replacementProcessObserved:
          live.recovery.initialProcessId
          !== live.recovery.replacementProcessId,
      },
      {
        reconnectEventCount: live.recovery.reconnectEventSequences.length,
        resumeDisposition: resume.kind,
        cancellationDisposition: cancellation.kind,
        terminalDisposition: terminal.kind,
        terminalStates: live.recovery.terminalStates,
        duplicateDurableEffects: live.recovery.duplicateDurableEffects,
        completedDatasetQueryReplays:
          live.recovery.completedDatasetQueryReplays,
        datasetProviderCallsAfterReplacement:
          live.recovery.datasetProviderCallsAfterReplacement,
        uncommittedDatasetProviderCallsAfterReplacement:
          live.recovery.uncommittedDatasetProviderCallsAfterReplacement,
        datasetArtifactCommitted: live.recovery.datasetArtifactCommitted,
        datasetIdempotencyCommitPersisted:
          live.recovery.datasetIdempotencyCommitPersisted,
        checkpointBytes: live.recovery.checkpointBytes,
        artifactCheckpointMode: live.recovery.artifactCheckpointMode,
      },
      resume.kind === 'resume'
        && cancellation.kind === 'cancel'
        && terminal.kind === 'terminal'
        && terminal.status === 'cancelled'
        && live.recovery.committedEventSequences.length > 0
        && live.recovery.reconnectEventSequences.length > 0
        && live.recovery.terminalStates === 1
        && live.recovery.duplicateDurableEffects === 0
        && live.recovery.completedDatasetQueryReplays === 0
        && live.recovery.datasetProviderCallsAfterReplacement === 0
        && live.recovery.uncommittedDatasetProviderCallsAfterReplacement === 1
        && live.recovery.datasetArtifactCommitted
        && live.recovery.datasetIdempotencyCommitPersisted
        && live.recovery.artifactCheckpointMode === 'by-reference'
        && live.recovery.checkpointBytes > 0
        && live.recovery.checkpointBytes <= 64 * 1_024
        && live.recovery.initialProcessId
          !== live.recovery.replacementProcessId,
    )

    const recoveryGates = criterion(
      'recovery-boundary-gates',
      {
        requiredBoundaries: [
          'restart-after-plan',
          'restart-after-tool-attempt-before-commit',
          'restart-after-checkpoint-commit',
          'restart-during-cancellation',
        ],
        requiredFailureKinds: ['provider', 'model'],
      },
      {
        ...live.recovery.gates,
        failureHistory: live.recovery.failureHistory,
      },
      Object.values(live.recovery.gates).every((observed) => observed)
        && live.recovery.failureHistory.some(({ kind }) => kind === 'provider')
        && live.recovery.failureHistory.some(({ kind }) => kind === 'model'),
    )

    const executionPolicy: typeResearchExecutionPolicy = {
      maximumDuplicateActions: 1,
      maximumNoProgressActions: 2,
    }
    const baseState = initialResearchGraphState({
      runId: plan.runId,
      planId: plan.id,
      workspaceId: plan.workspaceId,
      projectId: plan.projectId,
    }, 1_000)
    const datasetAction: typeResearchAction = {
      kind: 'tool',
      nodeId: ResearchPlanNodeId.make(ids.datasetNode),
      toolId: 'dataset-query',
      capability: 'dataset:query',
      fingerprint: `${ids.datasetNode}:dataset-query`,
      estimatedCostMicros: 1,
    }
    const modelAction: typeResearchAction = {
      kind: 'model',
      nodeId: ResearchPlanNodeId.make(ids.synthesisNode),
      role: 'synthesis',
      fingerprint: `${ids.synthesisNode}:synthesis`,
      estimatedCostMicros: 1,
    }
    const directBudgetCases = [
      ['maximumSteps', { steps: plan.budget.maximumSteps }, datasetAction, 1_001],
      [
        'maximumModelCalls',
        { modelCalls: plan.budget.maximumModelCalls },
        modelAction,
        1_001,
      ],
      [
        'maximumToolCalls',
        { toolCalls: plan.budget.maximumToolCalls },
        datasetAction,
        1_001,
      ],
      [
        'maximumEstimatedCostMicros',
        { estimatedCostMicros: plan.budget.maximumEstimatedCostMicros },
        datasetAction,
        1_001,
      ],
      [
        'maximumElapsedMilliseconds',
        {},
        datasetAction,
        1_000 + plan.budget.maximumElapsedMilliseconds + 1,
      ],
      [
        'maximumFanOut',
        { activeConcurrency: plan.budget.maximumFanOut },
        datasetAction,
        1_001,
      ],
    ] as const
    const directBudgetResults = yield* Effect.all(
      directBudgetCases.map(([field, overrides, action, nowMilliseconds]) =>
        beginResearchAction(
          plan,
          executionPolicy,
          { ...baseState, ...overrides },
          action,
          nowMilliseconds,
        ).pipe(
          Effect.either,
          Effect.map((outcome) => ({
            field,
            stopped: Either.isLeft(outcome),
            reason: Either.isLeft(outcome) ? outcome.left.reason.kind : 'none',
          })),
        )),
    )
    const checkpointBudgetResults = yield* Effect.all([
      {
        field: 'maximumTokens',
        used: { tokens: plan.budget.maximumTokens + 1 },
      },
      {
        field: 'maximumRevisions',
        used: { revisions: plan.budget.maximumRevisions + 1 },
      },
    ].map(({ field, used }) => {
      const baseCheckpoint = checkpoint(plan)
      return decodeResearchExecutionCheckpoint({
        ...baseCheckpoint,
        state: {
          ...baseCheckpoint.state,
          budget: {
            ...baseCheckpoint.state.budget,
            used: {
              ...baseCheckpoint.state.budget.used,
              ...used,
            },
          },
        },
      }).pipe(
        Effect.either,
        Effect.map((outcome) => ({
          field,
          stopped: Either.isLeft(outcome),
          reason: Either.isLeft(outcome)
            ? 'checkpoint-budget-validation'
            : 'none',
        })),
      )
    }))
    const policyCases = [
      {
        field: 'maximumDuplicateActions',
        state: {
          ...baseState,
          actionFingerprints: [datasetAction.fingerprint],
        },
      },
      {
        field: 'maximumNoProgressActions',
        state: {
          ...baseState,
          noProgressCount: executionPolicy.maximumNoProgressActions,
          lastProgressFingerprint: 'unchanged',
        },
      },
    ] as const
    const directPolicyResults = yield* Effect.all(policyCases.map(
      ({ field, state }) =>
        beginResearchAction(
          plan,
          executionPolicy,
          state,
          datasetAction,
          1_001,
        ).pipe(
          Effect.either,
          Effect.map((outcome) => ({
            field,
            stopped: Either.isLeft(outcome),
            reason: Either.isLeft(outcome) ? outcome.left.reason.kind : 'none',
          })),
        ),
    ))
    const executionBudgetPolicy = criterion(
      'execution-budget-policy',
      {
        budgetFields,
        policyFields: [
          'maximumDuplicateActions',
          'maximumNoProgressActions',
          'toolPolicy.maximumCalls',
        ],
      },
      {
        planCeilingRejections: budgetFields.map((field, index) => ({
          field,
          reason: rejectionReasons[index + 5],
        })),
        directBudgetResults,
        checkpointBudgetResults,
        directPolicyResults,
        toolGrantLimitValidated: plan.toolPolicy.grants.every(
          (grant) => grant.maximumCalls <= plan.budget.maximumToolCalls,
        ),
      },
      budgetFields.every(
        (_field, index) => rejectionReasons[index + 5] === 'invalid-budget',
      )
        && directBudgetResults.every(({ stopped }) => stopped)
        && checkpointBudgetResults.every(({ stopped }) => stopped)
        && directPolicyResults.every(({ stopped }) => stopped)
        && plan.toolPolicy.grants.every(
          (grant) => grant.maximumCalls <= plan.budget.maximumToolCalls,
        ),
    )

    const retryHistory: Array<{
      readonly attempt: number
      readonly errorTag: string
      readonly willRetry: boolean
      readonly stopReason: string | null
    }> = []
    let calls = 0
    const retryResult = yield* executeResearchToolWithRetry(
      {
        toolId: 'dataset-query',
        capability: 'dataset:query',
        nodeId: ResearchPlanNodeId.make(ids.datasetNode),
        runId: ResearchRunId.make(ids.run),
        idempotent: true,
        idempotencyKey: 'phase-05:dataset',
        signal: new AbortController().signal,
      },
      {
        maximumAttempts: 2,
        initialBackoffMilliseconds: 1,
        maximumBackoffMilliseconds: 1,
      },
      {
        sleep: () => Effect.void,
        onAttempt: (attempt) => Effect.sync(() => {
          retryHistory.push({
            attempt: attempt.attempt,
            errorTag: attempt.errorTag,
            willRetry: attempt.willRetry,
            stopReason: attempt.stopReason,
          })
        }),
      },
      () => Effect.suspend(() => {
        calls += 1
        return calls === 1
          ? Effect.fail(new ResearchToolProviderUnavailableError({
              toolId: 'dataset-query',
              capability: 'dataset:query',
              nodeId: ResearchPlanNodeId.make(ids.datasetNode),
              runId: ResearchRunId.make(ids.run),
              message: 'Provider temporarily unavailable',
            }))
          : Effect.succeed({ artifactDigest: 'b'.repeat(64) })
      }),
    )
    const diagnostics = {
      failureTag: retryHistory[0]?.errorTag ?? 'none',
      retryAttempts: retryHistory,
      operatorAction: 'automatic-retry-completed',
      secretFields: 0,
    }
    const typedFailures = criterion(
      'typed-failure-diagnostics',
      { transientFailuresBeforeSuccess: 1, maximumAttempts: 2 },
      { retryResult, diagnostics },
      calls === 2
        && retryHistory.length === 1
        && retryHistory[0]?.willRetry === true
        && diagnostics.secretFields === 0,
    )

    const goldenTrace = ['started', 'succeeded']
    const observedTrace = traces.map((trace) => trace.outcome)
    const traceRegression = criterion(
      'golden-trace-regression',
      { goldenTrace },
      {
        observedTrace,
        goldenTraceSha256: evidenceSha256(goldenTrace),
        observedTraceSha256: evidenceSha256(observedTrace),
      },
      canonicalJson(goldenTrace) === canonicalJson(observedTrace),
    )

    const runtimeBoundary = criterion(
      'runtime-boundary',
      {
        requiredHost: 'bun',
        requiredSidecar: 'node-24',
        authenticationRequired: true,
        noEgressRequired: true,
      },
      {
        ...live.runtime,
      },
      live.source === 'live-postgresql-compose'
        && live.runtime.host === 'bun'
        && live.runtime.bunVersion === Bun.version
        && /^v24\./.test(live.runtime.sidecarNodeVersion)
        && live.runtime.authenticatedHealth
        && live.runtime.isolatedNoEgress
        && live.runtime.bunHostHealthyDuringSidecarRestart
        && live.runtime.sidecarRecovered,
    )

    const reproductionPath = resolve(
      import.meta.dir,
      '../fixtures/fred-gap-reproduction.json',
    )
    const reproduction = yield* Effect.tryPromise({
      try: () => readFile(reproductionPath, 'utf8'),
      catch: () => new Phase05EvaluationError({
        criterionId: 'fred-gap-portability',
        message: 'Fred portability reproduction could not be read',
      }),
    })
    const decodedReproduction = yield* Schema.decodeUnknown(
      Schema.Struct({
        schemaVersion: Schema.Literal('1.0.0'),
        issue: Schema.Literal('fred-generic-checkpoint-resume-gap'),
        runtime: Schema.Literal('generic-typescript'),
        reproduction: Schema.Struct({
          setup: Schema.Array(Schema.String).pipe(Schema.minItems(2)),
          action: Schema.Array(Schema.String).pipe(Schema.minItems(2)),
          expected: Schema.String.pipe(Schema.minLength(1)),
          observed: Schema.String.pipe(Schema.minLength(1)),
        }),
        productDisposition: Schema.Literal('product-local-adapter'),
        deliveryBlocked: Schema.Literal(false),
      }),
    )(JSON.parse(reproduction)).pipe(
      Effect.mapError(() => new Phase05EvaluationError({
        criterionId: 'fred-gap-portability',
        message: 'Fred portability reproduction shape is invalid',
      })),
    )
    const fredGap = criterion(
      'fred-gap-portability',
      {
        reproductionPath: 'packages/evaluation/fixtures/fred-gap-reproduction.json',
        issue: decodedReproduction.issue,
      },
      {
        artifactSha256: sha256(reproduction),
        runtime: decodedReproduction.runtime,
        productDisposition: decodedReproduction.productDisposition,
        deliveryBlocked: decodedReproduction.deliveryBlocked,
      },
      decodedReproduction.runtime === 'generic-typescript'
        && decodedReproduction.productDisposition === 'product-local-adapter'
        && decodedReproduction.deliveryBlocked === false,
    )

    const criteria = [
      planning,
      invalidPlans,
      toolRegistry,
      recovery,
      recoveryGates,
      executionBudgetPolicy,
      typedFailures,
      traceRegression,
      runtimeBoundary,
      fredGap,
    ].toSorted((left, right) => left.id.localeCompare(right.id))
    const uniqueIds = new Set(criteria.map((item) => item.id))
    if (
      criteria.length !== phase05CriterionIds.length
      || uniqueIds.size !== phase05CriterionIds.length
      || !phase05CriterionIds.every((id) => uniqueIds.has(id))
    ) {
      return yield* new Phase05EvaluationError({
        criterionId: 'report',
        message: 'Phase 05 criterion inventory is incomplete or duplicated',
      })
    }
    const passedCount = criteria.filter(
      (item) => item.status === 'passed',
    ).length
    const failedCount = criteria.length - passedCount
    const body: Phase05EvaluationReportBody = {
      schemaVersion: '1.0.0',
      evaluationId: PHASE_05_EVALUATION_ID,
      status: failedCount === 0 ? 'passed' : 'failed',
      runtime: {
        host: 'bun',
        sidecar: 'node-24',
        sidecarProtocol: 'authenticated-http-v1',
        isolation: 'compose-no-egress',
      },
      counts: {
        criteria: criteria.length,
        passed: passedCount,
        failed: failedCount,
      },
      criteria,
    }
    return {
      ...body,
      reportSha256: evidenceSha256(body),
    } satisfies Phase05EvaluationReport
  },
)

export function serializePhase05EvaluationReport(
  report: Phase05EvaluationReport,
): string {
  return canonicalJson(report)
}

export function verifyPhase05TrackedReportIntegrity(
  trackedBytes: string,
  freshBytes: string,
): void {
  const parsed: unknown = JSON.parse(trackedBytes)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('tracked Phase 05 report must be a JSON object')
  }
  const tracked = Object.fromEntries(Object.entries(parsed))
  const trackedHash = tracked['reportSha256']
  if (
    typeof trackedHash !== 'string'
    || !/^[0-9a-f]{64}$/.test(trackedHash)
  ) {
    throw new Error('tracked Phase 05 report hash is missing or malformed')
  }
  const trackedBody = { ...tracked }
  delete trackedBody['reportSha256']
  if (sha256(canonicalJson(trackedBody)) !== trackedHash) {
    throw new Error('tracked Phase 05 report hash does not match its body')
  }
  if (canonicalJson(tracked) !== trackedBytes) {
    throw new Error('tracked Phase 05 report bytes are not canonical')
  }
  if (trackedBytes !== freshBytes) {
    throw new Error(
      'tracked Phase 05 report differs from fresh evaluation output',
    )
  }
}
