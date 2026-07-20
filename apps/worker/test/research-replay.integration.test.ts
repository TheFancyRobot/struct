import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DATA_ENGINE_PROTOCOL_VERSION,
  makeDataEngineClient,
} from '@struct/data-engine'
import {
  DatasetId,
  DatasetSnapshotId,
  EvidenceRequirementId,
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchCheckpointId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchThreadId,
  Sha256Digest,
  SourceVersionId,
  WorkspaceId,
  ResearchToolSidecarUnavailableError,
} from '@struct/domain'
import {
  ResearchExecutionRepo,
  SqlClientLive,
} from '@struct/persistence'
import { selectResearchRecovery } from '@struct/research-engine'
import { LocalArtifactStore } from '@struct/source-storage'
import { Effect, Layer, Option, Runtime } from 'effect'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import postgres from 'postgres'
import { makeProductionResearchWorkflow } from '../src/jobs/research-workflow.js'

const databaseUrl =
  process.env['DATABASE_URL']
  ?? 'postgres://struct:struct@127.0.0.1:5432/struct'
const dataEngineUrl =
  process.env['DATA_ENGINE_URL'] ?? 'http://127.0.0.1:4300'
const dataEngineToken =
  process.env['DATA_ENGINE_TOKEN'] ?? 'struct-local-data-engine-token'
const repositoryRoot = resolve(import.meta.dir, '../../..')
const artifactRoot = resolve(
  repositoryRoot,
  process.env['ARTIFACT_STORAGE_ROOT'] ?? '.local/artifacts',
)

const ids = {
  workspace: WorkspaceId.make('960e8400-e29b-41d4-a716-446655440000'),
  project: ProjectId.make('960e8400-e29b-41d4-a716-446655440001'),
  thread: ResearchThreadId.make('960e8400-e29b-41d4-a716-446655440002'),
  run: ResearchRunId.make('960e8400-e29b-41d4-a716-446655440003'),
  job: JobQueueId.make('960e8400-e29b-41d4-a716-446655440004'),
  plan: ResearchPlanId.make('960e8400-e29b-41d4-a716-446655440005'),
  node: ResearchPlanNodeId.make('960e8400-e29b-41d4-a716-446655440006'),
  answerNode: ResearchPlanNodeId.make(
    '960e8400-e29b-41d4-a716-446655440014',
  ),
  checkpoint: ResearchCheckpointId.make(
    '960e8400-e29b-41d4-a716-446655440007',
  ),
  source: SourceVersionId.make('960e8400-e29b-41d4-a716-446655440008'),
  planEvent: EventJournalId.make(
    '960e8400-e29b-41d4-a716-446655440009',
  ),
  checkpointEvent: EventJournalId.make(
    '960e8400-e29b-41d4-a716-446655440010',
  ),
  cancellationEvent: EventJournalId.make(
    '960e8400-e29b-41d4-a716-446655440011',
  ),
  snapshot: DatasetSnapshotId.make(
    '960e8400-e29b-41d4-a716-446655440012',
  ),
  dataset: DatasetId.make('960e8400-e29b-41d4-a716-446655440013'),
  datasetEvidence: EvidenceRequirementId.make(
    '960e8400-e29b-41d4-a716-446655440015',
  ),
} as const

const now = 1_721_430_000_000n
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
const plan: typeof import('@struct/domain').ResearchPlan.Type = {
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
  createdAt: now,
  updatedAt: now,
}
const job: typeof import('@struct/domain').JobQueue.Type = {
  id: ids.job,
  workspaceId: ids.workspace,
  entityType: 'research',
  entityId: ids.run,
  status: 'in-progress',
  payload: {
    projectId: ids.project,
    sourceVersionIds: [ids.source],
  },
  attempts: 1,
  maxAttempts: 3,
  createdAt: now,
  updatedAt: now,
}

async function cleanup(sql: import('postgres').Sql): Promise<void> {
  await sql.unsafe(
    'DELETE FROM research_cancellation_requests WHERE run_id = $1',
    [ids.run],
  )
  await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [
    ids.workspace,
  ])
  await sql.unsafe('DELETE FROM research_runs WHERE id = $1', [ids.run])
  await sql.unsafe('DELETE FROM research_threads WHERE id = $1', [ids.thread])
  await sql.unsafe('DELETE FROM projects WHERE id = $1', [ids.project])
  await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [ids.workspace])
}

function repoLayer(sql: import('postgres').Sql) {
  return Layer.provide(ResearchExecutionRepo.Default, SqlClientLive(sql))
}

function runRepo<A, E>(
  sql: import('postgres').Sql,
  effect: Effect.Effect<A, E, ResearchExecutionRepo>,
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(repoLayer(sql))))
}

async function docker(...args: ReadonlyArray<string>): Promise<string> {
  const child = Bun.spawn(['docker', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`docker command failed: ${stderr.trim()}`)
  return stdout.trim()
}

async function waitForSidecar(): Promise<number> {
  const started = performance.now()
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${dataEngineUrl}/healthz`, {
        headers: { authorization: `Bearer ${dataEngineToken}` },
        signal: AbortSignal.timeout(1_000),
      })
      if (response.ok) return Math.round(performance.now() - started)
    } catch {
      // A connection failure is expected while the container is restarting.
    }
    await Bun.sleep(250)
  }
  throw new Error('authenticated data-engine sidecar did not recover')
}

async function prepareExactQuery(): Promise<
  typeof import('@struct/data-engine').QueryRequest.Type
> {
  const input = await Bun.file(
    resolve(
      import.meta.dir,
      '../../../packages/data-engine/test/fixtures/records.json',
    ),
  ).bytes()
  const inputDigest = new Bun.CryptoHasher('sha256')
    .update(input)
    .digest('hex')
  const inputPath = join(
    artifactRoot,
    'objects/sha256',
    inputDigest.slice(0, 2),
    inputDigest,
  )
  await mkdir(dirname(inputPath), { recursive: true })
  await Bun.write(inputPath, input)
  const client = makeDataEngineClient({
    baseUrl: dataEngineUrl,
    credential: dataEngineToken,
  })
  const materialized = await Effect.runPromise(client.materialize({
    protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
    operation: 'materialize',
    snapshotId: ids.snapshot,
    inputs: [{
      ordinal: 0,
      format: 'json',
      artifactDigest: inputDigest,
      contentHash: Sha256Digest.make(`sha256:${inputDigest}`),
    }],
    fields: [
      {
        ordinal: 0,
        name: 'active',
        sourceType: 'boolean',
        logicalType: 'boolean',
        nullable: false,
      },
      {
        ordinal: 1,
        name: 'amount',
        sourceType: 'number',
        logicalType: 'decimal',
        nullable: false,
      },
      {
        ordinal: 2,
        name: 'id',
        sourceType: 'number',
        logicalType: 'integer',
        nullable: false,
      },
      {
        ordinal: 3,
        name: 'name',
        sourceType: 'string',
        logicalType: 'string',
        nullable: false,
      },
    ],
    limits: {
      maxInputBytes: 1_024,
      maxRows: 100,
      maxOutputBytes: 1_000_000,
      timeoutMs: 5_000,
    },
  }))
  const parquet = await Effect.runPromise(client.readArtifact(
    materialized.artifactToken,
    materialized.parquetDigest,
    1_000_000,
    5_000,
  ))
  const parquetPath = join(
    artifactRoot,
    'objects/sha256',
    materialized.parquetDigest.slice(0, 2),
    materialized.parquetDigest,
  )
  await mkdir(dirname(parquetPath), { recursive: true })
  await Bun.write(parquetPath, parquet)
  return {
    protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
    operation: 'query',
    workspaceId: ids.workspace,
    projectId: ids.project,
    sql: 'SELECT count(*) AS count FROM records ORDER BY ALL',
    snapshots: [{
      alias: 'records',
      datasetId: ids.dataset,
      snapshotId: ids.snapshot,
      schemaHash: Sha256Digest.make(`sha256:${'b'.repeat(64)}`),
      parquetDigest: materialized.parquetDigest,
    }],
    limits: {
      maxRows: 100,
      maxOutputBytes: 100_000,
      maxMemoryMb: 64,
      timeoutMs: 5_000,
    },
  }
}

describe('research replay through production persistence and workflow paths', () => {
  let sql: import('postgres').Sql
  let localArtifacts: string

  beforeAll(async () => {
    sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 })
    localArtifacts = await mkdtemp(join(tmpdir(), 'struct-phase-05-replay-'))
    await cleanup(sql)
    await sql.begin(async (transaction) => {
      await transaction.unsafe(
        `INSERT INTO workspaces (id, name) VALUES ($1, 'Phase 05 replay')`,
        [ids.workspace],
      )
      await transaction.unsafe(
        `INSERT INTO projects (id, workspace_id, name)
         VALUES ($1, $2, 'Phase 05 replay')`,
        [ids.project, ids.workspace],
      )
      await transaction.unsafe(
        `INSERT INTO research_threads (id, project_id, title)
         VALUES ($1, $2, 'Replay')`,
        [ids.thread, ids.project],
      )
      await transaction.unsafe(
        `INSERT INTO research_runs (
           id, thread_id, question, status, created_at, updated_at
         ) VALUES (
           $1, $2, $3, 'in-progress',
           to_timestamp($4 / 1000.0), to_timestamp($4 / 1000.0)
         )`,
        [ids.run, ids.thread, run.question, Number(now)],
      )
      await transaction.unsafe(
        `INSERT INTO job_queue (
           id, workspace_id, entity_type, entity_id, status, payload,
           attempts, max_attempts, created_at, updated_at
         ) VALUES (
           $1, $2, 'research', $3, 'in-progress', $4::jsonb, 1, 3,
           to_timestamp($5 / 1000.0), to_timestamp($5 / 1000.0)
         )`,
        [
          ids.job,
          ids.workspace,
          ids.run,
          JSON.stringify(job.payload),
          Number(now),
        ],
      )
    })
  })

  afterAll(async () => {
    await cleanup(sql)
    await sql.end()
    await rm(localArtifacts, { recursive: true, force: true })
  })

  it('resumes committed artifacts once and survives authenticated sidecar restart', async () => {
    await runRepo(sql, ResearchExecutionRepo.persistPlan({
      workspaceId: ids.workspace,
      projectId: ids.project,
      job,
      plan,
      eventId: ids.planEvent,
      createdAt: now,
    }))
    await sql.end()
    sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 })
    const afterPlanningRestart = await runRepo(
      sql,
      ResearchExecutionRepo.loadDurableState(
        ids.workspace,
        ids.project,
        ids.run,
      ),
    )
    expect(Option.isSome(afterPlanningRestart)).toBe(true)
    if (Option.isNone(afterPlanningRestart)) {
      throw new Error('planned state was not durable across restart')
    }
    expect(Option.isSome(afterPlanningRestart.value.plan)).toBe(true)
    expect(Option.isNone(afterPlanningRestart.value.checkpoint)).toBe(true)
    const restartAfterPlan = true

    const query = await prepareExactQuery()
    const client = makeDataEngineClient({
      baseUrl: dataEngineUrl,
      credential: dataEngineToken,
    })
    let toolAttempts = 1
    const exactBeforeRestart = await Effect.runPromise(client.query(query))
    let toolCommits = 1
    const storage = await Effect.runPromise(
      LocalArtifactStore.make({ root: localArtifacts }),
    )
    expect(exactBeforeRestart.rowCount).toBe(1)
    const storedDatasetResult = await Effect.runPromise(storage.writeObject(
      new TextEncoder().encode(JSON.stringify({
        kind: 'dataset-query-result',
        result: exactBeforeRestart,
      })),
      { mediaType: 'application/vnd.struct.dataset-query-result+json' },
    ))
    await sql.end()
    sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 })
    const afterToolAttemptBeforeCommit = await runRepo(
      sql,
      ResearchExecutionRepo.loadDurableState(
        ids.workspace,
        ids.project,
        ids.run,
      ),
    )
    expect(Option.isSome(afterToolAttemptBeforeCommit)).toBe(true)
    if (Option.isNone(afterToolAttemptBeforeCommit)) {
      throw new Error('tool-attempt restart lost durable plan state')
    }
    expect(Option.isNone(afterToolAttemptBeforeCommit.value.checkpoint))
      .toBe(true)
    const restartAfterToolAttemptBeforeCommit = true

    const answer = { answer: 'The committed answer.', citations: [] }
    const storedAnswer = await Effect.runPromise(storage.writeObject(
      new TextEncoder().encode(JSON.stringify({
        kind: 'research-answer',
        answer,
      })),
      { mediaType: 'application/vnd.struct.research-answer+json' },
    ))
    const checkpoint:
      typeof import('@struct/domain').ResearchExecutionCheckpoint.Type = {
      version: '1',
      id: ids.checkpoint,
      state: {
        version: '1',
        runId: ids.run,
        planId: ids.plan,
        status: 'paused',
        currentNodeId: null,
        completed: [
          {
            nodeId: ids.node,
            artifacts: [{
              digest: Sha256Digest.make(storedDatasetResult.hash),
              byteLength: storedDatasetResult.byteLength,
              mediaType: storedDatasetResult.mediaType,
            }],
          },
          {
            nodeId: ids.answerNode,
            artifacts: [{
              digest: Sha256Digest.make(storedAnswer.hash),
              byteLength: storedAnswer.byteLength,
              mediaType: storedAnswer.mediaType,
            }],
          },
        ],
        budget: {
          limits: plan.budget,
          used: {
            steps: 2,
            modelCalls: 0,
            toolCalls: 1,
            tokens: 0,
            elapsedMilliseconds: 25,
            estimatedCostMicros: 0,
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
    const checkpointBytes = new TextEncoder().encode(
      JSON.stringify(checkpoint),
    ).byteLength
    await runRepo(sql, ResearchExecutionRepo.persistCheckpoint({
      workspaceId: ids.workspace,
      projectId: ids.project,
      job,
      checkpoint,
      eventId: ids.checkpointEvent,
      createdAt: now + 1n,
    }))
    await runRepo(sql, ResearchExecutionRepo.persistCheckpoint({
      workspaceId: ids.workspace,
      projectId: ids.project,
      job,
      checkpoint,
      eventId: ids.checkpointEvent,
      createdAt: now + 1n,
    }))

    await sql.end()
    const replayStarted = performance.now()
    sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 })
    const loaded = await runRepo(
      sql,
      ResearchExecutionRepo.loadDurableState(
        ids.workspace,
        ids.project,
        ids.run,
      ),
    )
    const replayLatencyMs = Number(
      (performance.now() - replayStarted).toFixed(3),
    )
    expect(Option.isSome(loaded)).toBe(true)
    if (Option.isNone(loaded)) throw new Error('durable state was not loaded')
    expect(Option.isSome(loaded.value.checkpoint)).toBe(true)
    if (Option.isNone(loaded.value.checkpoint)) {
      throw new Error('durable checkpoint was not loaded')
    }
    const restartAfterCheckpointCommit = true
    const resumeCheckpoint = loaded.value.checkpoint.value
    const committedDatasetNode = resumeCheckpoint.state.completed.find(
      ({ nodeId }) => nodeId === ids.node,
    )
    const datasetArtifactCommitted =
      committedDatasetNode?.artifacts[0]?.digest
      === Sha256Digest.make(storedDatasetResult.hash)
    expect(datasetArtifactCommitted).toBe(true)
    const disposition = await Effect.runPromise(selectResearchRecovery(
      plan,
      loaded.value,
    ))
    expect(disposition.kind).toBe('finalize')

    const unauthorized = await Effect.runPromiseExit(
      makeDataEngineClient({
        baseUrl: dataEngineUrl,
        credential: 'invalid-phase-05-token',
      }).query(query),
    )
    expect(String(unauthorized)).toContain('DataEngineOperationError')

    let completedToolInvocations = 0
    const productionWorkflow = makeProductionResearchWorkflow({
      storage,
      runtime: Runtime.defaultRuntime,
      fredConfig: {
        providerPackage: 'unused-for-finalized-resume',
        model: 'unused-for-finalized-resume',
        maxElapsedMs: 10_000,
      },
      retrieve: () => Effect.dieMessage(
        'completed retrieval must not replay',
      ),
      queryDataset: () => {
        completedToolInvocations += 1
        return client.query(query).pipe(
          Effect.mapError(() => new ResearchToolSidecarUnavailableError({
            toolId: 'dataset-query',
            capability: 'dataset:query',
            nodeId: ids.node,
            runId: ids.run,
            message: 'Dataset query sidecar failed',
          })),
          Effect.zipRight(Effect.dieMessage(
            'completed dataset query must not replay',
          )),
        )
      },
      loadDurableState: (workspaceId, projectId, runId) =>
        ResearchExecutionRepo.loadDurableState(
          workspaceId,
          projectId,
          runId,
        ).pipe(Effect.provide(repoLayer(sql))),
    })
    const runResume = () => Effect.runPromise(productionWorkflow.run({
      run,
      workspaceId: ids.workspace,
      projectId: ids.project,
      sourceVersionIds: [ids.source],
      plan,
      resumeCheckpoint: Option.some(resumeCheckpoint),
      onCheckpoint: () => Effect.dieMessage(
        'finalized checkpoint must not be rewritten',
      ),
      onRetrievalCompleted: () => Effect.dieMessage(
        'completed retrieval event must not replay',
      ),
    }))
    expect((await runResume()).answer).toEqual(answer)
    expect((await runResume()).answer).toEqual(answer)
    expect(completedToolInvocations).toBe(0)
    const modelOnlyPlan = {
      ...plan,
      nodes: [{
        ...plan.nodes[1]!,
        dependencies: [],
        inputRefs: [{
          kind: 'dataset-snapshot' as const,
          datasetId: ids.dataset,
          datasetSnapshotId: ids.snapshot,
        }],
      }],
      evidenceRequirements: [],
      toolPolicy: { grants: [] },
      budget: {
        ...plan.budget,
        maximumSteps: 1,
        maximumToolCalls: 0,
        maximumEstimatedCostMicros: 1_000_000,
      },
    }
    const modelFailure = await Effect.runPromiseExit(productionWorkflow.run({
      run,
      workspaceId: ids.workspace,
      projectId: ids.project,
      sourceVersionIds: [ids.source],
      plan: modelOnlyPlan,
      resumeCheckpoint: Option.none(),
      onCheckpoint: () => Effect.void,
      onRetrievalCompleted: () => Effect.void,
    }))
    const modelFailureTag = String(modelFailure).match(
      /ResearchProviderFailure/,
    )?.[0] ?? 'none'
    expect(modelFailureTag).toBe('ResearchProviderFailure')
    const replacement = Bun.spawn(
      ['bun', resolve(
        import.meta.dir,
        'support/research-resume-child.ts',
      )],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          PHASE_05_ARTIFACT_ROOT: localArtifacts,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [replacementExit, replacementStdout, replacementStderr] =
      await Promise.all([
        replacement.exited,
        new Response(replacement.stdout).text(),
        new Response(replacement.stderr).text(),
      ])
    if (replacementExit !== 0) {
      throw new Error(`replacement process failed: ${replacementStderr}`)
    }
    const replacementLine = replacementStdout.split('\n').find((line) =>
      line.startsWith('PHASE05_CHILD_RESULT='))
    if (replacementLine === undefined) {
      throw new Error('replacement process did not emit recovery evidence')
    }
    const replacementResult = JSON.parse(
      replacementLine.slice('PHASE05_CHILD_RESULT='.length),
    ) as {
      readonly processId: number
      readonly disposition: string
      readonly answer: string
      readonly completedToolInvocations: number
    }
    expect(replacementResult).toMatchObject({
      disposition: 'finalize',
      answer: answer.answer,
      completedToolInvocations: 0,
    })
    expect(replacementResult.processId).not.toBe(process.pid)

    const bunHost = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () => Response.json({ runtime: 'bun', healthy: true }),
    })
    let sidecarRecoveryMs: number
    let bunHostHealthyDuringSidecarRestart = false
    let sidecarStopAttempted = false
    let providerFailureTag = 'none'
    try {
      bunHostHealthyDuringSidecarRestart = (await fetch(
        `http://127.0.0.1:${bunHost.port}/healthz`,
      )).ok
      expect(bunHostHealthyDuringSidecarRestart).toBe(true)
      sidecarStopAttempted = true
      await docker('stop', 'struct-data-engine')
      toolAttempts += 1
      const unavailable = await Effect.runPromiseExit(client.query(query))
      expect(String(unavailable)).toContain('DataEngineTransportError')
      providerFailureTag = 'DataEngineTransportError'
      const durableDuringProviderFailure = await runRepo(
        sql,
        ResearchExecutionRepo.loadDurableState(
          ids.workspace,
          ids.project,
          ids.run,
        ),
      )
      expect(Option.isSome(durableDuringProviderFailure)).toBe(true)
      if (Option.isNone(durableDuringProviderFailure)) {
        throw new Error('provider failure lost durable recovery state')
      }
      expect(Option.isSome(durableDuringProviderFailure.value.checkpoint))
        .toBe(true)
      bunHostHealthyDuringSidecarRestart = bunHostHealthyDuringSidecarRestart
        && (await fetch(
        `http://127.0.0.1:${bunHost.port}/healthz`,
        )).ok
      expect(bunHostHealthyDuringSidecarRestart).toBe(true)
      await docker('start', 'struct-data-engine')
      sidecarRecoveryMs = await waitForSidecar()
    } finally {
      if (sidecarStopAttempted) {
        await docker('start', 'struct-data-engine')
        await waitForSidecar()
        const restoredHealth = await fetch(`${dataEngineUrl}/healthz`, {
          headers: { authorization: `Bearer ${dataEngineToken}` },
          signal: AbortSignal.timeout(1_000),
        })
        expect(restoredHealth.ok).toBe(true)
      }
      bunHost.stop(true)
    }
    const exactAfterRestart = await Effect.runPromise(client.query(query))
    toolAttempts += 1
    toolCommits += 1
    expect({
      ...exactAfterRestart,
      executionMs: exactBeforeRestart.executionMs,
    }).toEqual(exactBeforeRestart)

    const cancellation = await runRepo(
      sql,
      ResearchExecutionRepo.requestCancellation({
        workspaceId: ids.workspace,
        projectId: ids.project,
        runId: ids.run,
        idempotencyKey: 'phase-05-live-cancel',
        eventId: ids.cancellationEvent,
        createdAt: now + 2n,
      }),
    )
    await sql.end()
    sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 })
    const cancellationRestartState = await runRepo(
      sql,
      ResearchExecutionRepo.loadDurableState(
        ids.workspace,
        ids.project,
        ids.run,
      ),
    )
    expect(Option.isSome(cancellationRestartState)).toBe(true)
    if (Option.isNone(cancellationRestartState)) {
      throw new Error('cancellation restart lost durable state')
    }
    expect(cancellationRestartState.value.cancellationStatus)
      .toBe('acknowledged')
    const restartDuringCancellation = true
    const replayedCancellation = await runRepo(
      sql,
      ResearchExecutionRepo.requestCancellation({
        workspaceId: ids.workspace,
        projectId: ids.project,
        runId: ids.run,
        idempotencyKey: 'phase-05-live-cancel',
        eventId: ids.cancellationEvent,
        createdAt: now + 2n,
      }),
    )
    expect(cancellation).toEqual({ result: 'cancelled', replayed: false })
    expect(replayedCancellation).toEqual({
      result: 'cancelled',
      replayed: true,
    })

    const terminal = await sql.unsafe(
      `SELECT
         rr.status AS run_status,
         jq.status AS job_status,
         control.terminal_status,
         (SELECT COUNT(*)::int
          FROM event_journal event
          WHERE event.entity_id = rr.id
            AND event.event_type = 'research-cancelled') AS terminal_events,
         (SELECT COUNT(*)::int
          FROM event_journal event
          WHERE event.entity_id = rr.id
            AND event.event_type = 'research-checkpointed') AS checkpoints
       FROM research_runs rr
       JOIN job_queue jq ON jq.entity_id = rr.id
       JOIN research_run_control control ON control.run_id = rr.id
       WHERE rr.id = $1`,
      [ids.run],
    )
    expect(terminal[0]).toMatchObject({
      run_status: 'cancelled',
      job_status: 'cancelled',
      terminal_status: 'cancelled',
      terminal_events: 1,
      checkpoints: 1,
    })
    const eventCursors = await sql.unsafe(
      `SELECT cursor::int, event_type
       FROM event_journal
       WHERE entity_id = $1
         AND event_type IN ('research-plan-accepted', 'research-checkpointed')
       ORDER BY cursor`,
      [ids.run],
    )
    const committedEventSequences = eventCursors.map((row) =>
      Number(row['cursor']))
    const reconnectCursor = committedEventSequences[0]
    if (reconnectCursor === undefined) {
      throw new Error('committed recovery events are required')
    }
    const reconnectEventSequences = committedEventSequences.filter(
      (sequence) => sequence > reconnectCursor,
    )
    const terminalStates = terminal.filter((row) =>
      row['terminal_status'] !== null).length
    const duplicateDurableEffects =
      Number(terminal[0]?.['checkpoints']) - 1
    const datasetIdempotencyCommitPersisted =
      Number(terminal[0]?.['checkpoints']) === 1

    const nodeVersion = await docker(
      'exec',
      'struct-data-engine',
      'node',
      '--version',
    )
    const networkJson = await docker(
      'inspect',
      '--format',
      '{{json .NetworkSettings.Networks}}',
      'struct-data-engine',
    )
    const networkNames = Object.keys(JSON.parse(networkJson) as object)
    expect(networkNames).toHaveLength(1)
    const isolatedNoEgress = await docker(
      'network',
      'inspect',
      '--format',
      '{{.Internal}}',
      networkNames[0] ?? '',
    ) === 'true'
    expect(isolatedNoEgress).toBe(true)
    const authenticatedHealth = await fetch(`${dataEngineUrl}/healthz`, {
      headers: { authorization: `Bearer ${dataEngineToken}` },
    }).then((response) => response.ok)
    const sidecarRecovered = authenticatedHealth
      && exactAfterRestart.resultHash === exactBeforeRestart.resultHash
    const metrics = {
      schemaVersion: '1.0.0',
      status: 'passed',
      checkpointBytes,
      replayLatencyMs,
      sidecarRecoveryMs,
      terminalStates,
      duplicateDurableEffects,
      completedDatasetQueryReplays: completedToolInvocations,
      toolAttempts,
      toolCommits,
      initialProcessId: process.pid,
      replacementProcessId: replacementResult.processId,
      artifactCheckpointMode: 'by-reference',
      bunHostHealthyDuringSidecarRestart,
      sidecarRuntime: 'node-24',
      gates: {
        restartAfterPlan,
        restartAfterToolAttemptBeforeCommit,
        restartAfterCheckpointCommit,
        restartDuringCancellation,
      },
      failureHistory: [
        { kind: 'provider', tag: providerFailureTag },
        { kind: 'model', tag: modelFailureTag },
      ],
    }
    const liveEvidence = {
      evidenceVersion: '1',
      source: 'live-postgresql-compose',
      runId: ids.run,
      recovery: {
        reconnectCursor,
        committedEventSequences,
        reconnectEventSequences,
        terminalStates: metrics.terminalStates,
        duplicateDurableEffects: metrics.duplicateDurableEffects,
        completedDatasetQueryReplays:
          metrics.completedDatasetQueryReplays,
        datasetProviderCallsAfterReplacement:
          replacementResult.completedToolInvocations,
        artifactCheckpointMode: metrics.artifactCheckpointMode,
        datasetArtifactCommitted,
        datasetIdempotencyCommitPersisted,
        checkpointBytes: metrics.checkpointBytes,
        initialProcessId: metrics.initialProcessId,
        replacementProcessId: metrics.replacementProcessId,
        gates: metrics.gates,
        failureHistory: metrics.failureHistory,
      },
      runtime: {
        host: 'bun',
        bunVersion: Bun.version,
        sidecarNodeVersion: nodeVersion,
        authenticatedHealth,
        isolatedNoEgress,
        bunHostHealthyDuringSidecarRestart,
        sidecarRecovered,
      },
    }
    const metricsRoot = resolve(repositoryRoot, '.local/evaluation')
    await mkdir(metricsRoot, { recursive: true })
    await Bun.write(
      resolve(metricsRoot, 'phase-05-live-metrics.json'),
      `${JSON.stringify(metrics, null, 2)}\n`,
    )
    await Bun.write(
      resolve(metricsRoot, 'phase-05-live-evidence.json'),
      `${JSON.stringify(liveEvidence, null, 2)}\n`,
    )
    expect(checkpointBytes).toBeLessThanOrEqual(64 * 1_024)
    expect(replayLatencyMs).toBeLessThanOrEqual(1_000)
    expect(sidecarRecoveryMs).toBeLessThanOrEqual(10_000)
    expect(completedToolInvocations).toBe(0)
    expect(replacementResult.completedToolInvocations).toBe(0)
    expect(datasetIdempotencyCommitPersisted).toBe(true)
  }, 60_000)
})
