import { Cause, Effect, Option, Schema } from 'effect'
import type { InferenceRole, InferenceSettings } from '@struct/persistence'
import { isSupportedInferenceProviderCredentialReference } from '@struct/workflows'

const Role = Schema.Literal('chat', 'embedding', 'vision')
const NonBlank = Schema.String.pipe(Schema.trimmed(), Schema.minLength(1), Schema.maxLength(256))
const ProviderType = Schema.Literal('@fancyrobot/fred-openai')
const isSecureEndpoint = (value: string): boolean => {
  if (value === '') return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
const Endpoint = Schema.String.pipe(
  Schema.trimmed(),
  Schema.filter(isSecureEndpoint, {
    message: () => 'Endpoint must use https',
  }),
  Schema.maxLength(2048),
)
const CredentialReference = NonBlank.pipe(Schema.filter(
  isSupportedInferenceProviderCredentialReference,
  { message: () => 'Credential reference must name a supported provider key' },
))
const ProviderRequest = Schema.Struct({
  type: ProviderType,
  endpoint: Schema.optional(Schema.NullOr(Endpoint)),
  credentialReference: CredentialReference,
})
const ProviderUpdateRequest = Schema.Struct({
  type: ProviderType,
  endpoint: Schema.optional(Schema.NullOr(Endpoint)),
  credentialReference: Schema.optional(CredentialReference),
})
const EnabledRequest = Schema.Struct({ enabled: Schema.Boolean })
const ModelRequest = Schema.Struct({
  providerId: Schema.UUID,
  name: NonBlank,
  capabilities: Schema.Array(Role).pipe(Schema.minItems(1), Schema.maxItems(3)),
})
const AssignmentRequest = Schema.Struct({ modelId: Schema.UUID })

const nullableEndpoint = (endpoint: string | null | undefined): string | null => {
  const normalized = endpoint?.trim()
  return normalized === undefined || normalized === '' ? null : normalized
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status })
}

function body(request: Request) {
  return Effect.tryPromise({ try: () => request.json(), catch: () => new Error('invalid-json') })
}

export interface InferenceSettingsRouteDeps {
  readonly list: (workspaceId: string) => Effect.Effect<InferenceSettings, unknown>
  readonly createProvider: (input: { id: string, workspaceId: string, type: string, endpoint: string | null, credentialReference: string }) => Effect.Effect<unknown, unknown>
  readonly updateProvider: (input: { id: string, workspaceId: string, type: string, endpoint: string | null, credentialReference: string | null }) => Effect.Effect<unknown, unknown>
  readonly setProviderEnabled: (input: { id: string, workspaceId: string, enabled: boolean }) => Effect.Effect<unknown, unknown>
  readonly deleteProvider: (input: { id: string, workspaceId: string }) => Effect.Effect<unknown, unknown>
  /** Server-only boundary: implementations resolve the stored credential themselves. */
  readonly testProvider: (input: { id: string, workspaceId: string }) => Effect.Effect<{ readonly ok: boolean, readonly message: string }, unknown>
  readonly createModel: (input: { id: string, workspaceId: string, providerId: string, name: string, capabilities: ReadonlyArray<InferenceRole> }) => Effect.Effect<unknown, unknown>
  readonly assign: (input: { workspaceId: string, role: InferenceRole, modelId: string }) => Effect.Effect<unknown, unknown>
  readonly clearAssignment: (input: { workspaceId: string, role: InferenceRole }) => Effect.Effect<unknown, unknown>
  readonly randomId: () => string
}

export const inferenceSettingsRoute = Effect.fn('InferenceSettingsRoute.route')(function* (
  request: Request,
  workspaceId: string,
  deps: InferenceSettingsRouteDeps,
) {
  const path = new URL(request.url).pathname
  if (path === '/api/settings/inference' && request.method === 'GET') {
    return yield* deps.list(workspaceId).pipe(Effect.map((settings) => response({
      providers: settings.providers.map(({ id, type, endpoint, enabled, hasCredential }) => ({ id, type, endpoint, enabled, hasCredential })),
      models: settings.models,
      assignments: settings.assignments,
    })))
  }
  if (path === '/api/settings/inference/providers' && request.method === 'POST') {
    const input = yield* body(request).pipe(Effect.flatMap(Schema.decodeUnknown(ProviderRequest)))
    yield* deps.createProvider({ id: deps.randomId(), workspaceId, type: input.type, endpoint: nullableEndpoint(input.endpoint), credentialReference: input.credentialReference })
    return response({ ok: true }, 201)
  }
  if (path === '/api/settings/inference/models' && request.method === 'POST') {
    const input = yield* body(request).pipe(Effect.flatMap(Schema.decodeUnknown(ModelRequest)))
    const settings = yield* deps.list(workspaceId)
    if (!settings.providers.some((provider) => provider.id === input.providerId && provider.enabled)) {
      return response({ error: 'ProviderUnavailable' }, 409)
    }
    yield* deps.createModel({ id: deps.randomId(), workspaceId, providerId: input.providerId, name: input.name, capabilities: input.capabilities })
    return response({ ok: true }, 201)
  }
  const provider = /^\/api\/settings\/inference\/providers\/([0-9a-f-]{36})$/.exec(path)
  if (provider !== null && request.method === 'PUT') {
    const input = yield* body(request).pipe(Effect.flatMap(Schema.decodeUnknown(ProviderUpdateRequest)))
    yield* deps.updateProvider({ id: provider[1]!, workspaceId, type: input.type, endpoint: nullableEndpoint(input.endpoint), credentialReference: input.credentialReference ?? null })
    return response({ ok: true })
  }
  if (provider !== null && request.method === 'DELETE') {
    yield* deps.deleteProvider({ id: provider[1]!, workspaceId })
    return response({ ok: true })
  }
  const enabled = /^\/api\/settings\/inference\/providers\/([0-9a-f-]{36})\/enabled$/.exec(path)
  if (enabled !== null && request.method === 'PUT') {
    const input = yield* body(request).pipe(Effect.flatMap(Schema.decodeUnknown(EnabledRequest)))
    yield* deps.setProviderEnabled({ id: enabled[1]!, workspaceId, enabled: input.enabled })
    return response({ ok: true })
  }
  const test = /^\/api\/settings\/inference\/providers\/([0-9a-f-]{36})\/test$/.exec(path)
  if (test !== null && request.method === 'POST') {
    return response(yield* deps.testProvider({ id: test[1]!, workspaceId }))
  }
  const assignment = /^\/api\/settings\/inference\/assignments\/(chat|embedding|vision)$/.exec(path)
  if (assignment !== null && request.method === 'PUT') {
    const input = yield* body(request).pipe(Effect.flatMap(Schema.decodeUnknown(AssignmentRequest)))
    const settings = yield* deps.list(workspaceId)
    const model = settings.models.find((item) => item.id === input.modelId)
    const role = assignment[1] as InferenceRole
    if (model === undefined || !model.capabilities.includes(role) || !settings.providers.some((provider) => provider.id === model.providerId && provider.enabled)) {
      return response({ error: 'IncompatibleModel' }, 409)
    }
    yield* deps.assign({ workspaceId, role, modelId: input.modelId })
    return response({ ok: true })
  }
  if (assignment !== null && request.method === 'DELETE') {
    const role = assignment[1] as InferenceRole
    yield* deps.clearAssignment({ workspaceId, role })
    return response({ ok: true })
  }
  return undefined
})

export async function runInferenceSettingsRoute(
  route: Effect.Effect<Response | undefined, unknown>,
): Promise<Response | undefined> {
  const result = await Effect.runPromiseExit(route)
  if (result._tag === 'Success') return result.value
  const failure = Option.getOrUndefined(Cause.failureOption(result.cause))
  return response({ error: failure === undefined ? 'InferenceSettingsUnavailable' : 'InvalidInferenceSettingsRequest' }, 400)
}
