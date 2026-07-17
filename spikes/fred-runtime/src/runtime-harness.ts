import { createFred, defineWorkflow } from '@fancyrobot/fred';
import {
  type ApiKeyStoreService,
  type FredWithHttp,
  withHttp,
} from '@fancyrobot/fred-http';
import { Effect, Schema } from 'effect';
import {
  type ArtifactReference,
  CheckpointMetadataSchema,
  type HookRecord,
  HookRecordSchema,
  type ResearchRunInput,
  ResearchRunInputSchema,
  type ResearchRunTerminal,
  ResearchRunTerminalSchema,
  type DeterministicToolInput,
  type DeterministicToolOutput,
  DeterministicToolInputSchema,
  DeterministicToolOutputSchema,
  type ProgressInput,
  ProgressInputSchema,
  ProgressOutputSchema,
} from './contracts';

export const WORKFLOW_ID = 'research-run-spike';
export const STREAM_WORKFLOW_ID = 'research-progress-spike';
export const CHECKPOINT_INLINE_BUDGET_BYTES = 64 * 1024;
const SUPPORTED_HOOKS = [
  'beforePipeline',
  'beforeStep',
  'afterStep',
  'afterPipeline',
  'onStepError',
] as const;
const PERSISTED_FIELDS = [
  'runId',
  'currentNodeId',
  'completedStepRefs',
  'budgetSnapshot',
  'fredRunCorrelationId',
  'artifactRef',
] as const;
const DEFAULT_EVIDENCE = [
  'compatibility-matrix',
  'boundary-table',
  'step-02-handoff',
] as const;
const DEFAULT_LIMITATIONS = [
  'Granular live events stay provisional until STEP-00-02.',
  'Cross-process resume and durable cancellation remain Step 02 responsibilities.',
  'Large tool payloads must remain artifact-referenced, not checkpoint-inline.',
] as const;

const decodeResearchRunInput = Schema.decodeUnknownSync(ResearchRunInputSchema);
const decodeDeterministicToolInput = Schema.decodeUnknownSync(DeterministicToolInputSchema);
const decodeDeterministicToolOutput = Schema.decodeUnknownSync(DeterministicToolOutputSchema);
const decodeResearchRunTerminal = Schema.decodeUnknownSync(ResearchRunTerminalSchema);
const decodeProgressInput = Schema.decodeUnknownSync(ProgressInputSchema);
const decodeCheckpointMetadata = Schema.decodeUnknownSync(CheckpointMetadataSchema);
const decodeHookRecord = Schema.decodeUnknownSync(HookRecordSchema);

export class DeterministicToolFailure extends Schema.TaggedError<DeterministicToolFailure>()(
  'DeterministicToolFailure',
  {
    message: Schema.String,
    reason: Schema.Literal('missing-product-adapter'),
    artifactId: Schema.String,
  },
) {}

export class DeterministicToolValidationFailure extends Schema.TaggedError<DeterministicToolValidationFailure>()(
  'DeterministicToolValidationFailure',
  {
    message: Schema.String,
    boundary: Schema.Literal('tool-output-schema'),
  },
) {}

class DeterministicResearchTool extends Effect.Service<DeterministicResearchTool>()(
  'DeterministicResearchTool',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const plan = Effect.fn('DeterministicResearchTool.plan')(function* (
        input: DeterministicToolInput,
      ) {
        if (input.retrievalQuery.includes('tool-error')) {
          return yield* new DeterministicToolFailure({
            message:
              'Missing product-local adapter for the requested deterministic retrieval path.',
            reason: 'missing-product-adapter',
            artifactId: input.artifactRef.artifactId,
          });
        }

        if (input.retrievalQuery.includes('tool-invalid-output')) {
          const malformedOutput: unknown = {
            strategy: 'not-a-supported-strategy',
            boundedSummary: 42,
            evidenceKeys: ['compatibility-matrix'],
            artifactRef: input.artifactRef,
            limitations: [],
          };

          try {
            return decodeDeterministicToolOutput(malformedOutput);
          } catch {
            return yield* new DeterministicToolValidationFailure({
              message: 'Deterministic tool output failed schema validation.',
              boundary: 'tool-output-schema',
            });
          }
        }

        const output: DeterministicToolOutput = {
          strategy: 'hybrid-retrieval',
          boundedSummary:
            'Use Fred to schedule a typed workflow, but keep deterministic retrieval, persistence, and checkpoint shaping inside product-owned Effect services.',
          evidenceKeys: [...input.expectedEvidence],
          artifactRef: input.artifactRef,
          limitations: [...DEFAULT_LIMITATIONS],
        };
        return decodeDeterministicToolOutput(output);
      });

      return { plan };
    }),
  },
) {}

type ExecutionResultLike = {
  success: boolean;
  status: string;
  executedNodes: string[];
  finalOutput?: unknown;
  error?: unknown;
  runId?: string;
};

function recordHook(trace: HookRecord[], hook: HookRecord['hook'], nodeId?: string): void {
  trace.push(
    decodeHookRecord({
      order: trace.length,
      hook,
      ...(nodeId ? { nodeId } : {}),
    }),
  );
}

function createBoundaryRecommendation() {
  return {
    fredOwns: [
      'typed workflow graph execution',
      'step scheduling',
      'workflow hooks',
      'optional HTTP workflow transport',
    ],
    productOwns: [
      'typed domain schemas',
      'deterministic retrieval and persistence services',
      'run IDs and journal cursors',
      'checkpoint records and artifact references',
      'SSE projection, authorization, and replay policy',
    ],
    step02Handoff: {
      runCorrelationRule:
        'Product runId is primary. Fred run identity is correlation metadata only.',
      checkpointOwner: 'product-journal',
      eventHooks: [...SUPPORTED_HOOKS],
      unresolvedGaps: [
        'granular progress events',
        'durable cancellation',
        'cross-process checkpoint resume',
        'large outputs by reference',
      ],
    },
  };
}

function makeRunCorrelation(input: ResearchRunInput) {
  return {
    productRunId: input.runId,
    fredWorkflowId: WORKFLOW_ID,
    fredRunCorrelationId: `${input.runId}::fred`,
    attempt: 1,
    eventSequenceBase: 0,
  };
}

function stabilizeInlineBytes<T extends { inlineBytes: number }>(value: T): T {
  // `inlineBytes` contributes to the serialized size, so compute until the field
  // reaches a fixed point instead of hard-coding duplicate assignments.
  let next = value;

  while (true) {
    const inlineBytes = Buffer.byteLength(JSON.stringify(next), 'utf8');
    if (inlineBytes === next.inlineBytes) {
      return next;
    }
    next = {
      ...next,
      inlineBytes,
    };
  }
}

function makeCheckpoint(
  input: ResearchRunInput,
  artifactRef: ArtifactReference,
  currentNodeId: string,
) {
  const base = {
    runId: input.runId,
    fredWorkflowId: WORKFLOW_ID,
    productCursor: `${input.runId}:1:4`,
    currentNodeId,
    artifactRef,
    persistedFields: [...PERSISTED_FIELDS],
    hookPoints: [...SUPPORTED_HOOKS],
  };

  return decodeCheckpointMetadata(
    stabilizeInlineBytes({
      ...base,
      inlineBytes: 0,
    }),
  );
}

function annotateError(error: unknown): Error {
  if (error && typeof error === 'object' && '_tag' in error) {
    const tag = String((error as { _tag: unknown })._tag);
    const message = 'message' in error
      ? String((error as { message: unknown }).message)
      : JSON.stringify(error);
    return new Error(`${tag}: ${message}`);
  }

  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const message = 'message' in error
      ? String((error as { message: unknown }).message)
      : JSON.stringify(error);
    return new Error(`UnknownError: ${message}`);
  }

  return new Error(String(error));
}

function createResearchRunWorkflow(hookTrace: HookRecord[]) {
  return defineWorkflow({
    id: WORKFLOW_ID,
    entry: 'prepareBoundary',
    input: ResearchRunInputSchema,
    output: ResearchRunTerminalSchema,
    nodes: [
      {
        id: 'prepareBoundary',
        kind: 'function',
        fn: (context) => {
          const input = decodeResearchRunInput(context.input);
          return {
            request: input,
            runCorrelation: makeRunCorrelation(input),
          };
        },
      },
      {
        id: 'runDeterministicTool',
        kind: 'function',
        fn: async (context) => {
          const prepareBoundary = (context.outputs as Record<string, unknown>).prepareBoundary as {
            request: ResearchRunInput;
          };
          const input = decodeResearchRunInput(prepareBoundary.request);
          const toolInput = decodeDeterministicToolInput({
            question: input.question,
            retrievalQuery: input.retrievalQuery,
            sourceVersionId: input.sourceVersionId,
            artifactRef: input.artifact,
            expectedEvidence: input.expectedEvidence,
          });
          return Effect.runPromise(
            DeterministicResearchTool.plan(toolInput).pipe(
              Effect.provide(DeterministicResearchTool.Default),
            ),
          ).catch((error) => {
            const annotated = annotateError(error);
            if (input.retrievalQuery.includes('tool-invalid-output')) {
              throw new Error(
                `DeterministicToolValidationFailure: ${annotated.message}`,
              );
            }
            if (annotated.message.startsWith('DeterministicToolFailure:')) {
              throw annotated;
            }
            throw new Error(`DeterministicToolFailure: ${annotated.message}`);
          });
        },
      },
      {
        id: 'materializeCheckpoint',
        kind: 'function',
        fn: (context) => {
          const prepareBoundary = (context.outputs as Record<string, unknown>).prepareBoundary as {
            request: ResearchRunInput;
          };
          const input = decodeResearchRunInput(prepareBoundary.request);
          const toolResult = decodeDeterministicToolOutput(
            (context.outputs as Record<string, unknown>).runDeterministicTool,
          );
          return makeCheckpoint(input, toolResult.artifactRef, 'emitRecommendation');
        },
      },
      {
        id: 'emitRecommendation',
        kind: 'function',
        fn: (context) => {
          const prepareBoundary = (context.outputs as Record<string, unknown>).prepareBoundary as {
            request: ResearchRunInput;
            runCorrelation: ReturnType<typeof makeRunCorrelation>;
          };
          const input = decodeResearchRunInput(prepareBoundary.request);
          const toolResult = decodeDeterministicToolOutput(
            (context.outputs as Record<string, unknown>).runDeterministicTool,
          );
          const checkpoint = decodeCheckpointMetadata(
            (context.outputs as Record<string, unknown>).materializeCheckpoint,
          );
          const candidate = {
            status: 'completed',
            runCorrelation: makeRunCorrelation(input),
            checkpoint,
            toolResult,
            recommendation: createBoundaryRecommendation(),
          };

          if (input.retrievalQuery.includes('workflow-invalid-output')) {
            return {
              ...candidate,
              recommendation: {
                fredOwns: 'invalid-shape',
              },
            };
          }

          return decodeResearchRunTerminal(candidate);
        },
      },
    ],
    edges: [
      { from: 'prepareBoundary', to: 'runDeterministicTool' },
      { from: 'runDeterministicTool', to: 'materializeCheckpoint' },
      { from: 'materializeCheckpoint', to: 'emitRecommendation' },
    ],
    hooks: {
      beforePipeline: [() => recordHook(hookTrace, 'beforePipeline')],
      beforeStep: [
        (event: any) => recordHook(hookTrace, 'beforeStep', String(event.data.step?.name ?? 'unknown')),
      ],
      afterStep: [
        (event: any) => recordHook(hookTrace, 'afterStep', String(event.data.step?.name ?? 'unknown')),
      ],
      afterPipeline: [() => recordHook(hookTrace, 'afterPipeline')],
      onStepError: [
        (event: any) => recordHook(hookTrace, 'onStepError', String(event.data.step?.name ?? 'unknown')),
      ],
    },
  });
}

function createProgressWorkflow() {
  return defineWorkflow({
    id: STREAM_WORKFLOW_ID,
    entry: 'progress',
    input: ProgressInputSchema,
    output: ProgressOutputSchema,
    nodes: [
      {
        id: 'progress',
        kind: 'function',
        fn: (context) => {
          const input = decodeProgressInput(context.input) as ProgressInput;
          return { accepted: true, job: input.job };
        },
      },
    ],
    edges: [],
  });
}

async function registerSpikeWorkflows(
  fred: Awaited<ReturnType<typeof createFred>>,
  hookTrace: HookRecord[],
): Promise<void> {
  await fred.workflows.define(createResearchRunWorkflow(hookTrace));
  await fred.workflows.define(createProgressWorkflow());
}

export function makeResearchRunInput(
  overrides: Partial<ResearchRunInput> = {},
): ResearchRunInput {
  const base: ResearchRunInput = {
    runId: 'research-run-001',
    question: 'What Fred surface should Phase 0 rely on for one deterministic research run?',
    retrievalQuery: 'fred workflow integration boundary',
    sourceVersionId: 'source-version-001',
    artifact: {
      artifactId: 'artifact-2026-07-17',
      sha256: 'a'.repeat(64),
      bytes: 131072,
    },
    expectedEvidence: [...DEFAULT_EVIDENCE],
  };

  return decodeResearchRunInput({
    ...base,
    ...overrides,
    artifact: {
      ...base.artifact,
      ...(overrides.artifact ?? {}),
    },
    expectedEvidence: overrides.expectedEvidence ?? base.expectedEvidence,
  });
}

export async function runRuntimeSpike(input: ResearchRunInput) {
  const hookTrace: HookRecord[] = [];
  const fred = await createFred();

  try {
    await registerSpikeWorkflows(fred, hookTrace);
    const execution = await fred.workflows.run(WORKFLOW_ID, input) as ExecutionResultLike;

    if (!execution || typeof execution !== 'object' || typeof execution.success !== 'boolean') {
      throw new Error('Fred returned an unexpected workflow result shape.');
    }

    if (!execution.success) {
      throw annotateError(execution.error);
    }

    const finalOutput = decodeResearchRunTerminal(execution.finalOutput);
    if (finalOutput.checkpoint.inlineBytes >= CHECKPOINT_INLINE_BUDGET_BYTES) {
      throw new Error(
        `Checkpoint exceeded inline budget: ${finalOutput.checkpoint.inlineBytes} bytes.`,
      );
    }

    return {
      execution,
      finalOutput,
      hookTrace,
    };
  } catch (error) {
    throw annotateError(error);
  } finally {
    await fred.shutdown();
  }
}

export async function createHttpSpikeRuntime(
  options: { apiKeyStore: ApiKeyStoreService },
): Promise<FredWithHttp> {
  const core = await createFred();
  try {
    await registerSpikeWorkflows(core, []);
    return withHttp(core, {
      apiKeyStore: options.apiKeyStore,
      security: {
        corsAllowedOrigins: ['http://localhost:*', 'http://127.0.0.1:*'],
        maxRequestBodySize: 64 * 1024,
        requestTimeoutSeconds: 10,
      },
      workflowEndpoints: {
        [WORKFLOW_ID]: { auth: { scopes: ['workflows:run'] } },
        [STREAM_WORKFLOW_ID]: { stream: true, auth: { scopes: ['workflows:stream'] } },
      },
    });
  } catch (error) {
    await core.shutdown();
    throw annotateError(error);
  }
}
