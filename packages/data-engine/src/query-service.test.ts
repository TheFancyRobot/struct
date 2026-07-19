import {
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
} from '@struct/domain'
import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  DatasetQueryAuthenticationError,
  DatasetQueryAuthorizationError,
  DatasetQueryCatalogError,
  makeReadOnlySqlService,
} from './query-service.js'
import type { QueryRequest } from './protocol.js'

const workspaceId = WorkspaceId.make('650e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('650e8400-e29b-41d4-a716-446655440002')
const datasetId = DatasetId.make('650e8400-e29b-41d4-a716-446655440003')
const snapshotId = DatasetSnapshotId.make('650e8400-e29b-41d4-a716-446655440004')
const schemaHash = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const parquetDigest = 'b'.repeat(64)
const input = {
  credential: 'user-session-credential',
  workspaceId,
  projectId,
  sql: 'SELECT id FROM records ORDER BY id',
  snapshots: [{ alias: 'records', datasetId, snapshotId }],
  limits: {
    maxRows: 100,
    maxOutputBytes: 10_000,
    maxMemoryMb: 64,
    timeoutMs: 1_000,
  },
}

function dependencies(overrides?: {
  readonly authenticate?: () => Effect.Effect<
    { readonly userId: string },
    DatasetQueryAuthenticationError
  >
  readonly authorize?: () => Effect.Effect<
    void,
    DatasetQueryAuthorizationError
  >
  readonly resolve?: () => Effect.Effect<
    ReadonlyArray<{
      readonly alias: 'records'
      readonly datasetId: typeof datasetId
      readonly snapshotId: typeof snapshotId
      readonly schemaHash: typeof schemaHash
      readonly parquetDigest: string
    }>,
    DatasetQueryCatalogError
  >
  readonly onQuery?: () => void
}) {
  return {
    authorization: {
      authenticate: overrides?.authenticate
        ?? (() => Effect.succeed({ userId: 'user-1' })),
      authorize: overrides?.authorize ?? (() => Effect.void),
    },
    catalog: {
      resolve: overrides?.resolve ?? (() => Effect.succeed([{
        alias: 'records' as const,
        datasetId,
        snapshotId,
        schemaHash,
        parquetDigest,
      }])),
    },
    client: {
      materialize: () => Effect.die('materialize must not run'),
      readArtifact: () => Effect.die('artifact read must not run'),
      query: (request: QueryRequest) => {
        overrides?.onQuery?.()
        return Effect.succeed({
          protocolVersion: '1' as const,
          engineVersion: 'duckdb-1.5.4',
          engineConfigHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
          workspaceId,
          projectId,
          canonicalSql: input.sql,
          snapshots: request.snapshots,
          schemaHash,
          resultHash: Sha256Digest.make(`sha256:${'c'.repeat(64)}`),
          resultArtifactHash: Sha256Digest.make(`sha256:${'e'.repeat(64)}`),
          columns: [{ ordinal: 0, name: 'id', type: 'BIGINT' }],
          rows: [['1']],
          rowCount: 1,
          truncated: false,
          executionMs: 1,
        })
      },
    },
  }
}

describe('ReadOnlySqlService', () => {
  it('authenticates and authorizes before resolving scoped catalog aliases', async () => {
    let queried = 0
    const service = makeReadOnlySqlService(dependencies({
      onQuery: () => {
        queried += 1
      },
    }))
    const result = await Effect.runPromise(service.execute(input))
    expect(result.rows).toEqual([['1']])
    expect(result.snapshots).toEqual([{
      alias: 'records',
      datasetId,
      snapshotId,
      schemaHash,
      parquetDigest,
    }])
    expect(queried).toBe(1)
  })

  it('fails missing and invalid user authentication before catalog or execution', async () => {
    let resolved = 0
    let queried = 0
    const service = makeReadOnlySqlService(dependencies({
      authenticate: () => Effect.fail(new DatasetQueryAuthenticationError({
        message: 'Invalid user credential',
      })),
      resolve: () => {
        resolved += 1
        return Effect.die('catalog must not run')
      },
      onQuery: () => {
        queried += 1
      },
    }))
    for (const candidate of [
      { ...input, credential: undefined },
      { ...input, credential: 'invalid' },
    ]) {
      const exit = await Effect.runPromiseExit(service.execute(candidate))
      expect(exit._tag).toBe('Failure')
      expect(String(exit)).toContain('DatasetQueryAuthenticationError')
    }
    expect(resolved).toBe(0)
    expect(queried).toBe(0)
  })

  it('stops authorization and cross-workspace catalog failures before execution', async () => {
    let queried = 0
    const unauthorized = makeReadOnlySqlService(dependencies({
      authorize: () => Effect.fail(new DatasetQueryAuthorizationError({
        message: 'Workspace access denied',
      })),
      onQuery: () => {
        queried += 1
      },
    }))
    const unauthorizedExit = await Effect.runPromiseExit(
      unauthorized.execute(input),
    )
    expect(String(unauthorizedExit)).toContain('DatasetQueryAuthorizationError')

    const foreign = makeReadOnlySqlService(dependencies({
      resolve: () => Effect.fail(new DatasetQueryCatalogError({
        message: 'Snapshot is outside the authorized workspace',
      })),
      onQuery: () => {
        queried += 1
      },
    }))
    const foreignExit = await Effect.runPromiseExit(foreign.execute(input))
    expect(String(foreignExit)).toContain('DatasetQueryCatalogError')
    expect(queried).toBe(0)
  })
})
