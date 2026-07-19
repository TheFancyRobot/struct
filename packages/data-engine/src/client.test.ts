import {
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
} from '@struct/domain'
import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { makeDataEngineClient } from './client.js'
import {
  DATA_ENGINE_PROTOCOL_VERSION,
  type MaterializeRequest,
  type QueryRequest,
} from './protocol.js'

const snapshotId = DatasetSnapshotId.make('550e8400-e29b-41d4-a716-446655440003')
const digest = 'a'.repeat(64)
const artifactToken = '00000000-0000-4000-8000-000000000001'
const workspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440002')
const datasetId = DatasetId.make('550e8400-e29b-41d4-a716-446655440004')
const request: MaterializeRequest = {
  protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
  operation: 'materialize',
  snapshotId,
  inputs: [{
    ordinal: 0,
    format: 'json',
    artifactDigest: digest,
    contentHash: Sha256Digest.make(`sha256:${digest}`),
  }],
  fields: [{
    ordinal: 0,
    name: 'value',
    sourceType: 'number',
    logicalType: 'integer',
    nullable: false,
  }],
  limits: {
    maxInputBytes: 1_024,
    maxRows: 100,
    maxOutputBytes: 1_024,
    timeoutMs: 1_000,
  },
}
const queryRequest: QueryRequest = {
  protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
  operation: 'query',
  workspaceId,
  projectId,
  sql: 'SELECT id FROM records ORDER BY id',
  snapshots: [{
    alias: 'records',
    datasetId,
    snapshotId,
    schemaHash: Sha256Digest.make(`sha256:${'b'.repeat(64)}`),
    parquetDigest: digest,
  }],
  limits: {
    maxRows: 100,
    maxOutputBytes: 10_000,
    maxMemoryMb: 64,
    timeoutMs: 1_000,
  },
}

function delayedResponse(
  body: Uint8Array,
  delayMs: number,
  init?: ResponseInit,
): Response {
  let timer: ReturnType<typeof setTimeout> | undefined
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      timer = setTimeout(() => {
        controller.enqueue(body)
        controller.close()
      }, delayMs)
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer)
    },
  }), init)
}

describe('DataEngineClient', () => {
  it('authenticates and decodes a versioned materialization result', async () => {
    const calls: RequestInit[] = []
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(init ?? {})
      return Response.json({
        ok: true,
        result: {
          protocolVersion: '1',
          snapshotId,
          artifactToken,
          parquetDigest: digest,
          parquetByteLength: 10,
          profileHash: `sha256:${'b'.repeat(64)}`,
          profile: {
            rowCount: 1,
            columns: [{
              ordinal: 0,
              name: 'value',
              nullCount: 0,
              distinctCount: 1,
              minimum: '4',
              maximum: '4',
            }],
          },
        },
      })
    }
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, fetcher)
    const result = await Effect.runPromise(client.materialize(request))
    expect(result.snapshotId).toBe(snapshotId)
    expect(new Headers(calls[0]?.headers).get('authorization'))
      .toBe('Bearer test-credential-value')
  })

  it('fails closed on a malformed or version-mismatched response', async () => {
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => Response.json({
      ok: true,
      result: { protocolVersion: '2' },
    }))
    const exit = await Effect.runPromiseExit(client.materialize(request))
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('DataEngineProtocolError')
  })

  it('rejects oversized downloaded artifacts before reading the body', async () => {
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => new Response(new Uint8Array(20), {
      headers: { 'content-length': '20' },
    }))
    const exit = await Effect.runPromiseExit(
      client.readArtifact(artifactToken, digest, 10, 1_000),
    )
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('resource-limit')
  })

  it('stops a downloaded artifact when its body exceeds a smaller declared length', async () => {
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => new Response(new Uint8Array(20), {
      headers: { 'content-length': '10' },
    }))
    const exit = await Effect.runPromiseExit(
      client.readArtifact(artifactToken, digest, 10, 1_000),
    )
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('resource-limit')
  })

  it('times out a stalled artifact body', async () => {
    const body = new ReadableStream<Uint8Array>({
      start() {
        // Deliberately never produce or close the body.
      },
    })
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => new Response(body, {
      headers: { 'content-length': '10' },
    }))
    const exit = await Effect.runPromiseExit(
      client.readArtifact(artifactToken, digest, 10, 10),
    )
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('timed out')
  })

  it('times out a stalled materialization response body as transport failure', async () => {
    const body = new ReadableStream<Uint8Array>({
      start() {
        // Deliberately never produce or close the body.
      },
    })
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => new Response(body, {
      headers: { 'content-type': 'application/json' },
    }))
    const exit = await Effect.runPromiseExit(
      client.materialize({
        ...request,
        limits: { ...request.limits, timeoutMs: 10 },
      }),
    )
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('DataEngineTransportError')
    expect(String(exit)).toContain('timed out')
  })

  it('authenticates a scoped query and rejects response-scope drift', async () => {
    const calls: RequestInit[] = []
    const response = {
      ok: true as const,
      result: {
        protocolVersion: '1' as const,
        workspaceId,
        projectId,
        canonicalSql: queryRequest.sql,
        snapshots: queryRequest.snapshots,
        schemaHash: `sha256:${'c'.repeat(64)}`,
        resultHash: `sha256:${'d'.repeat(64)}`,
        columns: [{ ordinal: 0, name: 'id', type: 'BIGINT' }],
        rows: [['1']],
        rowCount: 1,
        truncated: false,
        executionMs: 1,
      },
    }
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async (_url, init) => {
      calls.push(init ?? {})
      return Response.json(response)
    })
    const result = await Effect.runPromise(client.query(queryRequest))
    expect(result.rows).toEqual([['1']])
    expect(new Headers(calls[0]?.headers).get('authorization'))
      .toBe('Bearer test-credential-value')

    const mismatched = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => Response.json({
      ...response,
      result: {
        ...response.result,
        workspaceId: '550e8400-e29b-41d4-a716-446655440099',
      },
    }))
    const exit = await Effect.runPromiseExit(mismatched.query(queryRequest))
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('DataEngineProtocolError')
    expect(String(exit)).not.toContain('/artifacts')

    const shapeDrifts = [
      {
        ...response.result,
        columns: [{ ordinal: 1, name: 'id', type: 'BIGINT' }],
      },
      {
        ...response.result,
        rows: [[]],
      },
      {
        ...response.result,
        rowCount: 2,
      },
    ]
    for (const result of shapeDrifts) {
      const drifting = makeDataEngineClient({
        baseUrl: 'http://data-engine',
        credential: 'test-credential-value',
      }, async () => Response.json({ ok: true, result }))
      const driftExit = await Effect.runPromiseExit(
        drifting.query(queryRequest),
      )
      expect(driftExit._tag).toBe('Failure')
      expect(String(driftExit)).toContain('DataEngineProtocolError')
      expect(String(driftExit)).toContain('inconsistent result shape')
    }
    const oversized = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => Response.json({
      ok: true,
      result: {
        ...response.result,
        rows: [['1'], ['2']],
        rowCount: 2,
      },
    }))
    const oversizedExit = await Effect.runPromiseExit(oversized.query({
      ...queryRequest,
      limits: { ...queryRequest.limits, maxRows: 1 },
    }))
    expect(oversizedExit._tag).toBe('Failure')
    expect(String(oversizedExit)).toContain('inconsistent result shape')
  })

  it('shares one timeout budget across fetch and body phases', async () => {
    const encoder = new TextEncoder()
    const materializeBody = encoder.encode(JSON.stringify({
      ok: true,
      result: {
        protocolVersion: '1',
        snapshotId,
        artifactToken,
        parquetDigest: digest,
        parquetByteLength: 1,
        profileHash: `sha256:${'b'.repeat(64)}`,
        profile: { rowCount: 1, columns: [] },
      },
    }))
    const queryBody = encoder.encode(JSON.stringify({
      ok: true,
      result: {
        protocolVersion: '1',
        workspaceId,
        projectId,
        canonicalSql: queryRequest.sql,
        snapshots: queryRequest.snapshots,
        schemaHash: `sha256:${'c'.repeat(64)}`,
        resultHash: `sha256:${'d'.repeat(64)}`,
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
        executionMs: 1,
      },
    }))
    const fetcher = async (input: string | URL | Request) => {
      await Bun.sleep(35)
      const path = new URL(String(input)).pathname
      if (path === '/v1/materialize') {
        return delayedResponse(materializeBody, 35, {
          headers: { 'content-type': 'application/json' },
        })
      }
      if (path === '/v1/query') {
        return delayedResponse(queryBody, 35, {
          headers: { 'content-type': 'application/json' },
        })
      }
      return delayedResponse(new Uint8Array([1]), 35, {
        headers: { 'content-length': '1' },
      })
    }
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, fetcher)
    const timeoutMs = 55
    const exits = await Promise.all([
      Effect.runPromiseExit(client.materialize({
        ...request,
        limits: { ...request.limits, timeoutMs },
      })),
      Effect.runPromiseExit(client.query({
        ...queryRequest,
        limits: { ...queryRequest.limits, timeoutMs },
      })),
      Effect.runPromiseExit(
        client.readArtifact(artifactToken, digest, 1, timeoutMs),
      ),
    ])
    for (const exit of exits) {
      expect(exit._tag).toBe('Failure')
      expect(String(exit)).toContain('DataEngineTransportError')
      expect(String(exit)).toContain('timed out')
    }
  })

  it('uses status fallback when a rejected artifact body is unreadable', async () => {
    const client = makeDataEngineClient({
      baseUrl: 'http://data-engine',
      credential: 'test-credential-value',
    }, async () => new Response('not-json', {
      status: 404,
      headers: { 'content-type': 'application/json' },
    }))
    const exit = await Effect.runPromiseExit(
      client.readArtifact(artifactToken, digest, 1, 1_000),
    )
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('DataEngineOperationError')
    expect(String(exit)).toContain('not-found')
    expect(String(exit)).not.toContain('DataEngineProtocolError')
  })
})
