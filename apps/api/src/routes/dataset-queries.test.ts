import {
  DatasetQueryEvidencePersistenceError,
  DatasetQueryEvidenceScopeError,
} from '@struct/persistence'
import { DatasetQueryAuthorizationError } from '@struct/data-engine'
import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { datasetQueryReadRoute } from './dataset-queries'

const workspaceId = '870e8400-e29b-41d4-a716-446655440001'
const projectId = '870e8400-e29b-41d4-a716-446655440002'
const citationId = '870e8400-e29b-41d4-a716-446655440003'
const authorization = { authorization: 'Bearer test-api-credential' }

describe('dataset query HTTP read routes', () => {
  it('routes bounded metadata-only history with parsed scope and limit', async () => {
    let received: ReadonlyArray<unknown> = []
    const response = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/dataset-queries`
        + `?workspaceId=${workspaceId}&limit=3`,
        { headers: authorization },
      ),
      {
        authorize: (credential, workspace, project) => {
          expect([credential, workspace, project]).toEqual([
            'test-api-credential',
            workspaceId,
            projectId,
          ])
          return Effect.void
        },
        list: (workspace, project, limit) => {
          received = [workspace, project, limit]
          return Effect.succeed([])
        },
        reopen: () => Effect.die('citation route must not run'),
      },
    ))
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual([])
    expect(received).toEqual([workspaceId, projectId, 3])
  })

  it('rejects invalid history limits before repository access', async () => {
    for (const limit of ['', 'not-a-number', '-1', '0', '1.5', '101']) {
      let authorized = false
      let listed = false
      const response = await Effect.runPromise(datasetQueryReadRoute(
        new Request(
          `http://localhost/api/projects/${projectId}/dataset-queries`
          + `?workspaceId=${workspaceId}&limit=${encodeURIComponent(limit)}`,
        { headers: authorization },
      ),
      {
          authorize: () => {
            authorized = true
            return Effect.void
          },
          list: () => {
            listed = true
            return Effect.succeed([])
          },
          reopen: () => Effect.die('citation route must not run'),
        },
      ))
      expect(response?.status).toBe(400)
      expect(await response?.json()).toEqual({
        error: 'InvalidDatasetQueryHistoryRequest',
      })
      expect(authorized).toBe(false)
      expect(listed).toBe(false)
    }
  })

  it('maps invalid identifiers and out-of-scope citations without invoking unrelated routes', async () => {
    let listed = false
    const invalid = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        'http://localhost/api/projects/not-a-uuid/dataset-queries',
      ),
      {
        authorize: () => Effect.void,
        list: () => {
          listed = true
          return Effect.succeed([])
        },
        reopen: () => Effect.die('citation route must not run'),
      },
    ))
    expect(invalid?.status).toBe(400)
    expect(listed).toBe(false)

    const missing = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}`
        + `/dataset-citations/${citationId}?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      {
        authorize: () => Effect.void,
        list: () => Effect.die('history route must not run'),
        reopen: (_workspace, _project, id) =>
          Effect.fail(new DatasetQueryEvidenceScopeError({
            entity: 'citation',
            id,
            message: 'not found',
          })),
      },
    ))
    expect(missing?.status).toBe(404)
    expect(await missing?.json()).toEqual({
      error: 'DatasetCitationNotFound',
    })
  })

  it('does not claim unrelated paths or non-GET methods', async () => {
    const dependencies = {
      authorize: () => Effect.void,
      list: () => Effect.die('must not run'),
      reopen: () => Effect.die('must not run'),
    }
    expect(await Effect.runPromise(datasetQueryReadRoute(
      new Request('http://localhost/healthz'),
      dependencies,
    ))).toBeUndefined()
    expect(await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/dataset-queries`,
        { method: 'POST' },
      ),
      dependencies,
    ))).toBeUndefined()
  })

  it('requires authentication and authorization before any repository read', async () => {
    let read = false
    const unauthenticated = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}`
        + `/dataset-citations/${citationId}?workspaceId=${workspaceId}`,
      ),
      {
        authorize: () => Effect.die('must not authorize without a credential'),
        list: () => Effect.die('history route must not run'),
        reopen: () => {
          read = true
          return Effect.die('must not read')
        },
      },
    ))
    expect(unauthenticated?.status).toBe(401)
    expect(read).toBe(false)

    const forbidden = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}`
        + `/dataset-citations/${citationId}?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      {
        authorize: () => Effect.fail(new DatasetQueryAuthorizationError({
          message: 'forbidden',
        })),
        list: () => Effect.die('history route must not run'),
        reopen: () => {
          read = true
          return Effect.die('must not read')
        },
      },
    ))
    expect(forbidden?.status).toBe(404)
    expect(await forbidden?.json()).toEqual({ error: 'DatasetQueryNotFound' })
    expect(read).toBe(false)
  })

  it('returns a generic 503 for history persistence failures without leaking details', async () => {
    const response = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/dataset-queries`
        + `?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      {
        authorize: () => Effect.void,
        list: () => Effect.fail(new DatasetQueryEvidencePersistenceError({
          operation: 'history',
          message: "history failed: SELECT * FROM secrets WHERE password = 'top-secret' /Users/private/PATH_MARKER",
        })),
        reopen: () => Effect.die('citation route must not run'),
      },
    ))

    expect(response?.status).toBe(503)
    const body = await response?.json()
    expect(body).toEqual({ error: 'DatasetQueryHistoryUnavailable' })
    expect(JSON.stringify(body)).not.toContain('top-secret')
    expect(JSON.stringify(body)).not.toContain('PATH_MARKER')
  })

  it('returns a generic 503 for citation persistence failures without leaking details', async () => {
    const response = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}`
        + `/dataset-citations/${citationId}?workspaceId=${workspaceId}`,
        { headers: authorization },
      ),
      {
        authorize: () => Effect.void,
        list: () => Effect.die('history route must not run'),
        reopen: () => Effect.fail(new DatasetQueryEvidencePersistenceError({
          operation: 'citation reopen',
          message: 'citation failed: postgres://db-user:db-pass@db.internal/struct /Users/private/PATH_MARKER',
        })),
      },
    ))

    expect(response?.status).toBe(503)
    const body = await response?.json()
    expect(body).toEqual({ error: 'DatasetCitationUnavailable' })
    expect(JSON.stringify(body)).not.toContain('db-pass')
    expect(JSON.stringify(body)).not.toContain('PATH_MARKER')
  })
})
