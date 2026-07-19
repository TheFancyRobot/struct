import { DatasetSnapshotId, Sha256Digest } from '@struct/domain'
import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { makeDataEngineClient } from './client.js'
import {
  DATA_ENGINE_PROTOCOL_VERSION,
  type MaterializeRequest,
} from './protocol.js'

const snapshotId = DatasetSnapshotId.make('550e8400-e29b-41d4-a716-446655440003')
const digest = 'a'.repeat(64)
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
    const exit = await Effect.runPromiseExit(client.readArtifact(digest, 10, 1_000))
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
    const exit = await Effect.runPromiseExit(client.readArtifact(digest, 10, 1_000))
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
      client.readArtifact(digest, 10, 10),
    )
    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('timed out')
  })
})
