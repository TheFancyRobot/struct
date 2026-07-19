import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import {
  CitationId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import { SqlClientLive } from '../sql-client'
import { ResearchProjectionRepo } from './research-projections'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = 'e70e8400-e29b-41d4-a716-446655440001'
const projectId = ProjectId.make('e70e8400-e29b-41d4-a716-446655440002')
const sourceId = 'e70e8400-e29b-41d4-a716-446655440003'
const sourceVersionId = 'e70e8400-e29b-41d4-a716-446655440004'
const threadId = ResearchThreadId.make('e70e8400-e29b-41d4-a716-446655440005')
const runId = ResearchRunId.make('e70e8400-e29b-41d4-a716-446655440006')
const citationId = CitationId.make('e70e8400-e29b-41d4-a716-446655440007')

describeIf('ResearchProjectionRepo integration', () => {
  const sql = postgres(DATABASE_URL ?? '', { max: 2, idle_timeout: 5 })
  const layer = Layer.provide(ResearchProjectionRepo.Default, SqlClientLive(sql))

  beforeAll(async () => {
    await sql.unsafe(`INSERT INTO workspaces (id, name) VALUES ($1, 'Projection')`, [workspaceId])
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, 'Projection')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind) VALUES ($1, $2, 'launch.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://projection', 'sha256:projection')`,
      [sourceVersionId, sourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, 'Before\nLaunch is July 18.\nAfter')`,
      [sourceVersionId],
    )
    await sql.unsafe(
      `INSERT INTO research_threads (id, project_id, title) VALUES ($1, $2, 'Launch')`,
      [threadId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question, status)
       VALUES ($1, $2, 'When?', 'completed')`,
      [runId, threadId],
    )
    await sql.unsafe(
      `INSERT INTO research_run_results (run_id, answer, citations)
       VALUES ($1, 'July 18.', '[]'::jsonb)`,
      [runId],
    )
    await sql.unsafe(
      `INSERT INTO citations (id, run_id, source_version_id, locator, status)
       VALUES ($1, $2, $3, 'lines:2-2', 'validated')`,
      [citationId, runId, sourceVersionId],
    )
    await sql.unsafe(
      `INSERT INTO event_journal
         (id, workspace_id, entity_type, entity_id, event_type, payload)
       VALUES
         ('e70e8400-e29b-41d4-a716-446655440008', $1, 'research', $2, 'research-completed',
          jsonb_build_object('jobId', 'e70e8400-e29b-41d4-a716-446655440009', 'attempt', 1, 'citationCount', 1))`,
      [workspaceId, runId],
    )
  })

  afterAll(async () => {
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM research_threads WHERE project_id = $1`, [projectId])
    await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [sourceId])
    await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [sourceId])
    await sql.unsafe(`DELETE FROM projects WHERE id = $1`, [projectId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  it('replays scoped events and resolves final answer plus stored citation context', async () => {
    const events = await Effect.runPromise(
      ResearchProjectionRepo.listEventsAfter(projectId, runId, 0n, 10)
        .pipe(Effect.provide(layer)),
    )
    const completed = await Effect.runPromise(
      ResearchProjectionRepo.findCompleted(runId).pipe(Effect.provide(layer)),
    )
    const citation = await Effect.runPromise(
      ResearchProjectionRepo.findCitation(projectId, threadId, citationId)
        .pipe(Effect.provide(layer)),
    )

    expect(events.map((event) => event.eventType)).toEqual(['research-completed'])
    expect(completed).toMatchObject({
      answer: 'July 18.',
      citations: [{ id: citationId, sourceVersionId, locator: 'lines:2-2' }],
    })
    expect(citation.content).toContain('Launch is July 18.')
  })

  it('does not expose a run through a different project scope', async () => {
    const events = await Effect.runPromise(
      ResearchProjectionRepo.listEventsAfter(
        ProjectId.make('e70e8400-e29b-41d4-a716-446655440010'),
        runId,
        0n,
        10,
      ).pipe(Effect.provide(layer)),
    )
    expect(events).toEqual([])
  })
})
