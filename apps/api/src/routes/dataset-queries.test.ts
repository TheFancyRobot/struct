import {
  DatasetQueryEvidenceScopeError,
} from '@struct/persistence'
import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { datasetQueryReadRoute } from './dataset-queries'

const workspaceId = '870e8400-e29b-41d4-a716-446655440001'
const projectId = '870e8400-e29b-41d4-a716-446655440002'
const citationId = '870e8400-e29b-41d4-a716-446655440003'

describe('dataset query HTTP read routes', () => {
  it('routes bounded metadata-only history with parsed scope and limit', async () => {
    let received: ReadonlyArray<unknown> = []
    const response = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        `http://localhost/api/projects/${projectId}/dataset-queries`
        + `?workspaceId=${workspaceId}&limit=3`,
      ),
      {
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

  it('maps invalid identifiers and out-of-scope citations without invoking unrelated routes', async () => {
    let listed = false
    const invalid = await Effect.runPromise(datasetQueryReadRoute(
      new Request(
        'http://localhost/api/projects/not-a-uuid/dataset-queries',
      ),
      {
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
      ),
      {
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
})
