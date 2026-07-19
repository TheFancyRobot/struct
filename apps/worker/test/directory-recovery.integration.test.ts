import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DirectoryIngestionJobRepo,
  DirectorySourceVersionRepo,
  SqlClientLive,
  type PreparedDirectorySourceVersion,
} from '@struct/persistence'
import {
  DirectoryFileSystem,
  DirectoryDiscovery,
  BunDirectoryFileSystemShape,
  DirectoryFilesystemError,
  DirectoryPermissionError,
  type DirectoryFileSystemShape,
} from '@struct/ingestion'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  JobQueueId,
  ProjectId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  StorageWriteError,
  WorkspaceId,
  type DirectoryManifest,
} from '@struct/domain'
import {
  type ArtifactObject,
  type ArtifactStoreShape,
} from '@struct/source-storage'
import { Effect, Layer, Option } from 'effect'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import { refreshClaimedDirectory } from '../src/jobs/refresh-directory.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('540e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('540e8400-e29b-41d4-a716-446655440001')
const bytes = new TextEncoder().encode('phase-03 recovery evidence')
const contentHash = Sha256Digest.make(
  `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
)
const artifact: ArtifactObject = {
  ref: contentHash.replace(
    'sha256:',
    'artifact://sha256/',
  ) as `artifact://sha256/${string}`,
  hash: String(contentHash) as `sha256:${string}`,
  byteLength: bytes.byteLength,
  mediaType: 'text/markdown',
}

const failureBoundaries = [
  'discovery',
  'hashing',
  'checkpoint',
  'artifact-persistence',
  'version-creation',
  'event-publication',
] as const
type FailureBoundary = typeof failureBoundaries[number]

function uuid(suffix: number): string {
  return `540e8400-e29b-41d4-a716-${String(suffix).padStart(12, '0')}`
}

function fileSystemLayer(fileSystem: DirectoryFileSystemShape) {
  return DirectoryDiscovery.Default.pipe(
    Layer.provide(Layer.succeed(DirectoryFileSystem, fileSystem)),
  )
}

function discoverComplete(
  registeredRoot: string,
  directoryRootId: typeof DirectoryRootId.Type,
  snapshotId: typeof DirectorySnapshotId.Type,
  fileSystem: DirectoryFileSystemShape,
) {
  return Effect.gen(function* () {
    const result = yield* DirectoryDiscovery.discover({
      registeredRoot,
      workspaceId,
      projectId,
      directoryRootId,
      snapshotId,
      limits: {
        maxDepth: 4,
        maxEntries: 10,
        maxFileBytes: 1_024,
        maxAggregateBytes: 4_096,
      },
    }).pipe(Effect.provide(fileSystemLayer(fileSystem)))
    const failure = result.outcomes.find((outcome) =>
      outcome._tag === 'DirectoryEntryFailure')
    if (failure !== undefined) return yield* failure.error
    return result.manifest
  })
}

function prepared(
  manifest: DirectoryManifest,
  sourceId: typeof SourceId.Type,
  sourceVersionId: typeof SourceVersionId.Type,
): PreparedDirectorySourceVersion {
  const entry = manifest.entries[0]
  if (entry === undefined) throw new Error('recovery manifest entry is missing')
  return {
    entryId: entry.id,
    sourceId,
    sourceVersionId,
    artifact: {
      ref: artifact.ref,
      contentHash: entry.contentHash,
      byteLength: artifact.byteLength,
      mediaType: artifact.mediaType,
    },
    document: null,
    chunks: [],
    embeddings: [],
  }
}

function artifactStore(
  failFirstWrite: boolean,
  writes: Set<string>,
): ArtifactStoreShape {
  let failed = false
  return {
    writeObject: () => {
      if (failFirstWrite && !failed) {
        failed = true
        return Effect.fail(new StorageWriteError({
          operation: 'writeObject',
          reason: 'injected-artifact-persistence-failure',
          message: 'Injected artifact persistence failure',
        }))
      }
      writes.add(artifact.ref)
      return Effect.succeed(artifact)
    },
    readObject: () => Effect.dieMessage('unused'),
    stageObject: () => Effect.dieMessage('unused'),
    readStagedObject: () => Effect.dieMessage('unused'),
  }
}

async function installFailureTrigger(
  sql: postgresTypes.Sql,
  boundary: FailureBoundary,
): Promise<void> {
  const target = boundary === 'checkpoint'
    ? 'directory_refresh_commits'
    : boundary === 'version-creation'
      ? 'source_versions'
      : boundary === 'event-publication'
        ? 'event_journal'
        : null
  if (target === null) return

  await sql.unsafe(
    `CREATE OR REPLACE FUNCTION fail_directory_recovery_boundary()
     RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN
       IF TG_TABLE_NAME <> 'event_journal'
          OR NEW.event_type = 'directory-refresh-committed' THEN
         RAISE EXCEPTION 'injected-directory-recovery-boundary';
       END IF;
       RETURN NEW;
     END $$`,
  )
  await sql.unsafe(
    `CREATE TRIGGER fail_directory_recovery_boundary
     BEFORE INSERT ON ${target}
     FOR EACH ROW EXECUTE FUNCTION fail_directory_recovery_boundary()`,
  )
}

async function removeFailureTrigger(sql: postgresTypes.Sql): Promise<void> {
  for (const table of [
    'directory_refresh_commits',
    'source_versions',
    'event_journal',
  ]) {
    await sql.unsafe(
      `DROP TRIGGER IF EXISTS fail_directory_recovery_boundary ON ${table}`,
    )
  }
}

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await removeFailureTrigger(sql)
  await sql.unsafe(
    'DROP FUNCTION IF EXISTS fail_directory_recovery_boundary()',
  )
  await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
  await sql.unsafe(
    `DELETE FROM directory_roots WHERE workspace_id = $1`,
    [workspaceId],
  )
  await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
}

describeIf('directory refresh restart recovery (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let root: string
  let jobLayer: Layer.Layer<DirectoryIngestionJobRepo>
  let refreshLayer: Layer.Layer<DirectorySourceVersionRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    const sqlLayer = SqlClientLive(sql)
    jobLayer = Layer.provide(DirectoryIngestionJobRepo.Default, sqlLayer)
    refreshLayer = Layer.provide(DirectorySourceVersionRepo.Default, sqlLayer)
    root = await mkdtemp(join(tmpdir(), 'struct-directory-recovery-'))
    await mkdir(join(root, 'restricted'), { recursive: true })
    await writeFile(join(root, 'restricted', 'denied.txt'), bytes)
    await cleanup(sql)
    await sql.unsafe(
      `INSERT INTO workspaces (id, name)
       VALUES ($1, 'Directory recovery workspace')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Directory recovery project')`,
      [projectId, workspaceId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await cleanup(sql)
    await sql.end()
    await rm(root, { recursive: true, force: true })
  })

  const runJob = <A, E>(
    effect: Effect.Effect<A, E, DirectoryIngestionJobRepo>,
  ) => Effect.runPromise(effect.pipe(Effect.provide(jobLayer)))
  const runRefresh = <A, E>(
    effect: Effect.Effect<A, E, DirectorySourceVersionRepo>,
  ) => effect.pipe(Effect.provide(refreshLayer))

  it('converges after every injected restart point without duplicate durable effects', async () => {
    for (const [index, boundary] of failureBoundaries.entries()) {
      const base = 100 + index * 10
      const directoryRootId = DirectoryRootId.make(uuid(base))
      const directorySourceId = SourceId.make(uuid(base + 1))
      const snapshotId = DirectorySnapshotId.make(uuid(base + 2))
      const jobId = JobQueueId.make(uuid(base + 3))
      const sourceId = SourceId.make(uuid(base + 4))
      const sourceVersionId = SourceVersionId.make(uuid(base + 5))
      const idempotencyKey = `recovery:${boundary}`

      await sql.unsafe(
        `INSERT INTO sources (id, project_id, name, kind)
         VALUES ($1, $2, $3, 'directory')`,
        [directorySourceId, projectId, `root-${boundary}`],
      )
      await sql.unsafe(
        `INSERT INTO directory_roots (
           id, workspace_id, project_id, source_id
         ) VALUES ($1, $2, $3, $4)`,
        [directoryRootId, workspaceId, projectId, directorySourceId],
      )
      await runJob(DirectoryIngestionJobRepo.create({
        jobId,
        workspaceId,
        directoryRootId,
        snapshotId,
        maxAttempts: 3,
      }))
      const claimed = await runJob(DirectoryIngestionJobRepo.claimNext(30_000))
      if (Option.isNone(claimed)) throw new Error('expected claimed recovery job')
      let activeJob = claimed.value
      const firstAttempt = activeJob.attempt
      const firstLeaseToken = activeJob.leaseToken
      const writes = new Set<string>()
      const store = artifactStore(boundary === 'artifact-persistence', writes)
      let firstDiscovery = true
      let firstHash = true
      const observations: { injectedHashPath: string | null } = {
        injectedHashPath: null,
      }
      const injectedFileSystem: DirectoryFileSystemShape = {
        ...BunDirectoryFileSystemShape,
        readDirectory: (absolutePath, relativePath) => {
          if (boundary === 'discovery' && firstDiscovery) {
            firstDiscovery = false
            return Effect.fail(new DirectoryFilesystemError({
              relativePath: '<root>',
              operation: 'read-directory',
              message: 'Injected discovery failure',
            }))
          }
          return BunDirectoryFileSystemShape.readDirectory(
            absolutePath,
            relativePath,
          )
        },
        readFile: (absolutePath, relativePath, canonicalRoot) => {
          if (boundary === 'hashing' && firstHash) {
            firstHash = false
            observations.injectedHashPath = String(relativePath)
            return Effect.fail(new DirectoryPermissionError({
              relativePath,
              operation: 'read-file',
              message: 'Injected hashing failure',
            }))
          }
          return BunDirectoryFileSystemShape.readFile(
            absolutePath,
            relativePath,
            canonicalRoot,
          )
        },
      }

      const execute = Effect.fn('DirectoryRecoveryIntegration.execute')(
        function* () {
          const manifest = yield* discoverComplete(
            root,
            directoryRootId,
            snapshotId,
            injectedFileSystem,
          )
          return yield* refreshClaimedDirectory({
            store,
            loadChangedEntry: () =>
              Effect.succeed({ bytes, mediaType: 'text/markdown' }),
            prepareChangedEntry: () =>
              Effect.succeed(prepared(manifest, sourceId, sourceVersionId)),
            commit: (input) =>
              runRefresh(DirectorySourceVersionRepo.commitRefresh(input)),
          }, {
            job: activeJob,
            idempotencyKey,
            projectId,
            previousManifest: null,
            currentManifest: manifest,
          })
        },
      )

      await installFailureTrigger(sql, boundary)
      const firstExit = await Effect.runPromiseExit(execute())
      expect(firstExit._tag, `${boundary} first attempt`).toBe('Failure')
      if (boundary === 'hashing') {
        expect(observations.injectedHashPath).toBe('restricted/denied.txt')
      }
      await removeFailureTrigger(sql)
      await sql.unsafe(
        `UPDATE job_queue
         SET lease_expires_at = NOW() - INTERVAL '1 second'
         WHERE id = $1`,
        [jobId],
      )
      expect(
        await runJob(DirectoryIngestionJobRepo.recoverExpired()),
        `${boundary} expired recovery`,
      ).toEqual({ requeued: 1, exhausted: 0 })
      const reclaimed = await runJob(
        DirectoryIngestionJobRepo.claimNext(30_000),
      )
      if (Option.isNone(reclaimed)) {
        throw new Error(`expected reclaimed ${boundary} recovery job`)
      }
      activeJob = reclaimed.value
      expect(activeJob.attempt, `${boundary} reclaimed attempt`).toBe(
        firstAttempt + 1,
      )
      expect(
        activeJob.leaseToken === firstLeaseToken,
        `${boundary} reclaimed lease`,
      ).toBe(false)

      const beforeRetry = await sql.unsafe(
        `SELECT
           (SELECT COUNT(*)::int FROM directory_snapshots
            WHERE id = $1) AS manifests,
           (SELECT COUNT(*)::int FROM source_versions
            WHERE id = $2) AS versions,
           (SELECT COUNT(*)::int FROM event_journal
            WHERE entity_id = $3
              AND event_type = 'directory-refresh-committed') AS events,
           (SELECT COUNT(*)::int FROM directory_refresh_commits
            WHERE job_id = $3) AS checkpoints`,
        [snapshotId, sourceVersionId, jobId],
      )
      expect(beforeRetry[0], `${boundary} rollback`).toMatchObject({
        manifests: 0,
        versions: 0,
        events: 0,
        checkpoints: 0,
      })

      const committed = await Effect.runPromise(execute())
      expect(committed, `${boundary} retry`).toMatchObject({
        _tag: 'Committed',
        result: {
          added: 1,
          modified: 0,
          unchanged: 0,
          removed: 0,
          unsupported: 0,
        },
      })
      const replayed = await Effect.runPromise(execute())
      expect(replayed, `${boundary} replay`).toMatchObject({
        _tag: 'Replayed',
      })

      const converged = await sql.unsafe(
        `SELECT
           (SELECT COUNT(*)::int FROM directory_snapshots
            WHERE id = $1) AS manifests,
           (SELECT COUNT(*)::int FROM source_versions
            WHERE id = $2) AS versions,
           (SELECT COUNT(*)::int FROM event_journal
            WHERE entity_id = $3
              AND event_type = 'directory-refresh-committed') AS events,
           (SELECT COUNT(*)::int FROM directory_refresh_commits
            WHERE job_id = $3) AS checkpoints,
           (SELECT next_checkpoint_sequence::int
            FROM directory_ingestion_jobs WHERE job_id = $3) AS next_sequence`,
        [snapshotId, sourceVersionId, jobId],
      )
      expect(converged[0], `${boundary} convergence`).toMatchObject({
        manifests: 1,
        versions: 1,
        events: 1,
        checkpoints: 1,
        next_sequence: 2,
      })
      expect(writes.size, `${boundary} unique artifacts`).toBe(1)
      await runJob(
        DirectoryIngestionJobRepo.transition(jobId, workspaceId, 'complete'),
      )
    }
  })
})
