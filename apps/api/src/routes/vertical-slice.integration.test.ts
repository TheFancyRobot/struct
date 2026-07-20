/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { afterAll, describe, expect, it } from 'bun:test'
import { Effect, Layer, Schema } from 'effect'
import type {
  FredClient,
  WorkflowIR,
} from '@fancyrobot/fred'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  CitationId,
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { ingestTextSource } from '@struct/ingestion'
import {
  AnswerSynthesizerInput,
  runFredWalkingSkeleton,
} from '@struct/workflows'
import {
  JobQueueRepo,
  ProjectRepo,
  ResearchExecutionRepo,
  ResearchProjectionRepo,
  ResearchRunRepo,
  SourceRegistrationRepo,
  SourceVersionRepo,
  SqlClientLive,
  WorkspaceRepo,
} from '@struct/persistence'
import { validateAnswerCitations } from '@struct/research-engine'
import { TextRetrieval } from '@struct/retrieval'
import {
  LocalArtifactStore,
  type ArtifactRef,
} from '@struct/source-storage'
import { processOneIngestionJob } from '../../../worker/src/jobs/ingest-source'
import { processOneResearchJob } from '../../../worker/src/jobs/run-research'
import { getCitationDetail } from './citations'
import { researchEventsResponse } from './research-events'
import { startResearch } from './research'
import { registerTextSource } from './sources'

// eslint-disable-next-line no-restricted-syntax -- PostgreSQL integration tests use the standard test URL boundary.
const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('210e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('210e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('210e8400-e29b-41d4-a716-446655440002')
const sourceVersionId =
  SourceVersionId.make('210e8400-e29b-41d4-a716-446655440003')
const ingestionJobId =
  JobQueueId.make('210e8400-e29b-41d4-a716-446655440004')
const threadId =
  ResearchThreadId.make('210e8400-e29b-41d4-a716-446655440005')
const runId = ResearchRunId.make('210e8400-e29b-41d4-a716-446655440006')
const researchJobId =
  JobQueueId.make('210e8400-e29b-41d4-a716-446655440007')
const citationId = CitationId.make('210e8400-e29b-41d4-a716-446655440008')

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe('DELETE FROM event_journal WHERE workspace_id = $1', [
    workspaceId,
  ])
  await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [
    workspaceId,
  ])
  await sql.unsafe('DELETE FROM research_threads WHERE project_id = $1', [
    projectId,
  ])
  await sql.unsafe(
    'DELETE FROM source_versions WHERE source_id IN (SELECT id FROM sources WHERE project_id = $1)',
    [projectId],
  )
  await sql.unsafe('DELETE FROM sources WHERE project_id = $1', [projectId])
  await sql.unsafe('DELETE FROM projects WHERE id = $1', [projectId])
  await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
}

function serviceLayer<Service>(
  service: Layer.Layer<Service, never, import('@struct/persistence').SqlClient>,
  sql: postgresTypes.Sql,
): Layer.Layer<Service> {
  return Layer.provide(service, SqlClientLive(sql))
}

function isArtifactRef(value: string): value is ArtifactRef {
  return /^artifact:\/\/sha256\/[a-f0-9]{64}$/.test(value)
}

describeIf('walking skeleton full vertical slice', () => {
  let sql: postgresTypes.Sql | undefined
  let artifactRoot: string | undefined

  afterAll(async () => {
    if (sql !== undefined) {
      await cleanup(sql)
      await sql.end()
    }
    if (artifactRoot !== undefined) {
      await rm(artifactRoot, { recursive: true, force: true })
    }
  })

  it('persists registration through replay and survives a database reconnect', async () => {
    if (DATABASE_URL === undefined) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    artifactRoot = await mkdtemp(join(tmpdir(), 'struct-full-slice-'))
    await cleanup(sql)

    const now = 1_721_260_800_000n
    const workspaceLayer = serviceLayer(WorkspaceRepo.Default, sql)
    const projectLayer = serviceLayer(ProjectRepo.Default, sql)
    await Effect.runPromise(
      WorkspaceRepo.create({
        id: workspaceId,
        name: 'Full Slice Workspace',
        createdAt: now,
        updatedAt: now,
      }).pipe(Effect.provide(workspaceLayer)),
    )
    await Effect.runPromise(
      ProjectRepo.create({
        id: projectId,
        workspaceId,
        name: 'Full Slice Project',
        createdAt: now,
        updatedAt: now,
      }).pipe(Effect.provide(projectLayer)),
    )

    const storage = await Effect.runPromise(
      LocalArtifactStore.make({ root: artifactRoot }),
    )
    const registrationLayer =
      serviceLayer(SourceRegistrationRepo.Default, sql)
    await Effect.runPromise(
      registerTextSource({
        workspaceId,
        projectId,
        name: 'launch.md',
        mediaType: 'text/markdown',
        bytes: new TextEncoder().encode(
          '# Launch plan\r\nThe production launch date is July 18.\r\n',
        ),
      }, {
        now: () => now,
        randomUuid: () => sourceId,
        randomJobQueueId: () => ingestionJobId,
        randomEventJournalId: () =>
          EventJournalId.make('210e8400-e29b-41d4-a716-446655440010'),
        maxBytes: 1024,
        projects: {
          findById: (id) =>
            ProjectRepo.findById(id).pipe(Effect.provide(projectLayer)),
        },
        registration: {
          create: (input) =>
            SourceRegistrationRepo.create(input).pipe(
              Effect.provide(registrationLayer),
            ),
        },
        storage,
      }),
    )

    const jobLayer = serviceLayer(JobQueueRepo.Default, sql)
    const versionLayer = serviceLayer(SourceVersionRepo.Default, sql)
    const retrievalLayer = serviceLayer(TextRetrieval.Default, sql)
    await Effect.runPromise(
      processOneIngestionJob({
        now: () => now + 1n,
        randomSourceVersionId: () => sourceVersionId,
        staleAfterMs: 300_000,
        heartbeatIntervalMs: 10_000,
        jobs: {
          recoverStaleIngestionJobs: (staleAfterMs) =>
            JobQueueRepo.recoverStaleIngestionJobs(staleAfterMs).pipe(
              Effect.provide(jobLayer),
            ),
          claimNextIngestionJob: () =>
            JobQueueRepo.claimNextIngestionJob().pipe(Effect.provide(jobLayer)),
          renewLease: (job) =>
            JobQueueRepo.renewLease(job).pipe(Effect.provide(jobLayer)),
          appendInProgressEvent: (job, event) =>
            JobQueueRepo.appendInProgressEvent(job, event).pipe(
              Effect.provide(jobLayer),
            ),
          markCompleted: (job, event) =>
            JobQueueRepo.markCompleted(job, event).pipe(Effect.provide(jobLayer)),
          markPending: (job, event) =>
            JobQueueRepo.markPending(job, event).pipe(Effect.provide(jobLayer)),
          markFailed: (job, event) =>
            JobQueueRepo.markFailed(job, event).pipe(Effect.provide(jobLayer)),
        },
        sourceVersions: {
          findBySourceId: (id) =>
            SourceVersionRepo.findBySourceId(id).pipe(
              Effect.provide(versionLayer),
            ),
          createForIngestionAttempt: (job, version) =>
            SourceVersionRepo.createForIngestionAttempt(job, version).pipe(
              Effect.provide(versionLayer),
            ),
        },
        sources: {
          findProjectId: () => Effect.succeed(projectId),
        },
        textIndex: {
          indexText: (input) =>
            TextRetrieval.indexText(input).pipe(Effect.provide(retrievalLayer)),
        },
        ingestion: {
          ingestTextSource: (input) =>
            ingestTextSource({ store: storage, ...input, maxBytes: 1024 }),
        },
      }),
    )

    const [version] = await Effect.runPromise(
      SourceVersionRepo.findBySourceId(sourceId).pipe(
        Effect.provide(versionLayer),
      ),
    )
    if (version === undefined) {
      throw new Error('Ingestion did not persist a source version')
    }
    expect(version).toMatchObject({
      id: sourceVersionId,
      sourceId,
      version: 1,
    })
    const [indexed] = await sql.unsafe(
      'SELECT content FROM source_text_index WHERE source_version_id = $1',
      [sourceVersionId],
    )
    expect(indexed?.['content']).toBe(
      '# Launch plan\nThe production launch date is July 18.\n',
    )
    if (!isArtifactRef(version.artifactRef)) {
      throw new Error('Ingestion did not persist a canonical artifact reference')
    }
    const manifest = JSON.parse(new TextDecoder().decode(
      (await Effect.runPromise(storage.readObject(version.artifactRef))).bytes,
    ))
    expect(manifest.normalizedRef).toMatch(/^artifact:\/\/sha256\//)

    const executionLayer = serviceLayer(ResearchExecutionRepo.Default, sql)
    const registration = await Effect.runPromise(
      startResearch({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        question: 'What is the production launch date?',
      }, {
        now: () => now + 2n,
        randomThreadId: () => threadId,
        randomRunId: () => runId,
        randomJobId: () => researchJobId,
        randomEventId: () =>
          EventJournalId.make('210e8400-e29b-41d4-a716-446655440011'),
        register: (input) =>
          ResearchExecutionRepo.register(input).pipe(
            Effect.provide(executionLayer),
          ),
      }),
    )
    expect(registration.run.id).toBe(runId)

    const runLayer = serviceLayer(ResearchRunRepo.Default, sql)
    let researchEventSequence = 12
    const fredCalls: string[] = []
    const fredClient = {
      providers: {
        use: async () => {
          fredCalls.push('provider')
          return {
            id: 'mock-model-provider',
            aliases: [],
            config: {},
            layer: Layer.empty,
            getModel: () =>
              Effect.fail(new Error('The deterministic Fred factory runs synthesis')),
          }
        },
      },
      tools: {
        register: async () => {
          fredCalls.push('tool')
        },
      },
      agents: {
        register: async () => {
          fredCalls.push('agent')
        },
      },
      workflows: {
        define: async (workflow: WorkflowIR) => {
          fredCalls.push(`workflow:${workflow.id}`)
        },
      },
      shutdown: async () => {
        fredCalls.push('shutdown')
      },
    } as unknown as FredClient
    await Effect.runPromise(
      processOneResearchJob({
        now: () => now + 3n,
        staleAfterMs: 300_000,
        heartbeatIntervalMs: 10_000,
        randomEventId: () =>
          EventJournalId.make(
            `210e8400-e29b-41d4-a716-4466554400${researchEventSequence++}`,
          ),
        randomCitationId: () => citationId,
        jobs: {
          recoverStale: (staleAfterMs) =>
            ResearchExecutionRepo.recoverStale(staleAfterMs).pipe(
              Effect.provide(executionLayer),
            ),
          claimNext: () =>
            ResearchExecutionRepo.claimNext().pipe(
              Effect.provide(executionLayer),
            ),
          renewLease: (job) =>
            ResearchExecutionRepo.renewLease(job).pipe(
              Effect.provide(executionLayer),
            ),
          appendInProgressEvent: (job, event) =>
            ResearchExecutionRepo.appendInProgressEvent(job, event).pipe(
              Effect.provide(executionLayer),
            ),
          complete: (input) =>
            ResearchExecutionRepo.complete(input).pipe(
              Effect.provide(executionLayer),
            ),
          fail: (input) =>
            ResearchExecutionRepo.fail(input).pipe(
              Effect.provide(executionLayer),
            ),
        },
        runs: {
          findById: (id) =>
            ResearchRunRepo.findById(id).pipe(Effect.provide(runLayer)),
        },
        workflow: {
          run: ({
            run,
            workspaceId,
            projectId,
            sourceVersionIds,
            onRetrievalCompleted,
          }) =>
            runFredWalkingSkeleton(
              {
                runId: run.id,
                workspaceId,
                projectId,
                sourceVersionIds: [...sourceVersionIds],
                question: run.question,
              },
              {
                searchText: (input, signal) =>
                  Effect.runPromise(
                    TextRetrieval.searchText({
                      workspaceId: input.workspaceId,
                      projectId: input.projectId,
                      sourceVersionIds: [...input.sourceVersionIds],
                      query: input.question,
                      limit: 5,
                    }).pipe(
                      Effect.map((result) => result.evidence),
                      Effect.provide(retrievalLayer),
                    ),
                    { signal },
                  ),
                onRetrievalCompleted: (evidence, signal) =>
                  Effect.runPromise(
                    onRetrievalCompleted(evidence).pipe(Effect.asVoid),
                    { signal },
                  ),
                validate: (answer, evidence, question, signal) =>
                  Effect.runPromise(
                    validateAnswerCitations(answer, evidence, question),
                    { signal },
                  ),
              },
              {
                providerPackage: 'mock',
                model: 'fixed',
                maxElapsedMs: 1_000,
              },
              {
                create: async () => fredClient,
                execute: async (_fred, workflow, input) => {
                  const searchNode = workflow.nodes.find(
                    (node) => node.id === 'searchText',
                  )
                  const validationNode = workflow.nodes.find(
                    (node) => node.id === 'validateCitations',
                  )
                  if (
                    searchNode === undefined
                    || searchNode.kind !== 'function'
                    || validationNode === undefined
                    || validationNode.kind !== 'function'
                  ) {
                    throw new Error('Fred walking-skeleton nodes were not defined')
                  }
                  const retrieval = Schema.decodeUnknownSync(
                    AnswerSynthesizerInput,
                  )(await searchNode.fn({
                    input,
                    outputs: {},
                    history: [],
                    metadata: {},
                    pipelineId: workflow.id,
                  }))
                  const first = retrieval.evidence[0]
                  if (first === undefined) {
                    throw new Error('Fred retrieval returned no evidence')
                  }
                  const finalOutput = await validationNode.fn({
                    input: {
                      output: {
                        answer: 'The production launch date is July 18.',
                        citations: [{
                          sourceVersionId: first.sourceVersionId,
                          locator: first.locator,
                        }],
                      },
                    },
                    outputs: { searchText: retrieval },
                    history: [],
                    metadata: {},
                    pipelineId: workflow.id,
                  })
                  return {
                    success: true,
                    status: 'completed',
                    context: {
                      input,
                      outputs: { searchText: retrieval },
                      history: [],
                      metadata: {},
                      pipelineId: workflow.id,
                    },
                    outputs: { validateCitations: finalOutput },
                    executedNodes: [
                      'searchText',
                      'synthesize',
                      'validateCitations',
                    ],
                    finalOutput,
                    runId: input.runId,
                  }
                },
              },
            ),
        },
      }),
    )
    expect(fredCalls).toEqual([
      'provider',
      'tool',
      'agent',
      'workflow:struct.walking-skeleton-research',
      'shutdown',
    ])

    const projectionLayer = serviceLayer(ResearchProjectionRepo.Default, sql)
    const projectionDeps = {
      listEventsAfter: (
        scopedProjectId: ProjectId,
        scopedRunId: ResearchRunId,
        cursor: bigint,
        limit: number,
      ) =>
        ResearchProjectionRepo.listEventsAfter(
          scopedProjectId,
          scopedRunId,
          cursor,
          limit,
        ).pipe(Effect.provide(projectionLayer)),
      findCompleted: (scopedRunId: ResearchRunId) =>
        ResearchProjectionRepo.findCompleted(scopedRunId).pipe(
          Effect.provide(projectionLayer),
        ),
    }
    const streamAbort = new AbortController()
    const response = researchEventsResponse(
      projectId,
      runId,
      0n,
      projectionDeps,
      streamAbort.signal,
    )
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let replay = ''
    for (let reads = 0; reads < 8; reads += 1) {
      const chunk = await reader.read()
      if (chunk.done) break
      replay += decoder.decode(chunk.value, { stream: true })
      if (replay.includes('event: research-completed')) break
    }
    streamAbort.abort()
    expect(replay.match(/^id: /gm)).toHaveLength(4)
    expect(replay).toContain('event: research-started')
    expect(replay).toContain('event: retrieval-completed')
    expect(replay).toContain('event: citations-validated')
    expect(replay).toContain('event: research-completed')
    expect(replay).toContain('"answer":"The production launch date is July 18."')

    const citation = await Effect.runPromise(
      getCitationDetail(projectId, threadId, citationId, (
        scopedProjectId,
        scopedThreadId,
        scopedCitationId,
      ) =>
        ResearchProjectionRepo.findCitation(
          scopedProjectId,
          scopedThreadId,
          scopedCitationId,
        ).pipe(Effect.provide(projectionLayer))),
    )
    expect(citation.sourceName).toBe('launch.md')
    expect(citation.contextLines.some((line) =>
      line.segments.some((segment) =>
        segment.cited && segment.text.includes('July 18')))).toBe(true)

    await sql.end()
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    const reopenedProjectionLayer =
      serviceLayer(ResearchProjectionRepo.Default, sql)
    const reopened = await Effect.runPromise(
      ResearchProjectionRepo.findCompleted(runId).pipe(
        Effect.provide(reopenedProjectionLayer),
      ),
    )
    expect(reopened).toEqual({
      answer: 'The production launch date is July 18.',
      citations: [{
        id: citationId,
        sourceVersionId,
        locator: citation.locator,
      }],
    })
  })
})
