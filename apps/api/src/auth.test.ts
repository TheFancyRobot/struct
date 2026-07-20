import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Redacted } from 'effect'
import { WorkspaceId } from '@struct/domain'
import {
  ApiAuthenticationError,
  ApiAuthorizationError,
  authenticateApiRequest,
  authorizeWorkspace,
  isPublicApiRequest,
} from './auth'

const workspaceId = WorkspaceId.make('910e8400-e29b-41d4-a716-446655440000')
const otherWorkspaceId = WorkspaceId.make('910e8400-e29b-41d4-a716-446655440001')
const credential = Redacted.make('production-test-token')

describe('API identity boundary', () => {
  it('keeps only the liveness probe public across the reachable route inventory', () => {
    const protectedRequests = [
      ['GET', '/metrics'],
      ['POST', '/api/projects/project/directories'],
      ['GET', '/api/projects/project/directory-jobs/job'],
      ['POST', '/api/projects/project/directory-jobs/job/pause'],
      ['GET', '/api/projects/project/directory-jobs/job/events'],
      ['POST', '/api/projects/project/sources'],
      ['POST', '/api/projects/project/research'],
      ['GET', '/api/projects/project/runs/run/events'],
      ['POST', '/api/projects/project/runs/run/cancel'],
      ['GET', '/api/projects/project/runs/run/recursive-analysis'],
      ['GET', '/api/projects/project/research/thread/citation/citation'],
      ['GET', '/api/projects/project/dataset-queries'],
      ['GET', '/api/projects/project/findings'],
      ['GET', '/api/projects/project/reports/report/export'],
    ] as const
    expect(isPublicApiRequest(new Request('http://localhost/healthz'))).toBe(true)
    for (const [method, path] of protectedRequests) {
      expect(isPublicApiRequest(new Request(`http://localhost${path}`, {
        method,
      }))).toBe(false)
    }
  })

  it('authenticates a bearer credential without exposing it in the identity', async () => {
    const identity = await Effect.runPromise(authenticateApiRequest(
      new Request('http://localhost/api/projects/project', {
        headers: { authorization: 'Bearer production-test-token' },
      }),
      credential,
      workspaceId,
    ))

    expect(identity).toEqual({ workspaceId })
    expect(JSON.stringify(identity)).not.toContain('production-test-token')
  })

  it('rejects missing, malformed, empty, and invalid credentials uniformly', async () => {
    for (const authorization of [
      undefined,
      'Basic production-test-token',
      'Bearer ',
      'Bearer invalid-production-token',
    ]) {
      const headers = new Headers()
      if (authorization !== undefined) headers.set('authorization', authorization)
      const exit = await Effect.runPromiseExit(authenticateApiRequest(
        new Request('http://localhost/api/projects/project', { headers }),
        credential,
        workspaceId,
      ))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(exit.cause.toString()).toContain(ApiAuthenticationError.name)
        expect(exit.cause.toString()).not.toContain('production-test-token')
      }
    }
  })

  it('fails closed when an authenticated identity requests another workspace', async () => {
    const identity = { workspaceId }
    const allowed = await Effect.runPromiseExit(
      authorizeWorkspace(identity, workspaceId),
    )
    const denied = await Effect.runPromiseExit(
      authorizeWorkspace(identity, otherWorkspaceId),
    )

    expect(Exit.isSuccess(allowed)).toBe(true)
    expect(Exit.isFailure(denied)).toBe(true)
    if (Exit.isFailure(denied)) {
      expect(denied.cause.toString()).toContain(ApiAuthorizationError.name)
      expect(denied.cause.toString()).not.toContain(otherWorkspaceId)
    }
  })
})
