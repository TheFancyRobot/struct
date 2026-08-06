import { Config, Effect, Schema } from 'effect'

const environmentReference = /^env:\/\/([A-Z_][A-Z0-9_]*)$/

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
  const secret = yield* Config.string(environmentVariable)
  return { environmentVariable, secret }
})

export const inferenceProviderModelsUrl = (endpoint: string | null): URL =>
  new URL('models', endpoint === null || endpoint.endsWith('/') ? endpoint ?? 'https://api.openai.com/v1/' : `${endpoint}/`)
