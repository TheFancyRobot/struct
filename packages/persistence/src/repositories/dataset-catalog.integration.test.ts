import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DatasetId,
  DatasetSchemaFamilyId,
  DatasetSnapshotId,
  ProjectId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
  type DatasetAsset,
  type DatasetSchemaFamily,
  type DatasetSnapshot,
} from '@struct/domain'
import { Effect, Exit, Layer, Option } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  DatasetCatalogRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('720e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('720e8400-e29b-41d4-a716-446655440001')
const foreignWorkspaceId = WorkspaceId.make('720e8400-e29b-41d4-a716-446655440002')
const foreignProjectId = ProjectId.make('720e8400-e29b-41d4-a716-446655440003')
const sourceId = SourceId.make('720e8400-e29b-41d4-a716-446655440004')
const sourceVersionId = SourceVersionId.make('720e8400-e29b-41d4-a716-446655440005')
const foreignSourceId = SourceId.make('720e8400-e29b-41d4-a716-446655440006')
const foreignSourceVersionId = SourceVersionId.make('720e8400-e29b-41d4-a716-446655440007')
const datasetId = DatasetId.make('720e8400-e29b-41d4-a716-446655440008')
const familyId = DatasetSchemaFamilyId.make('720e8400-e29b-41d4-a716-446655440009')
const firstSnapshotId = DatasetSnapshotId.make('720e8400-e29b-41d4-a716-446655440010')
const secondSnapshotId = DatasetSnapshotId.make('720e8400-e29b-41d4-a716-446655440011')
const failedSnapshotId = DatasetSnapshotId.make('720e8400-e29b-41d4-a716-446655440012')
const sourceHash = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const schemaHash = Sha256Digest.make(`sha256:${'b'.repeat(64)}`)
const firstSnapshotHash = Sha256Digest.make(`sha256:${'c'.repeat(64)}`)
const secondSnapshotHash = Sha256Digest.make(`sha256:${'d'.repeat(64)}`)
const createdAt = 1_750_000_000_000n

const dataset: DatasetAsset = {
  id: datasetId,
  workspaceId,
  projectId,
  name: 'Revenue',
  lifecycleStatus: 'active',
  createdAt,
}
const family: DatasetSchemaFamily = {
  id: familyId,
  datasetId,
  workspaceId,
  projectId,
  schemaHash,
  fields: [
    {
      ordinal: 0,
      name: 'account',
      sourceType: 'string',
      logicalType: 'string',
      nullable: false,
    },
    {
      ordinal: 1,
      name: 'amount',
      sourceType: 'number',
      logicalType: 'decimal',
      nullable: true,
    },
  ],
  createdAt,
}
const firstSnapshot: DatasetSnapshot = {
  id: firstSnapshotId,
  datasetId,
  workspaceId,
  projectId,
  version: 1,
  schemaFamilyId: familyId,
  previousSnapshotId: Option.none(),
  contentHash: firstSnapshotHash,
  sources: [{ ordinal: 0, sourceId, sourceVersionId, contentHash: sourceHash }],
  createdAt,
}

describeIf('DatasetCatalogRepo (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<DatasetCatalogRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    layer = Layer.provide(DatasetCatalogRepo.Default, SqlClientLive(sql))
    await sql.unsafe('DELETE FROM workspaces WHERE id = ANY($1::uuid[])', [[workspaceId, foreignWorkspaceId]])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name)
       VALUES ($1, 'Catalog'), ($2, 'Foreign')`,
      [workspaceId, foreignWorkspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Catalog'), ($3, $4, 'Foreign')`,
      [projectId, workspaceId, foreignProjectId, foreignWorkspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'Rows', 'dataset'), ($3, $4, 'Foreign rows', 'dataset')`,
      [sourceId, projectId, foreignSourceId, foreignProjectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, $5, $6), ($3, $4, 1, $5, $6)`,
      [
        sourceVersionId,
        sourceId,
        foreignSourceVersionId,
        foreignSourceId,
        `artifact://sha256/${'a'.repeat(64)}`,
        sourceHash,
      ],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe('DELETE FROM workspaces WHERE id = ANY($1::uuid[])', [[workspaceId, foreignWorkspaceId]])
    await sql.end()
  })

  const run = <A, E>(effect: Effect.Effect<A, E, DatasetCatalogRepo>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))

  it('creates and idempotently replays dataset and schema-family aggregates', async () => {
    const createdDataset = await run(DatasetCatalogRepo.createDataset(dataset))
    expect(createdDataset).toEqual({ value: dataset, replayed: false })
    expect(await run(DatasetCatalogRepo.createDataset(dataset))).toEqual({
      value: dataset,
      replayed: true,
    })

    const createdFamily = await run(DatasetCatalogRepo.createSchemaFamily(family))
    expect(createdFamily.value).toEqual(family)
    expect(createdFamily.replayed).toBe(false)
    expect((await run(DatasetCatalogRepo.createSchemaFamily(family))).replayed).toBe(true)

    const conflictingFamily = await Effect.runPromiseExit(
      DatasetCatalogRepo.createSchemaFamily({
        ...family,
        id: DatasetSchemaFamilyId.make('720e8400-e29b-41d4-a716-446655440017'),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(conflictingFamily)).toBe(true)
    if (Exit.isFailure(conflictingFamily)) {
      expect(String(conflictingFamily.cause)).toContain('DatasetCatalogConflictError')
    }

    const conflictingFamilyId = await Effect.runPromiseExit(
      DatasetCatalogRepo.createSchemaFamily({
        ...family,
        schemaHash: Sha256Digest.make(`sha256:${'9'.repeat(64)}`),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(conflictingFamilyId)).toBe(true)
    if (Exit.isFailure(conflictingFamilyId)) {
      expect(String(conflictingFamilyId.cause)).toContain('DatasetCatalogConflictError')
    }
  })

  it('creates immutable snapshots and lists them in version order', async () => {
    expect((await run(DatasetCatalogRepo.createSnapshot(firstSnapshot))).replayed).toBe(false)
    expect((await run(DatasetCatalogRepo.createSnapshot(firstSnapshot))).replayed).toBe(true)
    const secondSnapshot: DatasetSnapshot = {
      ...firstSnapshot,
      id: secondSnapshotId,
      version: 2,
      previousSnapshotId: Option.some(firstSnapshotId),
      contentHash: secondSnapshotHash,
    }
    await run(DatasetCatalogRepo.createSnapshot(secondSnapshot))
    const snapshots = await run(
      DatasetCatalogRepo.listSnapshots(workspaceId, projectId, datasetId),
    )
    expect(snapshots.map((snapshot) => snapshot.version)).toEqual([1, 2])
    expect(snapshots[1]).toEqual(secondSnapshot)

    const conflictingSnapshot = await Effect.runPromiseExit(
      DatasetCatalogRepo.createSnapshot({
        ...secondSnapshot,
        id: DatasetSnapshotId.make('720e8400-e29b-41d4-a716-446655440018'),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(conflictingSnapshot)).toBe(true)
    if (Exit.isFailure(conflictingSnapshot)) {
      expect(String(conflictingSnapshot.cause)).toContain('DatasetCatalogConflictError')
    }

    const conflictingSnapshotId = await Effect.runPromiseExit(
      DatasetCatalogRepo.createSnapshot({
        ...firstSnapshot,
        contentHash: Sha256Digest.make(`sha256:${'8'.repeat(64)}`),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(conflictingSnapshotId)).toBe(true)
    if (Exit.isFailure(conflictingSnapshotId)) {
      expect(String(conflictingSnapshotId.cause)).toContain('DatasetCatalogConflictError')
    }

    const immutableUpdate = await Effect.runPromiseExit(Effect.tryPromise({
      try: () => sql.unsafe(
        'UPDATE dataset_snapshots SET content_hash = $1 WHERE id = $2',
        [sourceHash, firstSnapshotId],
      ),
      catch: () => 'immutable-update-rejected',
    }))
    expect(Exit.isFailure(immutableUpdate)).toBe(true)
  })

  it('rejects foreign-workspace lineage and rolls back the parent snapshot', async () => {
    const result = await Effect.runPromiseExit(
      DatasetCatalogRepo.createSnapshot({
        ...firstSnapshot,
        id: failedSnapshotId,
        version: 3,
        previousSnapshotId: Option.some(secondSnapshotId),
        contentHash: Sha256Digest.make(`sha256:${'e'.repeat(64)}`),
        sources: [{
          ordinal: 0,
          sourceId: foreignSourceId,
          sourceVersionId: foreignSourceVersionId,
          contentHash: sourceHash,
        }],
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(String(result.cause)).toContain('DatasetCatalogScopeError')
    }
    expect(await sql.unsafe(
      'SELECT id FROM dataset_snapshots WHERE id = $1',
      [failedSnapshotId],
    )).toHaveLength(0)
  })

  it('rejects every foreign-workspace catalog reference with typed failures', async () => {
    const foreignDataset = await Effect.runPromiseExit(
      DatasetCatalogRepo.createDataset({
        ...dataset,
        id: DatasetId.make('720e8400-e29b-41d4-a716-446655440013'),
        projectId: foreignProjectId,
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(foreignDataset)).toBe(true)

    const foreignFamily = await Effect.runPromiseExit(
      DatasetCatalogRepo.createSchemaFamily({
        ...family,
        id: DatasetSchemaFamilyId.make('720e8400-e29b-41d4-a716-446655440014'),
        workspaceId: foreignWorkspaceId,
        projectId: foreignProjectId,
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(foreignFamily)).toBe(true)

    const foreignPreviousId =
      DatasetSnapshotId.make('720e8400-e29b-41d4-a716-446655440015')
    const foreignPrevious = await Effect.runPromiseExit(
      DatasetCatalogRepo.createSnapshot({
        ...firstSnapshot,
        id: DatasetSnapshotId.make('720e8400-e29b-41d4-a716-446655440016'),
        version: 3,
        previousSnapshotId: Option.some(foreignPreviousId),
        contentHash: Sha256Digest.make(`sha256:${'f'.repeat(64)}`),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(foreignPrevious)).toBe(true)
    if (Exit.isFailure(foreignPrevious)) {
      expect(String(foreignPrevious.cause)).toContain('DatasetCatalogScopeError')
    }
  })

  it('returns empty results for cross-workspace reads', async () => {
    expect(await run(
      DatasetCatalogRepo.listSnapshots(foreignWorkspaceId, foreignProjectId, datasetId),
    )).toEqual([])
  })
})
