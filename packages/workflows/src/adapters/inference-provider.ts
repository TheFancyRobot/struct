import { Config, Effect, Schema } from 'effect'

const environmentReference = /^env:\/\/([A-Z_][A-Z0-9_]*)$/
const supportedEnvironmentVariables = new Set([
  'OPENAI_API_KEY',
  'FRED_ANTHROPIC_API_KEY',
])
const approvedInferenceProviderHosts = new Set(['api.openai.com'])

export class InferenceCredentialReferenceError extends Schema.TaggedError<InferenceCredentialReferenceError>()(
  'InferenceCredentialReferenceError',
  { message: Schema.String },
) {}

/** Resolves a persisted reference only at a server runtime boundary. */
export const resolveInferenceProviderCredential = Effect.fn(
  'InferenceProvider.resolveCredential',
)(function* (reference: string) {
  const match = environmentReference.exec(reference)
  if (match === null) {
    return yield* new InferenceCredentialReferenceError({
      message: 'Credential references must use env://NAME',
    })
  }
  const environmentVariable = match[1]
  if (environmentVariable === undefined) {
    return yield* new InferenceCredentialReferenceError({
      message: 'Credential reference is invalid',
    })
  }
  if (!supportedEnvironmentVariables.has(environmentVariable)) {
    return yield* new InferenceCredentialReferenceError({
      message: 'Credential reference must name a supported provider key',
    })
  }
  const secret = yield* Config.string(environmentVariable)
  return { environmentVariable, secret }
})

export const inferenceProviderModelsUrl = (endpoint: string | null): URL =>
  new URL('models', endpoint === null || endpoint.endsWith('/') ? endpoint ?? 'https://api.openai.com/v1/' : `${endpoint}/`)

export const isApprovedInferenceProviderUrl = (url: URL): boolean =>
  url.protocol === 'https:'
  && url.port === ''
  && approvedInferenceProviderHosts.has(url.hostname)

export const isSupportedInferenceProviderCredentialReference = (reference: string): boolean => {
  const match = environmentReference.exec(reference)
  return match !== null
    && match[1] !== undefined
    && supportedEnvironmentVariables.has(match[1])
}
