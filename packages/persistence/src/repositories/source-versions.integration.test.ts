import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DirectoryManifest,
  DirectoryRelativePath,
  DirectoryRootId,
  DirectorySnapshotId,
  DocumentId,
  JobQueueId,
  ManifestEntryId,
  ProjectId,
  ResearchRunId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
  computeManifestDigest,
  hashDocumentChunkText,
  makeDocumentChunkId,
  type DirectoryManifestEntry,
} from '@struct/domain'
import { Effect, Layer, Option, Schema } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  DirectoryIngestionJobRepo,
  DirectorySourceVersionRepo,
  SqlClientLive,
  type CommitDirectoryRefreshInput,
  type PreparedDirectorySourceVersion,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('360e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('360e8400-e29b-41d4-a716-446655440001')
const rootId = DirectoryRootId.make('360e8400-e29b-41d4-a716-446655440002')
const directorySourceId =
  SourceId.make('360e8400-e29b-41d4-a716-446655440003')

function digest(character: string) {
  return Sha256Digest.make(`sha256:${character.repeat(64)}`)
}

function entry(
  snapshotId: typeof DirectorySnapshotId.Type,
  suffix: string,
  path: string,
  hash: ReturnType<typeof digest> | null,
): DirectoryManifestEntry {
  return {
    id: ManifestEntryId.make(`360e8400-e29b-41d4-a716-44665544${suffix}`),
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    relativePath: DirectoryRelativePath.make(path),
    status: hash === null ? 'unsupported' : 'included',
    byteLength: hash === null ? 0 : 12,
    contentHash: hash,
    unsupportedReason: hash === null ? 'binary' : null,
  }
}

function manifest(
  snapshotId: typeof DirectorySnapshotId.Type,
  entries: ReadonlyArray<DirectoryManifestEntry>,
) {
  return Schema.decodeUnknownSync(DirectoryManifest)({
    snapshotId,
    directoryRootId: rootId,
    workspaceId,
    projectId,
    digest: computeManifestDigest(entries),
    entries,
  })
}

function prepared(
  item: DirectoryManifestEntry,
  sourceId: typeof SourceId.Type,
  sourceVersionId: typeof SourceVersionId.Type,
  suffix: string,
): PreparedDirectorySourceVersion {
  if (item.contentHash === null) throw new Error('included entry expected')
  const documentId =
    DocumentId.make(`360e8400-e29b-41d4-a716-44665545${suffix}`)
  const text = `text:${item.relativePath}`
  const chunkId = makeDocumentChunkId(documentId, 'refresh-v1', 0)
  return {
    entryId: item.id,
    sourceId,
    sourceVersionId,
    artifact: {
      ref: item.contentHash.replace(
        'sha256:',
        'artifact://sha256/',
      ) as `artifact://sha256/${string}`,
      contentHash: item.contentHash,
      byteLength: item.byteLength,
      mediaType: 'text/plain',
    },
    document: {
      id: documentId,
      sourceVersionId,
      format: 'text',
      normalizedText: text,
      contentHash: item.contentHash,
      parserVersion: 'refresh-test-v1',
      createdAt: 1_750_000_000_000n,
    },
    chunks: [{
      id: chunkId,
      documentId,
      sourceVersionId,
      chunkingVersion: 'refresh-v1',
      ordinal: 0,
      text,
      textHash: hashDocumentChunkText(text),
      locator: {
        page: null,
        section: null,
        paragraph: 1,
        charStart: 0,
        charEnd: text.length,
        byteStart: 0,
        byteEnd: new TextEncoder().encode(text).byteLength,
      },
      createdAt: 1_750_000_000_000n,
    }],
    embeddings: [{
      chunkId,
      embeddingModel: 'refresh-test-v1',
      values: [1, 0],
    }],
  }
}

describeIf('DirectorySourceVersionRepo (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let jobLayer: Layer.Layer<DirectoryIngestionJobRepo>
  let refreshLayer: Layer.Layer<DirectorySourceVersionRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 6, idle_timeout: 5 })
    const sqlLayer = SqlClientLive(sql)
    jobLayer = Layer.provide(DirectoryIngestionJobRepo.Default, sqlLayer)
    refreshLayer = Layer.provide(DirectorySourceVersionRepo.Default, sqlLayer)
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM directory_roots WHERE id = $1', [rootId])
    await sql.unsafe(
      `DELETE FROM research_threads
       WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = $1)`,
      [workspaceId],
    )
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Directory refresh')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Refresh project')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'Registered root', 'directory')`,
      [directorySourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO directory_roots (
         id, workspace_id, project_id, source_id
       ) VALUES ($1, $2, $3, $4)`,
      [rootId, workspaceId, projectId, directorySourceId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe('DROP TRIGGER IF EXISTS fail_directory_refresh ON directory_refresh_commits')
    await sql.unsafe('DROP FUNCTION IF EXISTS fail_directory_refresh_commit()')
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM directory_roots WHERE id = $1', [rootId])
    await sql.unsafe(
      `DELETE FROM research_threads
       WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = $1)`,
      [workspaceId],
    )
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.end()
  })

  const runJob = <A, E>(
    effect: Effect.Effect<A, E, DirectoryIngestionJobRepo>,
  ) => Effect.runPromise(effect.pipe(Effect.provide(jobLayer)))
  const runRefresh = <A, E>(
    effect: Effect.Effect<A, E, DirectorySourceVersionRepo>,
  ) => Effect.runPromise(effect.pipe(Effect.provide(refreshLayer)))

  async function claim(
    jobId: typeof JobQueueId.Type,
    snapshotId: typeof DirectorySnapshotId.Type,
  ) {
    await runJob(DirectoryIngestionJobRepo.create({
      jobId,
      workspaceId,
      snapshotId,
      maxAttempts: 3,
    }))
    const claimed = await runJob(
      DirectoryIngestionJobRepo.claimNext(30_000),
    )
    if (Option.isNone(claimed)) throw new Error('expected claimed job')
    return claimed.value
  }

  it('commits mixed immutable lineage once and preserves removed citations', async () => {
    const firstSnapshotId =
      DirectorySnapshotId.make('360e8400-e29b-41d4-a716-446655440010')
    const firstEntries = [
      entry(firstSnapshotId, '0011', 'changed.md', digest('a')),
      entry(firstSnapshotId, '0016', 'old-unsupported.bin', null),
      entry(firstSnapshotId, '0012', 'removed.md', digest('b')),
      entry(firstSnapshotId, '0013', 'renamed-old.md', digest('c')),
      entry(firstSnapshotId, '0014', 'same.md', digest('d')),
    ]
    const firstManifest = manifest(firstSnapshotId, firstEntries)
    const firstJob = await claim(
      JobQueueId.make('360e8400-e29b-41d4-a716-446655440015'),
      firstSnapshotId,
    )
    const firstPrepared = firstEntries
      .filter((item) => item.status === 'included')
      .map((item, index) =>
      prepared(
        item,
        SourceId.make(
          `360e8400-e29b-41d4-a716-44665544${String(20 + index).padStart(4, '0')}`,
        ),
        SourceVersionId.make(
          `360e8400-e29b-41d4-a716-44665544${String(30 + index).padStart(4, '0')}`,
        ),
        String(40 + index).padStart(4, '0'),
      ))
    const first = await runRefresh(DirectorySourceVersionRepo.commitRefresh({
      job: firstJob,
      idempotencyKey: 'refresh:first',
      projectId,
      previousManifest: null,
      currentManifest: firstManifest,
      prepared: firstPrepared,
    }))
    expect(first).toMatchObject({
      _tag: 'Committed',
      result: {
        added: 4,
        modified: 0,
        unchanged: 0,
        removed: 0,
        unsupported: 1,
      },
    })
    await runJob(DirectoryIngestionJobRepo.transition(
      firstJob.jobId,
      workspaceId,
      'complete',
    ))

    const removedVersionId = firstPrepared[1]!.sourceVersionId
    const threadId = '360e8400-e29b-41d4-a716-446655440050'
    const runId = ResearchRunId.make(
      '360e8400-e29b-41d4-a716-446655440051',
    )
    await sql.unsafe(
      `INSERT INTO research_threads (id, project_id, title)
       VALUES ($1, $2, 'Historical')`,
      [threadId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question)
       VALUES ($1, $2, 'Historical citation')`,
      [runId, threadId],
    )
    await sql.unsafe(
      `INSERT INTO citations (
         id, run_id, source_version_id, locator
       ) VALUES ($1, $2, $3, 'file:removed.md')`,
      [
        '360e8400-e29b-41d4-a716-446655440052',
        runId,
        removedVersionId,
      ],
    )

    const secondSnapshotId =
      DirectorySnapshotId.make('360e8400-e29b-41d4-a716-446655440060')
    const secondEntries = [
      entry(secondSnapshotId, '0061', 'added.md', digest('e')),
      entry(secondSnapshotId, '0062', 'changed.md', digest('f')),
      entry(secondSnapshotId, '0063', 'renamed-new.md', digest('c')),
      entry(secondSnapshotId, '0064', 'same.md', digest('d')),
      entry(secondSnapshotId, '0065', 'unsupported.bin', null),
    ]
    const secondManifest = manifest(secondSnapshotId, secondEntries)
    const secondJob = await claim(
      JobQueueId.make('360e8400-e29b-41d4-a716-446655440066'),
      secondSnapshotId,
    )
    const secondPrepared = [
      prepared(
        secondEntries[0]!,
        SourceId.make('360e8400-e29b-41d4-a716-446655440067'),
        SourceVersionId.make('360e8400-e29b-41d4-a716-446655440068'),
        '0069',
      ),
      prepared(
        secondEntries[1]!,
        firstPrepared[0]!.sourceId,
        SourceVersionId.make('360e8400-e29b-41d4-a716-446655440070'),
        '0071',
      ),
      prepared(
        secondEntries[2]!,
        SourceId.make('360e8400-e29b-41d4-a716-446655440072'),
        SourceVersionId.make('360e8400-e29b-41d4-a716-446655440073'),
        '0074',
      ),
    ]
    const refreshInput: CommitDirectoryRefreshInput = {
      job: secondJob,
      idempotencyKey: 'refresh:second',
      projectId,
      previousManifest: firstManifest,
      currentManifest: secondManifest,
      prepared: secondPrepared,
    }
    const committed = await runRefresh(
      DirectorySourceVersionRepo.commitRefresh(refreshInput),
    )
    expect(committed).toMatchObject({
      _tag: 'Committed',
      result: {
        added: 2,
        modified: 1,
        unchanged: 1,
        removed: 3,
        unsupported: 1,
      },
    })
    if (committed._tag === 'StaleWorkerNoOp') {
      throw new Error('expected committed refresh')
    }
    expect(await runRefresh(
      DirectorySourceVersionRepo.commitRefresh({
        ...refreshInput,
        prepared: [],
      }),
    )).toEqual({ _tag: 'Replayed', result: committed.result })

    const counts = await sql.unsafe(
      `SELECT
         (SELECT COUNT(*)::int FROM source_versions
          WHERE source_id IN (
            SELECT source_id FROM directory_entry_lineage
            WHERE snapshot_id IN ($1, $2) AND source_id IS NOT NULL
          )) AS versions,
         (SELECT COUNT(*)::int FROM documents
          WHERE workspace_id = $3) AS documents,
         (SELECT COUNT(*)::int FROM document_chunks
          WHERE workspace_id = $3) AS chunks,
         (SELECT COUNT(*)::int FROM document_chunk_embeddings
          WHERE workspace_id = $3) AS embeddings,
         (SELECT COUNT(*)::int FROM event_journal
          WHERE entity_type = 'directory-ingestion'
            AND event_type = 'directory-refresh-committed'
            AND workspace_id = $3) AS events,
         (SELECT COUNT(*)::int FROM directory_refresh_commits
          WHERE snapshot_id IN ($1, $2)) AS refresh_checkpoints`,
      [firstSnapshotId, secondSnapshotId, workspaceId],
    )
    expect(counts[0]).toMatchObject({
      versions: 7,
      documents: 7,
      chunks: 7,
      embeddings: 7,
      events: 2,
      refresh_checkpoints: 2,
    })
    const unchanged = await sql.unsafe(
      `SELECT current.source_version_id, current.previous_source_version_id
       FROM directory_entry_lineage current
       WHERE current.snapshot_id = $1 AND current.relative_path = 'same.md'`,
      [secondSnapshotId],
    )
    expect(unchanged[0]?.['source_version_id']).toBe(
      firstPrepared[3]!.sourceVersionId,
    )
    expect(unchanged[0]?.['previous_source_version_id']).toBe(
      firstPrepared[3]!.sourceVersionId,
    )
    const citation = await sql.unsafe(
      `SELECT version.id
       FROM citations citation
       JOIN source_versions version ON version.id = citation.source_version_id
       WHERE citation.run_id = $1`,
      [runId],
    )
    expect(citation[0]?.['id']).toBe(removedVersionId)
    const unsupportedRemoval = await sql.unsafe(
      `SELECT source_id, source_version_id, previous_source_version_id
       FROM directory_entry_lineage
       WHERE snapshot_id = $1
         AND relative_path = 'old-unsupported.bin'
         AND disposition = 'removed'`,
      [secondSnapshotId],
    )
    expect(unsupportedRemoval).toHaveLength(1)
    expect(unsupportedRemoval[0]).toMatchObject({
      source_id: null,
      source_version_id: null,
      previous_source_version_id: null,
    })

    await sql.unsafe(
      `UPDATE directory_snapshots
       SET created_at = CASE
         WHEN id = $1 THEN NOW() + INTERVAL '1 day'
         ELSE NOW() - INTERVAL '1 day'
       END
       WHERE id IN ($1, $2)`,
      [firstSnapshotId, secondSnapshotId],
    )
    const thirdSnapshotId =
      DirectorySnapshotId.make('360e8400-e29b-41d4-a716-446655440075')
    const thirdEntries = [
      entry(thirdSnapshotId, '0076', 'added.md', digest('e')),
      entry(thirdSnapshotId, '0077', 'changed.md', digest('f')),
      entry(thirdSnapshotId, '0078', 'renamed-new.md', digest('c')),
      entry(thirdSnapshotId, '0079', 'same.md', digest('d')),
      entry(thirdSnapshotId, '0086', 'unsupported.bin', null),
    ]
    const thirdManifest = manifest(thirdSnapshotId, thirdEntries)
    const thirdJob = await claim(
      JobQueueId.make('360e8400-e29b-41d4-a716-446655440087'),
      thirdSnapshotId,
    )
    expect(await runRefresh(DirectorySourceVersionRepo.commitRefresh({
      job: thirdJob,
      idempotencyKey: 'refresh:third',
      projectId,
      previousManifest: secondManifest,
      currentManifest: thirdManifest,
      prepared: [],
    }))).toMatchObject({
      _tag: 'Committed',
      result: {
        added: 0,
        modified: 0,
        unchanged: 4,
        removed: 0,
        unsupported: 1,
      },
    })
  })

  it('rolls back every database write on a late fault and accepts only its workspace', async () => {
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM directory_roots WHERE id = $1', [rootId])
    await sql.unsafe(
      `INSERT INTO directory_roots (
         id, workspace_id, project_id, source_id
       ) VALUES ($1, $2, $3, $4)`,
      [rootId, workspaceId, projectId, directorySourceId],
    )
    const snapshotId =
      DirectorySnapshotId.make('360e8400-e29b-41d4-a716-446655440080')
    const currentEntry = entry(snapshotId, '0081', 'late-fault.md', digest('9'))
    const currentManifest = manifest(snapshotId, [currentEntry])
    const job = await claim(
      JobQueueId.make('360e8400-e29b-41d4-a716-446655440082'),
      snapshotId,
    )
    const item = prepared(
      currentEntry,
      SourceId.make('360e8400-e29b-41d4-a716-446655440083'),
      SourceVersionId.make('360e8400-e29b-41d4-a716-446655440084'),
      '0085',
    )
    await sql.unsafe(
      `CREATE OR REPLACE FUNCTION fail_directory_refresh_commit()
       RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'injected-refresh-fault'; END $$`,
    )
    await sql.unsafe(
      `CREATE TRIGGER fail_directory_refresh
       BEFORE INSERT ON directory_refresh_commits
       FOR EACH ROW EXECUTE FUNCTION fail_directory_refresh_commit()`,
    )
    const failed = await Effect.runPromise(
      DirectorySourceVersionRepo.commitRefresh({
        job,
        idempotencyKey: 'refresh:fault',
        projectId,
        previousManifest: null,
        currentManifest,
        prepared: [item],
      }).pipe(Effect.provide(refreshLayer), Effect.flip),
    )
    expect(failed).toMatchObject({ _tag: 'QueryError' })
    const rolledBack = await sql.unsafe(
      `SELECT
         (SELECT COUNT(*)::int FROM directory_snapshots WHERE id = $1) AS snapshots,
         (SELECT COUNT(*)::int FROM source_versions WHERE id = $2) AS versions,
         (SELECT COUNT(*)::int FROM event_journal
          WHERE entity_type = 'directory-ingestion' AND entity_id = $3) AS events,
         (SELECT COUNT(*)::int FROM directory_refresh_commits
          WHERE job_id = $3) AS refresh_checkpoints,
         (SELECT next_checkpoint_sequence::int
          FROM directory_ingestion_jobs WHERE job_id = $3) AS next_sequence`,
      [snapshotId, item.sourceVersionId, job.jobId],
    )
    expect(rolledBack[0]).toMatchObject({
      snapshots: 0,
      versions: 0,
      events: 0,
      refresh_checkpoints: 0,
      next_sequence: 1,
    })
    await sql.unsafe('DROP TRIGGER fail_directory_refresh ON directory_refresh_commits')
    expect(await runRefresh(DirectorySourceVersionRepo.commitRefresh({
      job,
      idempotencyKey: 'refresh:fault',
      projectId,
      previousManifest: null,
      currentManifest,
      prepared: [item],
    }))).toMatchObject({ _tag: 'Committed' })

    const foreign = {
      ...currentManifest,
      workspaceId: WorkspaceId.make(
        '360e8400-e29b-41d4-a716-446655440099',
      ),
      entries: currentManifest.entries.map((manifestEntry) => ({
        ...manifestEntry,
        workspaceId: WorkspaceId.make(
          '360e8400-e29b-41d4-a716-446655440099',
        ),
      })),
    }
    const rejected = await Effect.runPromise(
      DirectorySourceVersionRepo.commitRefresh({
        job,
        idempotencyKey: 'refresh:foreign',
        projectId,
        previousManifest: null,
        currentManifest: foreign,
        prepared: [],
      }).pipe(Effect.provide(refreshLayer), Effect.flip),
    )
    expect(rejected).toMatchObject({
      _tag: 'DirectoryRefreshValidationError',
      reason: 'scope-mismatch',
    })
  })
})
