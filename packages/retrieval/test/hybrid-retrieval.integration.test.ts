import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DocumentChunkId,
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  SqlClientLive,
  runMigrationsUp,
  type SqlExecutor,
  type SqlExecutorWithTransactions,
} from '@struct/persistence'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import { HybridRetrieval } from '../src/hybrid-retrieval.js'
import { VectorRetrieval } from '../src/vector-search.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const schemaName = `hybrid_retrieval_${crypto.randomUUID().replaceAll('-', '')}`
const workspaceId = WorkspaceId.make('c50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('c50e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make(
  'c50e8400-e29b-41d4-a716-446655440003',
)
const chunkIds = [
  DocumentChunkId.make('c50e8400-e29b-41d4-a716-446655440005'),
  DocumentChunkId.make('c50e8400-e29b-41d4-a716-446655440006'),
] as const
const staleChunkId = DocumentChunkId.make(
  'c50e8400-e29b-41d4-a716-446655440007',
)

function migrationExecutor(
  sql: postgresTypes.Sql,
): SqlExecutorWithTransactions {
  return {
    unsafe: (query) => sql.unsafe(query) as Promise<unknown>,
    begin: <T>(run: (transaction: SqlExecutor) => Promise<T>) =>
      sql.begin((transaction) =>
        run({
          unsafe: (query) => transaction.unsafe(query) as Promise<unknown>,
        }),
      ) as Promise<T>,
  }
}

describeIf('hybrid retrieval (PostgreSQL)', () => {
  let admin: postgresTypes.Sql
  let scoped: postgresTypes.Sql
  let hybridLayer: Layer.Layer<HybridRetrieval>
  let vectorLayer: Layer.Layer<VectorRetrieval>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    admin = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    await admin.unsafe(`CREATE SCHEMA "${schemaName}"`)
    scoped = postgres(DATABASE_URL, {
      max: 1,
      idle_timeout: 5,
      connection: { search_path: `"${schemaName}",public` },
    })
    await Effect.runPromise(runMigrationsUp(migrationExecutor(scoped)))
    await scoped.unsafe(`
      INSERT INTO workspaces (id, name)
      VALUES
        ('${workspaceId}', 'Hybrid Workspace'),
        ('c50e8400-e29b-41d4-a716-446655440009', 'Other Workspace');
      INSERT INTO projects (id, workspace_id, name)
      VALUES (
        '${projectId}',
        '${workspaceId}',
        'Hybrid Project'
      );
      INSERT INTO sources (id, project_id, name, kind)
      VALUES (
        'c50e8400-e29b-41d4-a716-446655440002',
        '${projectId}',
        'hybrid.txt',
        'document'
      );
      INSERT INTO source_versions (
        id, source_id, version, artifact_ref, content_hash
      )
      VALUES (
        '${sourceVersionId}',
        'c50e8400-e29b-41d4-a716-446655440002',
        1,
        'artifact://hybrid',
        'sha256:hybrid'
      );
      INSERT INTO documents (
        id, workspace_id, project_id, source_id, source_version_id,
        format, normalized_text, content_hash, parser_version
      )
      VALUES (
        'c50e8400-e29b-41d4-a716-446655440004',
        '${workspaceId}',
        '${projectId}',
        'c50e8400-e29b-41d4-a716-446655440002',
        '${sourceVersionId}',
        'text',
        'Exact launch evidence Semantic schedule paraphrase',
        'sha256:document',
        'text-v1'
      );
      INSERT INTO document_chunks (
        id, document_id, workspace_id, project_id, source_id,
        source_version_id, chunking_version, ordinal, text, text_hash,
        paragraph, char_start, char_end, byte_start, byte_end
      )
      VALUES
        (
          '${chunkIds[0]}',
          'c50e8400-e29b-41d4-a716-446655440004',
          '${workspaceId}',
          '${projectId}',
          'c50e8400-e29b-41d4-a716-446655440002',
          '${sourceVersionId}',
          'fragments-v1',
          0,
          'Exact launch evidence',
          'sha256:chunk-0',
          1,
          0,
          21,
          0,
          21
        ),
        (
          '${chunkIds[1]}',
          'c50e8400-e29b-41d4-a716-446655440004',
          '${workspaceId}',
          '${projectId}',
          'c50e8400-e29b-41d4-a716-446655440002',
          '${sourceVersionId}',
          'fragments-v1',
          1,
          'Semantic schedule paraphrase',
          'sha256:chunk-1',
          2,
          22,
          50,
          22,
          50
        ),
        (
          '${staleChunkId}',
          'c50e8400-e29b-41d4-a716-446655440004',
          '${workspaceId}',
          '${projectId}',
          'c50e8400-e29b-41d4-a716-446655440002',
          '${sourceVersionId}',
          'fragments-v2',
          0,
          'Stale launch evidence',
          'sha256:stale-chunk',
          1,
          0,
          21,
          0,
          21
        );
    `)
    const sqlLayer = SqlClientLive(scoped)
    hybridLayer = Layer.provide(HybridRetrieval.Default, sqlLayer)
    vectorLayer = Layer.provide(VectorRetrieval.Default, sqlLayer)
    await Effect.runPromise(Effect.all([
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: chunkIds[0],
        embeddingModel: 'fixture-v1',
        embedding: [0, 1, 0],
      }),
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: chunkIds[1],
        embeddingModel: 'fixture-v1',
        embedding: [1, 0, 0],
      }),
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: staleChunkId,
        embeddingModel: 'fixture-v1',
        embedding: [1, 0, 0],
      }),
    ], { concurrency: 1 }).pipe(Effect.provide(vectorLayer)))
  })

  afterAll(async () => {
    if (scoped) await scoped.end()
    if (admin) {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      await admin.end()
    }
  })

  it('returns fused keyword and semantic candidates with exact provenance', async () => {
    const result = await Effect.runPromise(
      HybridRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        query: 'launch',
        embeddingModel: 'fixture-v1',
        embedding: [1, 0, 0],
        candidateLimit: 10,
        limit: 10,
      }).pipe(Effect.provide(hybridLayer)),
    )

    expect(result.candidates.map((candidate) => candidate.chunkId)).toEqual(
      [...chunkIds],
    )
    expect(result.candidates[0]).toMatchObject({
      chunkId: chunkIds[0],
      keywordRank: 1,
      vectorRank: 2,
      text: 'Exact launch evidence',
      locator: { paragraph: 1, charStart: 0, charEnd: 21 },
    })
    expect(result.candidates[1]).toMatchObject({
      chunkId: chunkIds[1],
      keywordRank: null,
      vectorRank: 1,
      text: 'Semantic schedule paraphrase',
      locator: { paragraph: 2, charStart: 22, charEnd: 50 },
    })
  })

  it('returns no cross-scope or stale-version candidates', async () => {
    const result = await Effect.runPromise(
      HybridRetrieval.search({
        workspaceId: WorkspaceId.make(
          'c50e8400-e29b-41d4-a716-446655440009',
        ),
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        query: 'launch',
        embeddingModel: 'fixture-v1',
        embedding: [1, 0, 0],
        candidateLimit: 10,
        limit: 10,
      }).pipe(Effect.provide(hybridLayer)),
    )

    expect(result.candidates).toEqual([])
  })

  it('excludes chunks from a stale chunking version in the same tenant and source version', async () => {
    const result = await Effect.runPromise(
      HybridRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        query: 'launch',
        embeddingModel: 'fixture-v1',
        embedding: [1, 0, 0],
        candidateLimit: 10,
        limit: 10,
      }).pipe(Effect.provide(hybridLayer)),
    )

    expect(result.candidates.map((candidate) => candidate.chunkId)).not.toContain(
      staleChunkId,
    )
  })

  it('does not compare vectors from a different model dimension', async () => {
    const result = await Effect.runPromise(
      HybridRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        query: 'absent-keyword',
        embeddingModel: 'fixture-v1',
        embedding: [1, 0, 0, 0],
        candidateLimit: 10,
        limit: 10,
      }).pipe(Effect.provide(hybridLayer)),
    )

    expect(result.candidates).toEqual([])
  })

  it('keeps embeddings immutable while allowing identical retry', async () => {
    await Effect.runPromise(
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: chunkIds[0],
        embeddingModel: 'fixture-v1',
        embedding: [0, 1, 0],
      }).pipe(Effect.provide(vectorLayer)),
    )
    const changed = await Effect.runPromiseExit(
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: chunkIds[0],
        embeddingModel: 'fixture-v1',
        embedding: [1, 0, 0],
      }).pipe(Effect.provide(vectorLayer)),
    )
    const changedDimensions = await Effect.runPromiseExit(
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: chunkIds[0],
        embeddingModel: 'fixture-v1',
        embedding: [0, 1, 0, 0],
      }).pipe(Effect.provide(vectorLayer)),
    )

    expect(changed._tag).toBe('Failure')
    expect(changedDimensions._tag).toBe('Failure')
    const [persisted] = await scoped.unsafe(
      `SELECT dimensions, embedding::text
       FROM document_chunk_embeddings
       WHERE chunk_id = $1 AND embedding_model = $2`,
      [chunkIds[0], 'fixture-v1'],
    )
    expect(persisted).toMatchObject({
      dimensions: 3,
      embedding: '[0,1,0]',
    })
  })

  it('enforces non-zero embeddings in PostgreSQL as well as the typed boundary', async () => {
    let rejected = false
    try {
      await scoped.unsafe(
        `UPDATE document_chunk_embeddings
         SET embedding = '[0,0,0]'::vector
         WHERE chunk_id = $1 AND embedding_model = $2`,
        [chunkIds[0], 'fixture-v1'],
      )
    } catch {
      rejected = true
    }

    expect(rejected).toBe(true)
  })
})
