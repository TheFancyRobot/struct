import { Config, Effect, Redacted, Schema } from 'effect'
import {
  DataEngineErrorCode,
  MaterializeFailure,
  MaterializeRequest,
  MaterializeResponse,
  QueryRequest,
  QueryResponse,
  type MaterializeResult,
  type QueryResult,
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

export interface DataEngineMaterializationClientShape {
  readonly materialize: (
    request: typeof MaterializeRequest.Type,
  ) => Effect.Effect<
    MaterializeResult,
    DataEngineTransportError | DataEngineProtocolError | DataEngineOperationError
  >
  readonly readArtifact: (
    token: MaterializeResult['artifactToken'],
    digest: string,
    maxBytes: number,
    timeoutMs: number,
  ) => Effect.Effect<
    Uint8Array,
    DataEngineTransportError | DataEngineProtocolError | DataEngineOperationError
  >
}

export interface DataEngineClientShape
  extends DataEngineMaterializationClientShape {
  readonly query: (
    request: typeof QueryRequest.Type,
  ) => Effect.Effect<
    QueryResult,
    DataEngineTransportError | DataEngineProtocolError | DataEngineOperationError
  >
}

function reason(cause: unknown): string {
  return cause instanceof Error ? cause.name : 'unknown'
}

class ArtifactLimitExceeded extends Error {}

function timeoutError(message: string): DataEngineTransportError {
  return new DataEngineTransportError({ reason: 'timeout', message })
}

function remainingBudget(
  deadline: number,
  message: string,
): Effect.Effect<number, DataEngineTransportError> {
  const remaining = deadline - Date.now()
  return remaining > 0
    ? Effect.succeed(remaining)
    : Effect.fail(timeoutError(message))
}

function readJsonBody(
  response: Response,
  timeoutMs: number,
): Effect.Effect<
  unknown,
  DataEngineTransportError | DataEngineProtocolError
> {
  return Effect.tryPromise({
    try: async (signal) => {
      const cancel = () => {
        void response.body?.cancel().catch(() => undefined)
      }
      signal.addEventListener('abort', cancel, { once: true })
      try {
        return await response.json()
      } finally {
        signal.removeEventListener('abort', cancel)
      }
    },
    catch: (cause) =>
      cause instanceof SyntaxError
        ? new DataEngineProtocolError({
            message: 'Data-engine response was not JSON',
          })
        : new DataEngineTransportError({
            reason: reason(cause),
            message: 'Data-engine response body could not be read',
          }),
  }).pipe(
    Effect.timeoutFail({
      duration: timeoutMs,
      onTimeout: () =>
        new DataEngineTransportError({
          reason: 'timeout',
          message: 'Data-engine response body timed out',
        }),
    }),
  )
}

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
      const deadline = Date.now() + request.limits.timeoutMs
      const fetchBudget = yield* remainingBudget(
        deadline,
        'Data-engine request timed out',
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
            signal: AbortSignal.any([
              signal,
              AbortSignal.timeout(fetchBudget),
            ]),
          }),
        catch: (cause) =>
          new DataEngineTransportError({
            reason: reason(cause),
            message: 'Data-engine request failed',
          }),
      }).pipe(
        Effect.timeoutFail({
          duration: fetchBudget,
          onTimeout: () => timeoutError('Data-engine request timed out'),
        }),
      )
      const bodyBudget = yield* remainingBudget(
        deadline,
        'Data-engine request timed out',
      )
      const body = yield* readJsonBody(response, bodyBudget)
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
    function* (
      token: MaterializeResult['artifactToken'],
      digest: string,
      maxBytes: number,
      timeoutMs: number,
    ) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token)) {
        return yield* new DataEngineProtocolError({
          message: 'Data-engine artifact token is invalid',
        })
      }
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
      const deadline = Date.now() + timeoutMs
      const fetchBudget = yield* remainingBudget(
        deadline,
        'Data-engine artifact download timed out',
      )
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetcher(`${config.baseUrl}/v1/artifacts/${token}/${digest}`, {
            headers: { authorization: `Bearer ${config.credential}` },
            signal: AbortSignal.any([signal, AbortSignal.timeout(fetchBudget)]),
          }),
        catch: (cause) =>
          new DataEngineTransportError({
            reason: reason(cause),
            message: 'Data-engine artifact download failed',
          }),
      }).pipe(
        Effect.timeoutFail({
          duration: fetchBudget,
          onTimeout: () =>
            timeoutError('Data-engine artifact download timed out'),
        }),
      )
      if (!response.ok) {
        const bodyBudget = deadline - Date.now()
        const failureBody = bodyBudget > 0
          ? yield* Effect.either(readJsonBody(response, bodyBudget))
          : undefined
        const failure = failureBody?._tag === 'Right'
          ? (() => {
              try {
                return Schema.decodeUnknownSync(MaterializeFailure)(
                  failureBody.right,
                )
              } catch {
                return undefined
              }
            })()
          : undefined
        return yield* new DataEngineOperationError({
          code: failure?.error.code
            ?? (response.status === 404 ? 'handoff-not-found' : 'engine'),
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
      const bodyBudget = yield* remainingBudget(
        deadline,
        'Data-engine artifact download timed out',
      )
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
          duration: bodyBudget,
          onTimeout: () =>
            timeoutError('Data-engine artifact download timed out'),
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
  const query = Effect.fn('DataEngineClient.query')(
    function* (request: typeof QueryRequest.Type) {
      const encoded = yield* Schema.encode(QueryRequest)(request).pipe(
        Effect.mapError(() =>
          new DataEngineProtocolError({
            message: 'Data-engine query request is invalid',
          }),
        ),
      )
      const deadline = Date.now() + request.limits.timeoutMs
      const fetchBudget = yield* remainingBudget(
        deadline,
        'Data-engine query request timed out',
      )
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetcher(`${config.baseUrl}/v1/query`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${config.credential}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(encoded),
            signal: AbortSignal.any([
              signal,
              AbortSignal.timeout(fetchBudget),
            ]),
          }),
        catch: (cause) =>
          new DataEngineTransportError({
            reason: reason(cause),
            message: 'Data-engine query request failed',
          }),
      }).pipe(
        Effect.timeoutFail({
          duration: fetchBudget,
          onTimeout: () => timeoutError('Data-engine query request timed out'),
        }),
      )
      const bodyBudget = yield* remainingBudget(
        deadline,
        'Data-engine query request timed out',
      )
      const body = yield* readJsonBody(response, bodyBudget)
      const decoded = yield* Schema.decodeUnknown(QueryResponse)(body).pipe(
        Effect.mapError(() =>
          new DataEngineProtocolError({
            message: 'Data-engine query response did not match protocol version 1',
          }),
        ),
      )
      if (!decoded.ok) {
        return yield* new DataEngineOperationError(decoded.error)
      }
      if (
        decoded.result.workspaceId !== request.workspaceId
        || decoded.result.projectId !== request.projectId
        || decoded.result.snapshots.length !== request.snapshots.length
        || decoded.result.snapshots.some((snapshot, index) => {
          const requested = request.snapshots[index]
          return requested === undefined
            || snapshot.alias !== requested.alias
            || snapshot.datasetId !== requested.datasetId
            || snapshot.snapshotId !== requested.snapshotId
            || snapshot.schemaHash !== requested.schemaHash
            || snapshot.parquetDigest !== requested.parquetDigest
        })
      ) {
        return yield* new DataEngineProtocolError({
          message: 'Data-engine query response does not match requested catalog scope',
        })
      }
      if (
        !decoded.result.columns.every(
          (column, index) => column.ordinal === index,
        )
        || decoded.result.rows.some(
          (row) => row.length !== decoded.result.columns.length,
        )
        || decoded.result.rowCount !== decoded.result.rows.length
        || decoded.result.rowCount > request.limits.maxRows
      ) {
        return yield* new DataEngineProtocolError({
          message: 'Data-engine query response has inconsistent result shape',
        })
      }
      return decoded.result
    },
  )
  return { materialize, readArtifact, query }
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
