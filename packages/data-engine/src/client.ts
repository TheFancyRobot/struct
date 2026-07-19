import { Config, Effect, Redacted, Schema } from 'effect'
import {
  DataEngineErrorCode,
  MaterializeFailure,
  MaterializeRequest,
  MaterializeResponse,
  type MaterializeResult,
} from './protocol.js'

export class DataEngineConfigurationError
  extends Schema.TaggedError<DataEngineConfigurationError>()(
    'DataEngineConfigurationError',
    { message: Schema.String },
  ) {}

export class DataEngineTransportError
  extends Schema.TaggedError<DataEngineTransportError>()(
    'DataEngineTransportError',
    { reason: Schema.String, message: Schema.String },
  ) {}

export class DataEngineProtocolError
  extends Schema.TaggedError<DataEngineProtocolError>()(
    'DataEngineProtocolError',
    { message: Schema.String },
  ) {}

export class DataEngineOperationError
  extends Schema.TaggedError<DataEngineOperationError>()(
    'DataEngineOperationError',
    { code: DataEngineErrorCode, message: Schema.String },
  ) {}

export interface DataEngineClientConfig {
  readonly baseUrl: string
  readonly credential: string
}

export type DataEngineFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface DataEngineClientShape {
  readonly materialize: (
    request: typeof MaterializeRequest.Type,
  ) => Effect.Effect<
    MaterializeResult,
    DataEngineTransportError | DataEngineProtocolError | DataEngineOperationError
  >
  readonly readArtifact: (
    digest: string,
    maxBytes: number,
    timeoutMs: number,
  ) => Effect.Effect<
    Uint8Array,
    DataEngineTransportError | DataEngineProtocolError | DataEngineOperationError
  >
}

function reason(cause: unknown): string {
  return cause instanceof Error ? cause.name : 'unknown'
}

class ArtifactLimitExceeded extends Error {}

export function makeDataEngineClient(
  config: DataEngineClientConfig,
  fetcher: DataEngineFetch = fetch,
): DataEngineClientShape {
  const materialize = Effect.fn('DataEngineClient.materialize')(
    function* (request: typeof MaterializeRequest.Type) {
      const encoded = yield* Schema.encode(MaterializeRequest)(request).pipe(
        Effect.mapError(() =>
          new DataEngineProtocolError({ message: 'Data-engine request is invalid' }),
        ),
      )
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetcher(`${config.baseUrl}/v1/materialize`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${config.credential}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(encoded),
            signal,
          }),
        catch: (cause) =>
          new DataEngineTransportError({
            reason: reason(cause),
            message: 'Data-engine request failed',
          }),
      }).pipe(
        Effect.timeoutFail({
          duration: request.limits.timeoutMs,
          onTimeout: () =>
            new DataEngineTransportError({
              reason: 'timeout',
              message: 'Data-engine request timed out',
            }),
        }),
      )
      const body = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () =>
          new DataEngineProtocolError({
            message: 'Data-engine response was not JSON',
          }),
      })
      const decoded = yield* Schema.decodeUnknown(MaterializeResponse)(body).pipe(
        Effect.mapError(() =>
          new DataEngineProtocolError({
            message: 'Data-engine response did not match protocol version 1',
          }),
        ),
      )
      if (!decoded.ok) {
        return yield* new DataEngineOperationError(decoded.error)
      }
      return decoded.result
    },
  )
  const readArtifact = Effect.fn('DataEngineClient.readArtifact')(
    function* (digest: string, maxBytes: number, timeoutMs: number) {
      if (!/^[a-f0-9]{64}$/.test(digest)) {
        return yield* new DataEngineProtocolError({
          message: 'Data-engine artifact digest is invalid',
        })
      }
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
        return yield* new DataEngineProtocolError({
          message: 'Data-engine artifact timeout is invalid',
        })
      }
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
        return yield* new DataEngineProtocolError({
          message: 'Data-engine artifact output limit is invalid',
        })
      }
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetcher(`${config.baseUrl}/v1/artifacts/${digest}`, {
            headers: { authorization: `Bearer ${config.credential}` },
            signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
          }),
        catch: (cause) =>
          new DataEngineTransportError({
            reason: reason(cause),
            message: 'Data-engine artifact download failed',
          }),
      }).pipe(
        Effect.timeoutFail({
          duration: timeoutMs,
          onTimeout: () =>
            new DataEngineTransportError({
              reason: 'timeout',
              message: 'Data-engine artifact download timed out',
            }),
        }),
      )
      if (!response.ok) {
        const failure = yield* Effect.promise(async () => {
          try {
            return Schema.decodeUnknownSync(MaterializeFailure)(
              await response.json(),
            )
          } catch {
            return undefined
          }
        })
        return yield* new DataEngineOperationError({
          code: failure?.error.code
            ?? (response.status === 404 ? 'not-found' : 'engine'),
          message: 'Data-engine artifact download was rejected',
        })
      }
      const declaredLength = Number(response.headers.get('content-length'))
      if (
        !Number.isSafeInteger(declaredLength)
        || declaredLength <= 0
        || declaredLength > maxBytes
      ) {
        return yield* new DataEngineOperationError({
          code: 'resource-limit',
          message: 'Data-engine artifact exceeds the configured output limit',
        })
      }
      const bytes = yield* Effect.tryPromise({
        try: async (signal) => {
          if (response.body === null) {
            throw new Error('Data-engine artifact response has no body')
          }
          const reader = response.body.getReader()
          const chunks: Uint8Array[] = []
          let byteLength = 0
          const cancel = () => {
            void reader.cancel()
          }
          signal.addEventListener('abort', cancel, { once: true })
          try {
            while (true) {
              const next = await reader.read()
              if (next.done) break
              byteLength += next.value.byteLength
              if (byteLength > maxBytes) {
                await reader.cancel()
                throw new ArtifactLimitExceeded()
              }
              chunks.push(next.value)
            }
          } finally {
            signal.removeEventListener('abort', cancel)
          }
          const result = new Uint8Array(byteLength)
          let offset = 0
          for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.byteLength
          }
          return result
        },
        catch: (cause) =>
          cause instanceof ArtifactLimitExceeded
            ? new DataEngineOperationError({
                code: 'resource-limit',
                message: 'Data-engine artifact exceeds the configured output limit',
              })
            : new DataEngineTransportError({
                reason: reason(cause),
                message: 'Data-engine artifact body could not be read',
              }),
      }).pipe(
        Effect.timeoutFail({
          duration: timeoutMs,
          onTimeout: () =>
            new DataEngineTransportError({
              reason: 'timeout',
              message: 'Data-engine artifact download timed out',
            }),
        }),
      )
      if (bytes.byteLength !== declaredLength) {
        return yield* new DataEngineProtocolError({
          message: 'Data-engine artifact length does not match its metadata',
        })
      }
      return bytes
    },
  )
  return { materialize, readArtifact }
}

export class DataEngineClient extends Effect.Service<DataEngineClient>()(
  'DataEngineClient',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const baseUrl = yield* Config.string('DATA_ENGINE_URL')
      const credential = yield* Config.redacted('DATA_ENGINE_TOKEN')
      const token = Redacted.value(credential)
      if (token.length < 16) {
        return yield* new DataEngineConfigurationError({
          message: 'DATA_ENGINE_TOKEN must contain at least 16 characters',
        })
      }
      return makeDataEngineClient({ baseUrl, credential: token })
    }),
  },
) {}
