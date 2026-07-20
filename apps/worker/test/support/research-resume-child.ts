/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import {
  makeDataEngineClient,
  QueryRequest,
} from '@struct/data-engine'
import {
  DatasetId,
  DatasetSnapshotId,
  EvidenceRequirementId,
  ProjectId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  WorkspaceId,
  type ResearchPlan as typeResearchPlan,
} from '@struct/domain'
import {
  ResearchExecutionRepo,
  SqlClientLive,
} from '@struct/persistence'
import { selectResearchRecovery } from '@struct/research-engine'
import { LocalArtifactStore } from '@struct/source-storage'
import { Effect, Layer, Option, Runtime, Schema } from 'effect'
import postgres from 'postgres'
import { makeProductionResearchWorkflow } from '../../src/jobs/research-workflow.js'
/* eslint-enable no-unused-vars */

const ids = {
  workspace: WorkspaceId.make('960e8400-e29b-41d4-a716-446655440000'),
  project: ProjectId.make('960e8400-e29b-41d4-a716-446655440001'),
  thread: ResearchThreadId.make('960e8400-e29b-41d4-a716-446655440002'),
  run: ResearchRunId.make('960e8400-e29b-41d4-a716-446655440003'),
  plan: ResearchPlanId.make('960e8400-e29b-41d4-a716-446655440005'),
  node: ResearchPlanNodeId.make('960e8400-e29b-41d4-a716-446655440006'),
  answerNode: ResearchPlanNodeId.make(
    '960e8400-e29b-41d4-a716-446655440014',
  ),
  source: SourceVersionId.make('960e8400-e29b-41d4-a716-446655440008'),
  snapshot: DatasetSnapshotId.make(
    '960e8400-e29b-41d4-a716-446655440012',
  ),
  dataset: DatasetId.make('960e8400-e29b-41d4-a716-446655440013'),
  datasetEvidence: EvidenceRequirementId.make(
    '960e8400-e29b-41d4-a716-446655440015',
  ),
} as const
const budget = {
  maximumSteps: 2,
  maximumModelCalls: 1,
  maximumToolCalls: 1,
  maximumTokens: 1,
  maximumElapsedMilliseconds: 120_000,
  maximumEstimatedCostMicros: 0,
  maximumFanOut: 1,
  maximumRevisions: 0,
}
const plan: typeResearchPlan = {
  version: '1',
  id: ids.plan,
  runId: ids.run,
  workspaceId: ids.workspace,
  projectId: ids.project,
  objective: 'Resume the committed answer without replaying completed work.',
  sourceScopes: [{
    kind: 'dataset',
    datasetId: ids.dataset,
    datasetSnapshotId: ids.snapshot,
    sourceVersionIds: [ids.source],
  }],
  nodes: [
    {
      id: ids.node,
      kind: 'dataset-query',
      goal: 'Compute the exact committed row count.',
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
      id: ids.answerNode,
      kind: 'answer-synthesis',
      goal: 'Return the committed exact result.',
      dependencies: [ids.node],
      inputRefs: [{ kind: 'node-output', nodeId: ids.node }],
      evidenceRefs: [ids.datasetEvidence],
    },
  ],
  evidenceRequirements: [{
    id: ids.datasetEvidence,
    kind: 'dataset',
    datasetId: ids.dataset,
    datasetSnapshotId: ids.snapshot,
    minimumCitations: 1,
  }],
  toolPolicy: {
    grants: [{
      toolId: 'dataset-query',
      capability: 'dataset:query',
      maximumCalls: 1,
    }],
  },
  budget,
}
const run: typeof import('@struct/domain').ResearchRun.Type = {
  id: ids.run,
  threadId: ids.thread,
  question: 'What was committed?',
  status: 'in-progress',
  createdAt: 1_721_430_000_000n,
  updatedAt: 1_721_430_000_000n,
}
const databaseUrl = process.env['DATABASE_URL']
if (databaseUrl === undefined) throw new Error('DATABASE_URL is required')
const artifactRoot = process.env['PHASE_05_ARTIFACT_ROOT']
if (artifactRoot === undefined) throw new Error('PHASE_05_ARTIFACT_ROOT is required')
const childMode = process.env['PHASE_05_CHILD_MODE'] ?? 'finalized-resume'
const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5 })
const layer = Layer.provide(ResearchExecutionRepo.Default, SqlClientLive(sql))
const loaded = await Effect.runPromise(
  ResearchExecutionRepo.loadDurableState(
    ids.workspace,
    ids.project,
    ids.run,
  ).pipe(Effect.provide(layer)),
)
if (Option.isNone(loaded)) {
  throw new Error('replacement process could not load durable state')
}
const durableState = loaded.value
const disposition = await Effect.runPromise(
  selectResearchRecovery(plan, durableState),
)
const storage = await Effect.runPromise(
  LocalArtifactStore.make({ root: artifactRoot }),
)
if (childMode === 'uncommitted-dataset-query') {
  if (Option.isSome(durableState.checkpoint)) {
    throw new Error('replacement process requires planned state without a checkpoint')
  }
  const queryRequestPath = process.env['PHASE_05_QUERY_REQUEST']
  if (queryRequestPath === undefined) {
    throw new Error('PHASE_05_QUERY_REQUEST is required')
  }
  const query = Schema.decodeUnknownSync(QueryRequest)(
    JSON.parse(await Bun.file(queryRequestPath).text()),
  )
  let datasetProviderCalls = 0
  datasetProviderCalls += 1
  const result = await Effect.runPromise(makeDataEngineClient({
    baseUrl: process.env['DATA_ENGINE_URL'] ?? 'http://127.0.0.1:4300',
    credential:
      process.env['DATA_ENGINE_TOKEN'] ?? 'struct-local-data-engine-token',
  }).query(query))
  const artifact = await Effect.runPromise(storage.writeObject(
    new TextEncoder().encode(JSON.stringify({
      kind: 'dataset-query-result',
      result,
    })),
    { mediaType: 'application/vnd.struct.dataset-query-result+json' },
  ))
  await sql.end()
  await Bun.write(Bun.stdout, `PHASE05_CHILD_RESULT=${JSON.stringify({
    processId: process.pid,
    disposition: disposition.kind,
    checkpointPresent: false,
    datasetProviderCalls,
    rowCount: result.rowCount,
    resultHash: result.resultHash,
    artifact: {
      hash: artifact.hash,
      byteLength: artifact.byteLength,
      mediaType: artifact.mediaType,
    },
  })}\n`)
} else {
  if (Option.isNone(durableState.checkpoint)) {
    throw new Error('replacement process could not load committed checkpoint')
  }
  let completedToolInvocations = 0
  const workflow = makeProductionResearchWorkflow({
    storage,
    runtime: Runtime.defaultRuntime,
    fredConfig: {
      providerPackage: 'unused-for-finalized-resume',
      model: 'unused-for-finalized-resume',
      maxElapsedMs: 10_000,
    },
    retrieve: () => Effect.dieMessage('completed retrieval must not replay'),
    queryDataset: () => {
      completedToolInvocations += 1
      return Effect.dieMessage('completed dataset query must not replay')
    },
    loadDurableState: (workspaceId, projectId, runId) =>
      ResearchExecutionRepo.loadDurableState(
        workspaceId,
        projectId,
        runId,
      ).pipe(Effect.provide(layer)),
  })
  const result = await Effect.runPromise(workflow.run({
    run,
    workspaceId: ids.workspace,
    projectId: ids.project,
    sourceVersionIds: [ids.source],
    plan,
    resumeCheckpoint: Option.some(durableState.checkpoint.value),
    onCheckpoint: () => Effect.dieMessage(
      'finalized checkpoint must not be rewritten',
    ),
    onRetrievalCompleted: () => Effect.dieMessage(
      'completed retrieval event must not replay',
    ),
  }))
  await sql.end()
  await Bun.write(Bun.stdout, `PHASE05_CHILD_RESULT=${JSON.stringify({
    processId: process.pid,
    disposition: disposition.kind,
    answer: result.answer.answer,
    completedToolInvocations,
  })}\n`)
}
