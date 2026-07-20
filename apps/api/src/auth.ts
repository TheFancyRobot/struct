import { timingSafeEqual } from 'node:crypto'
import { Effect, Redacted, Schema } from 'effect'
import type { WorkspaceId } from '@struct/domain'

export interface ApiIdentity {
  readonly workspaceId: typeof WorkspaceId.Type
}

export class ApiAuthenticationError
  extends Schema.TaggedError<ApiAuthenticationError>()(
    'ApiAuthenticationError',
    { message: Schema.String },
  ) {}

export class ApiAuthorizationError
  extends Schema.TaggedError<ApiAuthorizationError>()(
    'ApiAuthorizationError',
    { message: Schema.String },
  ) {}

export function isPublicApiRequest(request: Request): boolean {
  const url = new URL(request.url)
  return request.method === 'GET' && url.pathname === '/healthz'
}

function credentialMatches(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(actual)
  return expectedBytes.length === actualBytes.length
    && timingSafeEqual(expectedBytes, actualBytes)
}

function bearerCredential(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')
  if (
    authorization === null
    || !authorization.startsWith('Bearer ')
    || authorization.length <= 'Bearer '.length
  ) return undefined
  return authorization.slice('Bearer '.length)
}

export const authenticateApiRequest = Effect.fn('ApiAuth.authenticateRequest')(
  function* (
    request: Request,
    expectedCredential: Redacted.Redacted<string>,
    workspaceId: typeof WorkspaceId.Type,
  ) {
    const actual = bearerCredential(request)
    if (
      actual === undefined
      || !credentialMatches(Redacted.value(expectedCredential), actual)
    ) {
      return yield* new ApiAuthenticationError({
        message: 'API authentication failed',
      })
    }
    return { workspaceId } satisfies ApiIdentity
  },
)

export const authenticateApiCredential = Effect.fn(
  'ApiAuth.authenticateCredential',
)(function* (
  actual: string,
  expectedCredential: Redacted.Redacted<string>,
  workspaceId: typeof WorkspaceId.Type,
) {
  if (!credentialMatches(Redacted.value(expectedCredential), actual)) {
    return yield* new ApiAuthenticationError({
      message: 'API authentication failed',
    })
  }
  return { workspaceId } satisfies ApiIdentity
})

export const authorizeWorkspace = Effect.fn('ApiAuth.authorizeWorkspace')(
  function* (
    identity: ApiIdentity,
    requestedWorkspaceId: typeof WorkspaceId.Type,
  ) {
    if (identity.workspaceId !== requestedWorkspaceId) {
      return yield* new ApiAuthorizationError({
        message: 'Resource scope is not authorized',
      })
    }
  },
)
