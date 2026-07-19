import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DocumentChunkId,
  DocumentId,
  JobQueueId,
  ProjectId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
  hashDocumentChunkText,
  makeDocumentChunkId,
  type Document,
  type DocumentChunk,
  type JobQueue,
} from '@struct/domain'
import { Cause, Effect, Exit, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  DocumentChunkRepo,
  DocumentChunkValidationError,
  IngestionJobOwnershipLostError,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('d70e8400-e29b-41d4-a716-446655440000')
const otherWorkspaceId = WorkspaceId.make('d70e8400-e29b-41d4-a716-446655440009')
const projectId = ProjectId.make('d70e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('d70e8400-e29b-41d4-a716-446655440002')
const sourceVersionId =
  SourceVersionId.make('d70e8400-e29b-41d4-a716-446655440003')
const staleSourceVersionId =
  SourceVersionId.make('d70e8400-e29b-41d4-a716-446655440004')
const jobId = JobQueueId.make('d70e8400-e29b-41d4-a716-446655440005')
const documentId = DocumentId.make('d70e8400-e29b-41d4-a716-446655440006')
const chunkId = makeDocumentChunkId(documentId, 'fragments-v1', 0)

const job: typeof JobQueue.Type = {
  id: jobId,
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  status: 'in-progress',
  payload: {},
  attempts: 1,
  maxAttempts: 3,
  createdAt: 1n,
  updatedAt: 1n,
}
const document: Document = {
  id: documentId,
  sourceVersionId,
  format: 'text',
  normalizedText: 'First café\n\nSecond',
  contentHash: 'sha256:document',
  parserVersion: 'text-v1',
  createdAt: 1n,
}
const chunks: ReadonlyArray<DocumentChunk> = [
  {
    id: chunkId,
    documentId,
    sourceVersionId,
    chunkingVersion: 'fragments-v1',
    ordinal: 0,
    text: 'First café',
    textHash: hashDocumentChunkText('First café'),
    locator: {
      page: null,
      section: null,
      paragraph: 1,
      charStart: 0,
      charEnd: 10,
      byteStart: 0,
      byteEnd: 11,
    },
    createdAt: 1n,
  },
  {
    id: makeDocumentChunkId(documentId, 'fragments-v1', 1),
    documentId,
    sourceVersionId,
    chunkingVersion: 'fragments-v1',
    ordinal: 1,
    text: 'Second',
    textHash: hashDocumentChunkText('Second'),
    locator: {
      page: null,
      section: null,
      paragraph: 2,
      charStart: 12,
      charEnd: 18,
      byteStart: 13,
      byteEnd: 19,
    },
    createdAt: 1n,
  },
]

describeIf('DocumentChunkRepo immutable storage (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<DocumentChunkRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 2, idle_timeout: 5 })
    layer = Layer.provide(DocumentChunkRepo.Default, SqlClientLive(sql))
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Chunk Workspace')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Chunk Project')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'chunks.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       )
       VALUES
         ($1, $3, 1, 'artifact://chunks-1', 'sha256:chunks-1'),
         ($2, $3, 2, 'artifact://chunks-2', 'sha256:chunks-2')`,
      [sourceVersionId, staleSourceVersionId, sourceId],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts
       )
       VALUES ($1, $2, 'ingestion', $3, 'in-progress', '{}', 1, 3)`,
      [jobId, workspaceId, sourceId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  it('stores and rebuilds the same immutable chunk set idempotently', async () => {
    const input = {
      job,
      workspaceId,
      projectId,
      sourceId,
      document,
      chunks,
    }
    await Effect.runPromise(
      DocumentChunkRepo.storeForIngestionAttempt(input).pipe(
        Effect.provide(layer),
      ),
    )
    await Effect.runPromise(
      DocumentChunkRepo.storeForIngestionAttempt(input).pipe(
        Effect.provide(layer),
      ),
    )

    const stored = await Effect.runPromise(
      DocumentChunkRepo.findBySourceVersion({
        workspaceId,
        sourceVersionId,
        chunkingVersion: 'fragments-v1',
      }).pipe(Effect.provide(layer)),
    )
    const outsideTenant = await Effect.runPromise(
      DocumentChunkRepo.findBySourceVersion({
        workspaceId: otherWorkspaceId,
        sourceVersionId,
        chunkingVersion: 'fragments-v1',
      }).pipe(Effect.provide(layer)),
    )

    expect(stored).toEqual([...chunks])
    expect(outsideTenant).toEqual([])
    expect(await sql.unsafe(
      `SELECT id FROM documents WHERE source_version_id = $1`,
      [sourceVersionId],
    )).toHaveLength(1)
    expect(await sql.unsafe(
      `SELECT id FROM document_chunks WHERE source_version_id = $1`,
      [sourceVersionId],
    )).toHaveLength(2)
  })

  it('rejects a conflicting rebuild and preserves the original rows', async () => {
    const conflict = {
      ...document,
      normalizedText: 'Other text',
      contentHash: 'sha256:other',
    }
    const conflictChunks: ReadonlyArray<DocumentChunk> = [{
      ...chunks[0] as DocumentChunk,
      text: 'Other text',
      textHash: hashDocumentChunkText('Other text'),
      locator: {
        ...chunks[0]?.locator,
        charEnd: 10,
        byteEnd: 10,
      },
    }]
    const result = await Effect.runPromiseExit(
      DocumentChunkRepo.storeForIngestionAttempt({
        job,
        workspaceId,
        projectId,
        sourceId,
        document: conflict,
        chunks: conflictChunks,
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') {
        expect(failure.value).toBeInstanceOf(DocumentChunkValidationError)
      }
    }
    const [persisted] = await sql.unsafe(
      `SELECT normalized_text FROM documents WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    expect(persisted?.['normalized_text']).toBe(document.normalizedText)
  })

  it('rejects forged deterministic chunk identity and integrity metadata', async () => {
    for (const forgedChunk of [
      {
        ...chunks[0] as DocumentChunk,
        id: DocumentChunkId.make('d70e8400-e29b-41d4-a716-44665544000b'),
      },
      {
        ...chunks[0] as DocumentChunk,
        textHash: 'sha256:forged',
      },
      {
        ...chunks[0] as DocumentChunk,
        locator: {
          ...(chunks[0] as DocumentChunk).locator,
          charStart: Number.NaN,
        },
      },
    ]) {
      const result = await Effect.runPromiseExit(
        DocumentChunkRepo.storeForIngestionAttempt({
          job,
          workspaceId,
          projectId,
          sourceId,
          document,
          chunks: [forgedChunk],
        }).pipe(Effect.provide(layer)),
      )

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const failure = Cause.failureOption(result.cause)
        expect(failure._tag).toBe('Some')
        if (failure._tag === 'Some') {
          expect(failure.value).toBeInstanceOf(DocumentChunkValidationError)
        }
      }
    }
  })

  it('fences a stale attempt before any document or chunk write', async () => {
    await sql.unsafe(
      `UPDATE job_queue SET attempts = 2 WHERE id = $1`,
      [jobId],
    )
    const staleDocument: Document = {
      ...document,
      id: DocumentId.make('d70e8400-e29b-41d4-a716-446655440008'),
      sourceVersionId: staleSourceVersionId,
    }
    const staleChunks: ReadonlyArray<DocumentChunk> = [{
      ...chunks[0] as DocumentChunk,
      id: makeDocumentChunkId(staleDocument.id, 'fragments-v1', 0),
      documentId: staleDocument.id,
      sourceVersionId: staleSourceVersionId,
    }]
    const result = await Effect.runPromiseExit(
      DocumentChunkRepo.storeForIngestionAttempt({
        job,
        workspaceId,
        projectId,
        sourceId,
        document: staleDocument,
        chunks: staleChunks,
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') {
        expect(failure.value).toBeInstanceOf(IngestionJobOwnershipLostError)
      }
    }
    expect(await sql.unsafe(
      `SELECT id FROM documents WHERE source_version_id = $1`,
      [staleSourceVersionId],
    )).toHaveLength(0)
  })
})
