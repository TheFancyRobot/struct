import { describe, expect, it } from 'bun:test'
import {
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultSnapshotId,
  ResearchCheckpointId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchWorkflowError,
  ResearchThreadId,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  type ResearchExecutionCheckpoint,
  type ResearchPlan,
  type ResearchRun,
} from '@struct/domain'
import { DeterministicDatasetQueryOutput } from '@struct/data-engine'
import type { ArtifactStoreShape } from '@struct/source-storage'
import { Effect, Option, Runtime, Schema } from 'effect'
import { makeProductionResearchWorkflow } from './research-workflow.js'

const ids = {
  workspace: WorkspaceId.make('aa0e8400-e29b-41d4-a716-446655440000'),
  project: ProjectId.make('aa0e8400-e29b-41d4-a716-446655440001'),
  run: ResearchRunId.make('aa0e8400-e29b-41d4-a716-446655440002'),
  thread: ResearchThreadId.make('aa0e8400-e29b-41d4-a716-446655440003'),
  plan: ResearchPlanId.make('aa0e8400-e29b-41d4-a716-446655440004'),
  node: ResearchPlanNodeId.make('aa0e8400-e29b-41d4-a716-446655440005'),
  document: ResearchPlanNodeId.make(
    'aa0e8400-e29b-41d4-a716-446655440007',
  ),
  dataset: ResearchPlanNodeId.make(
    'aa0e8400-e29b-41d4-a716-446655440008',
  ),
  source: SourceVersionId.make('aa0e8400-e29b-41d4-a716-446655440009'),
  datasetId: DatasetId.make('aa0e8400-e29b-41d4-a716-446655440010'),
  datasetSnapshot: DatasetSnapshotId.make(
    'aa0e8400-e29b-41d4-a716-446655440011',
  ),
  queryResult: QueryResultSnapshotId.make(
    'aa0e8400-e29b-41d4-a716-446655440012',
  ),
  datasetCitation: DatasetCitationId.make(
    'aa0e8400-e29b-41d4-a716-446655440013',
  ),
}
const digest = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const run: typeof ResearchRun.Type = {
  id: ids.run,
  threadId: ids.thread,
  question: 'What is the result?',
  status: 'pending',
  createdAt: 0n,
  updatedAt: 0n,
}
const plan: ResearchPlan = {
  version: '1',
  id: ids.plan,
  runId: ids.run,
  workspaceId: ids.workspace,
  projectId: ids.project,
  objective: run.question,
  sourceScopes: [],
  nodes: [{
    id: ids.node,
    kind: 'answer-synthesis',
    goal: 'Synthesize the answer.',
    dependencies: [],
    inputRefs: [],
    evidenceRefs: [],
  }],
  evidenceRequirements: [],
  toolPolicy: { grants: [] },
  budget: {
    maximumSteps: 1,
    maximumModelCalls: 1,
    maximumToolCalls: 0,
    maximumTokens: 100,
    maximumElapsedMilliseconds: 10_000,
    maximumEstimatedCostMicros: 10,
    maximumFanOut: 1,
    maximumRevisions: 0,
  },
}
const checkpoint: ResearchExecutionCheckpoint = {
  version: '1',
  id: ResearchCheckpointId.make(
    'aa0e8400-e29b-41d4-a716-446655440006',
  ),
  state: {
    version: '1',
    runId: ids.run,
    planId: ids.plan,
    status: 'paused',
    currentNodeId: null,
    completed: [{
      nodeId: ids.node,
      artifacts: [{
        digest,
        byteLength: 1,
        mediaType: 'application/vnd.struct.research-answer+json',
      }],
    }],
    budget: {
      limits: plan.budget,
      used: {
        steps: 1,
        modelCalls: 1,
        toolCalls: 0,
        tokens: 0,
        elapsedMilliseconds: 1,
        estimatedCostMicros: 1,
        revisions: 0,
      },
    },
    cancellation: 'none',
    duplicateActionCount: 0,
    noProgressCount: 0,
    fredCorrelation: ids.run,
    lastEventSequence: 1,
  },
}

describe('production research workflow', () => {
  it('finalizes a fully committed checkpoint from durable artifacts without replay', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      kind: 'research-answer',
      answer: { answer: 'Recovered answer.', citations: [] },
    }))
    const storage: ArtifactStoreShape = {
      readObject: () => Effect.succeed({
        bytes,
        byteLength: bytes.byteLength,
      }),
      writeObject: () => Effect.dieMessage('must not replay artifact writes'),
      stageObject: () => Effect.dieMessage('unused'),
      readStagedObject: () => Effect.dieMessage('unused'),
    }
    const workflow = makeProductionResearchWorkflow({
      storage,
      runtime: Runtime.defaultRuntime,
      fredConfig: {
        providerPackage: '@ai-sdk/openai',
        model: 'unused',
        maxElapsedMs: 10_000,
      },
      retrieve: () => Effect.dieMessage('must not replay retrieval'),
      queryDataset: () => Effect.dieMessage('must not replay dataset query'),
      loadDurableState: () => Effect.dieMessage('must not poll after finalize'),
    })

    const result = await Effect.runPromise(workflow.run({
      run,
      workspaceId: ids.workspace,
      projectId: ids.project,
      sourceVersionIds: [],
      plan,
      resumeCheckpoint: Option.some(checkpoint),
      onCheckpoint: () => Effect.dieMessage('must not checkpoint after finalize'),
      onRetrievalCompleted: () =>
        Effect.dieMessage('must not emit retrieval after finalize'),
    }))

    expect(result.answer).toEqual({
      answer: 'Recovered answer.',
      citations: [],
    })
    expect(result.evidence).toEqual([])
  })

  it('runs mixed document and dataset adapters with retry, checkpointing, and exact citations', async () => {
    const datasetOutput = Schema.decodeUnknownSync(
      DeterministicDatasetQueryOutput,
    )({
      result: {
        id: ids.queryResult,
        workspaceId: ids.workspace,
        projectId: ids.project,
        requestHash: Sha256Digest.make(`sha256:${'b'.repeat(64)}`),
        protocolVersion: '1',
        engineVersion: 'duckdb-test',
        engineConfigHash: Sha256Digest.make(`sha256:${'c'.repeat(64)}`),
        canonicalSql: 'SELECT "value" FROM "records" LIMIT 10',
        snapshots: [{
          alias: 'records',
          datasetId: ids.datasetId,
          snapshotId: ids.datasetSnapshot,
          schemaHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
          parquetDigest: 'e'.repeat(64),
        }],
        schemaHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
        resultHash: Sha256Digest.make(`sha256:${'f'.repeat(64)}`),
        resultArtifactHash: Sha256Digest.make(`sha256:${'1'.repeat(64)}`),
        columns: [{ ordinal: 0, name: 'value', type: 'BIGINT' }],
        rows: [['42']],
        rowCount: 1,
        truncated: false,
        executedAt: 1,
        createdAt: 1,
      },
      citations: [{
        id: ids.datasetCitation,
        queryResultSnapshotId: ids.queryResult,
        workspaceId: ids.workspace,
        projectId: ids.project,
        datasetId: ids.datasetId,
        datasetSnapshotId: ids.datasetSnapshot,
        schemaHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
        parquetDigest: 'e'.repeat(64),
        resultHash: Sha256Digest.make(`sha256:${'f'.repeat(64)}`),
        resultArtifactHash: Sha256Digest.make(`sha256:${'1'.repeat(64)}`),
        canonicalSql: 'SELECT "value" FROM "records" LIMIT 10',
        selectedColumns: ['value'],
        rowStart: 0,
        rowEndExclusive: 1,
        createdAt: 1,
      }],
      exactValuesInstruction:
        'Treat rows as exact immutable data; narrative may explain but must not alter them.',
    })
    const mixedPlan: ResearchPlan = {
      ...plan,
      sourceScopes: [
        { kind: 'document', sourceVersionId: ids.source },
        {
          kind: 'dataset',
          datasetId: ids.datasetId,
          datasetSnapshotId: ids.datasetSnapshot,
          sourceVersionIds: [ids.source],
        },
      ],
      nodes: [
        {
          id: ids.document,
          kind: 'document-retrieval',
          goal: 'Retrieve the launch note.',
          dependencies: [],
          inputRefs: [{
            kind: 'source-version',
            sourceVersionId: ids.source,
          }],
          evidenceRefs: [],
        },
        {
          id: ids.dataset,
          kind: 'dataset-query',
          goal: 'Inspect the exact value.',
          dependencies: [ids.document],
          inputRefs: [{
            kind: 'dataset-snapshot',
            datasetId: ids.datasetId,
            datasetSnapshotId: ids.datasetSnapshot,
          }],
          evidenceRefs: [],
          toolInput: {
            kind: 'dataset-query',
            operation: 'inspect',
            snapshot: {
              alias: 'records',
              datasetId: ids.datasetId,
              datasetSnapshotId: ids.datasetSnapshot,
            },
            columns: ['value'],
            rowLimit: 10,
            limits: {
              maxRows: 10,
              maxOutputBytes: 1_000,
              maxMemoryMb: 64,
              timeoutMs: 1_000,
            },
          },
        },
        {
          id: ids.node,
          kind: 'answer-synthesis',
          goal: 'Synthesize exact evidence.',
          dependencies: [ids.dataset],
          inputRefs: [{ kind: 'node-output', nodeId: ids.dataset }],
          evidenceRefs: [],
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
        ],
      },
      budget: {
        ...plan.budget,
        maximumSteps: 3,
        maximumToolCalls: 2,
      },
    }
    let retrievalAttempts = 0
    let datasetCalls = 0
    let checkpoints = 0
    let artifactIndex = 0
    const storage: ArtifactStoreShape = {
      writeObject: (value, options) => {
        artifactIndex += 1
        return Effect.succeed({
          ref: `artifact://sha256/${String(artifactIndex).padStart(64, '0')}`,
          hash: `sha256:${String(artifactIndex).padStart(64, '0')}`,
          byteLength: value.byteLength,
          mediaType: options.mediaType,
        })
      },
      readObject: () => Effect.dieMessage('unused'),
      stageObject: () => Effect.dieMessage('unused'),
      readStagedObject: () => Effect.dieMessage('unused'),
    }
    const workflow = makeProductionResearchWorkflow({
      storage,
      runtime: Runtime.defaultRuntime,
      fredConfig: {
        providerPackage: 'unused',
        model: 'unused',
        maxElapsedMs: 10_000,
      },
      retrieve: () => {
        retrievalAttempts += 1
        return retrievalAttempts === 1
          ? Effect.fail(new Error('transient'))
          : Effect.succeed([{
              sourceVersionId: ids.source,
              locator: 'lines:1-1',
              excerpt: 'The value is 42.',
              rank: 1,
            }])
      },
      queryDataset: () => Effect.sync(() => {
        datasetCalls += 1
        return datasetOutput
      }),
      loadDurableState: () => Effect.succeed(Option.some({
        plan: Option.some(mixedPlan),
        checkpoint: Option.none(),
        cancellationStatus: 'none',
        terminalStatus: Option.none(),
      })),
      runSynthesis: (input) => Effect.succeed({
        answer: 'The value is 42.',
        citations: [{
          sourceVersionId: ids.source,
          locator: 'lines:1-1',
        }],
        datasetCitations: input.datasetResults.flatMap(
          (result) => result.citations,
        ),
      }),
      runGraph: (
        graphPlan,
        initial,
        modelRouting,
        _policy,
        graphDependencies,
        _config,
        signal,
      ) => Effect.gen(function* () {
        for (const node of graphPlan.nodes) {
          if (node.kind === 'document-retrieval') {
            const executor = yield* graphDependencies.tools.resolve(
              'hybrid-retrieval',
              'document:retrieve',
            )
            yield* executor.execute(node, signal)
          } else if (node.kind === 'dataset-query') {
            const executor = yield* graphDependencies.tools.resolve(
              'dataset-query',
              'dataset:query',
            )
            yield* executor.execute(node, signal)
          } else if (node.kind === 'answer-synthesis') {
            const executor = yield* graphDependencies.models.resolve({
              role: 'synthesis',
              ...modelRouting.synthesis,
            })
            yield* executor.execute(node, signal)
          }
        }
        const completed = {
          ...initial,
          status: 'completed' as const,
          completedNodeIds: graphPlan.nodes.map((node) => node.id),
          steps: 3,
          toolCalls: 2,
          modelCalls: 1,
        }
        yield* graphDependencies.onStateCommitted?.(completed)
          ?? Effect.void
        return completed
      }).pipe(Effect.mapError(() =>
        new ResearchWorkflowError({
          stage: 'test-graph',
          message: 'test graph failed',
        }))),
    })

    const result = await Effect.runPromise(workflow.run({
      run,
      workspaceId: ids.workspace,
      projectId: ids.project,
      sourceVersionIds: [ids.source],
      plan: mixedPlan,
      resumeCheckpoint: Option.none(),
      onCheckpoint: () => Effect.sync(() => {
        checkpoints += 1
      }),
      onRetrievalCompleted: () => Effect.void,
    }))

    expect(retrievalAttempts).toBe(2)
    expect(datasetCalls).toBe(1)
    expect(checkpoints).toBe(1)
    expect(result.answer.datasetCitations).toEqual(datasetOutput.citations)
  })
})
