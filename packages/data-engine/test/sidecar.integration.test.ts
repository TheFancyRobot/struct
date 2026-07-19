import { describe, expect, it } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { createConnection, type Socket } from 'node:net'
import { dirname, join } from 'node:path'
import { DatasetSnapshotId, Sha256Digest } from '@struct/domain'
import {
  DATA_ENGINE_PROTOCOL_VERSION,
  type MaterializeRequest,
} from '../src/protocol.js'

const run = process.env['DATA_ENGINE_INTEGRATION'] === '1'
const suite = run ? describe : describe.skip
const token = 'struct-local-data-engine-token'
const fixturePath = join(
  process.cwd(),
  'packages/data-engine/test/fixtures/records.json',
)
const snapshotId = DatasetSnapshotId.make('550e8400-e29b-41d4-a716-446655440003')

async function fixtureInput() {
  const bytes = await Bun.file(fixturePath).bytes()
  return storeInput(bytes)
}

async function storeInput(bytes: Uint8Array) {
  const digest = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  const path = join(
    process.cwd(),
    '.local/artifacts/objects/sha256',
    digest.slice(0, 2),
    digest,
  )
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, bytes)
  return { digest, bytes }
}

async function openIncompleteMaterialization(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: 4300 })
    socket.once('error', reject)
    socket.once('connect', () => {
      socket.write([
        'POST /v1/materialize HTTP/1.1',
        'Host: 127.0.0.1:4300',
        `Authorization: Bearer ${token}`,
        'Content-Type: application/json',
        'Content-Length: 1024',
        'Connection: close',
        '',
        '{',
      ].join('\r\n'))
      setTimeout(() => resolve(socket), 50)
    })
  })
}

interface ContainerResponse {
  readonly status: number
  readonly json?: unknown
  readonly digest?: string
  readonly byteLength?: number
}

async function hostRequest(input: {
  readonly path: string
  readonly method?: string
  readonly credential?: string
  readonly body?: unknown
}): Promise<ContainerResponse> {
  const response = await fetch(`http://127.0.0.1:4300${input.path}`, {
    method: input.method ?? 'GET',
    headers: input.credential === undefined ? {} : {
      authorization: `Bearer ${input.credential}`,
      'content-type': 'application/json',
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  })
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (response.headers.get('content-type') === 'application/vnd.apache.parquet') {
    return {
      status: response.status,
      digest: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
      byteLength: bytes.byteLength,
    }
  }
  return {
    status: response.status,
    json: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
  }
}

suite('data-engine sidecar', () => {
  it('materializes deterministic Parquet/profile bytes and rejects bad auth', async () => {
    const input = await fixtureInput()
    const request: MaterializeRequest = {
      protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
      operation: 'materialize',
      snapshotId,
      inputs: [{
        ordinal: 0,
        format: 'json',
        artifactDigest: input.digest,
        contentHash: Sha256Digest.make(`sha256:${input.digest}`),
      }],
      fields: [
        {
          ordinal: 0,
          name: 'active',
          sourceType: 'boolean',
          logicalType: 'boolean',
          nullable: false,
        },
        {
          ordinal: 1,
          name: 'amount',
          sourceType: 'number',
          logicalType: 'decimal',
          nullable: false,
        },
        {
          ordinal: 2,
          name: 'id',
          sourceType: 'number',
          logicalType: 'integer',
          nullable: false,
        },
        {
          ordinal: 3,
          name: 'name',
          sourceType: 'string',
          logicalType: 'string',
          nullable: false,
        },
      ],
      limits: {
        maxInputBytes: 1_024,
        maxRows: 100,
        maxOutputBytes: 1_000_000,
        timeoutMs: 5_000,
      },
    }
    const firstResponse = await hostRequest({
      path: '/v1/materialize',
      method: 'POST',
      credential: token,
      body: request,
    })
    const replayResponse = await hostRequest({
      path: '/v1/materialize',
      method: 'POST',
      credential: token,
      body: request,
    })
    expect(firstResponse.status).toBe(200)
    expect(replayResponse.status).toBe(200)
    if (
      typeof firstResponse.json !== 'object'
      || firstResponse.json === null
      || !('result' in firstResponse.json)
      || typeof replayResponse.json !== 'object'
      || replayResponse.json === null
      || !('result' in replayResponse.json)
    ) {
      throw new Error('sidecar did not return a materialization result')
    }
    const first = firstResponse.json.result as {
      readonly artifactToken: string
      readonly parquetDigest: string
      readonly parquetByteLength: number
      readonly profile: unknown
    }
    const replay = replayResponse.json.result as typeof first
    expect(replay.artifactToken).not.toBe(first.artifactToken)
    expect({
      ...replay,
      artifactToken: first.artifactToken,
    }).toEqual(first)
    expect(first.profile).toEqual({
      rowCount: 2,
      columns: [
        {
          ordinal: 0,
          name: 'active',
          nullCount: 0,
          distinctCount: 2,
          minimum: 'false',
          maximum: 'true',
        },
        {
          ordinal: 1,
          name: 'amount',
          nullCount: 0,
          distinctCount: 2,
          minimum: '7.25',
          maximum: '12.5',
        },
        {
          ordinal: 2,
          name: 'id',
          nullCount: 0,
          distinctCount: 2,
          minimum: '1',
          maximum: '2',
        },
        {
          ordinal: 3,
          name: 'name',
          nullCount: 0,
          distinctCount: 2,
          minimum: 'alpha',
          maximum: 'beta',
        },
      ],
    })
    const firstArtifact = await hostRequest({
      path: `/v1/artifacts/${first.artifactToken}/${first.parquetDigest}`,
      credential: token,
    })
    const replayArtifact = await hostRequest({
      path: `/v1/artifacts/${replay.artifactToken}/${replay.parquetDigest}`,
      credential: token,
    })
    expect(replayArtifact).toEqual(firstArtifact)
    const consumedArtifact = await hostRequest({
      path: `/v1/artifacts/${first.artifactToken}/${first.parquetDigest}`,
      credential: token,
    })
    expect(consumedArtifact.status).toBe(404)
    expect(consumedArtifact.json).toEqual({
      ok: false,
      error: {
        code: 'handoff-not-found',
        message: 'Materialized artifact handoff was not found',
      },
    })
    expect(firstArtifact.digest).toBe(first.parquetDigest)
    expect(firstArtifact.byteLength).toBe(first.parquetByteLength)

    const unauthorized = await hostRequest({
      path: '/v1/materialize',
      method: 'POST',
      credential: 'invalid-credential',
      body: request,
    })
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.json).toEqual({
      ok: false,
      error: { code: 'authentication', message: 'Authentication failed' },
    })

    const oversizedPolicy = await hostRequest({
      path: '/v1/materialize',
      method: 'POST',
      credential: token,
      body: {
        ...request,
        limits: { ...request.limits, maxRows: 1_000_001 },
      },
    })
    expect(oversizedPolicy.status).toBe(413)
    expect(oversizedPolicy.json).toEqual({
      ok: false,
      error: {
        code: 'resource-limit',
        message: 'Materialization limits exceed sidecar policy',
      },
    })

    const boundedScan = await hostRequest({
      path: '/v1/materialize',
      method: 'POST',
      credential: token,
      body: {
        ...request,
        limits: { ...request.limits, maxRows: 1 },
      },
    })
    expect(boundedScan.status).toBe(413)
    expect(boundedScan.json).toEqual({
      ok: false,
      error: {
        code: 'resource-limit',
        message: 'Input rows exceed configured limit',
      },
    })

    const boundedOutput = await hostRequest({
      path: '/v1/materialize',
      method: 'POST',
      credential: token,
      body: {
        ...request,
        limits: { ...request.limits, maxOutputBytes: 1 },
      },
    })
    expect(boundedOutput.status).toBe(413)
    expect(boundedOutput.json).toEqual({
      ok: false,
      error: {
        code: 'resource-limit',
        message: 'Parquet output exceeds configured limit',
      },
    })

    const incomplete = await openIncompleteMaterialization()
    try {
      const concurrent = await hostRequest({
        path: '/v1/materialize',
        method: 'POST',
        credential: token,
        body: request,
      })
      expect(concurrent.status).toBe(200)
    } finally {
      incomplete.destroy()
    }

    const unauthenticatedHealth = await hostRequest({ path: '/healthz' })
    expect(unauthenticatedHealth.status).toBe(401)
  }, 20_000)

  it('preserves exact decimals and rejects deterministic schema conversion failures', async () => {
    const materializeValue = async (
      text: string,
      format: 'json' | 'jsonl' | 'csv',
      logicalType: MaterializeRequest['fields'][number]['logicalType'],
      suffix: number | string,
    ) => {
      const input = await storeInput(new TextEncoder().encode(text))
      return hostRequest({
        path: '/v1/materialize',
        method: 'POST',
        credential: token,
        body: {
          protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
          operation: 'materialize',
          snapshotId: DatasetSnapshotId.make(
            `550e8400-e29b-41d4-a716-44665544000${suffix}`,
          ),
          inputs: [{
            ordinal: 0,
            format,
            artifactDigest: input.digest,
            contentHash: Sha256Digest.make(`sha256:${input.digest}`),
          }],
          fields: [{
            ordinal: 0,
            name: 'value',
            sourceType: 'test',
            logicalType,
            nullable: false,
          }],
          limits: {
            maxInputBytes: 1_024,
            maxRows: 100,
            maxOutputBytes: 1_000_000,
            timeoutMs: 5_000,
          },
        } satisfies MaterializeRequest,
      })
    }

    const cases = [
      {
        text: '[{"value":1.5}]',
        logicalType: 'integer' as const,
      },
      {
        text: '[{"value":1.12345678901}]',
        logicalType: 'decimal' as const,
      },
      {
        text: '[{"value":"not-a-date"}]',
        logicalType: 'date' as const,
      },
      {
        text: '[{"value":1e-3}]',
        logicalType: 'integer' as const,
      },
    ]
    for (const [index, candidate] of cases.entries()) {
      const response = await materializeValue(
        candidate.text,
        'json',
        candidate.logicalType,
        index + 4,
      )
      expect(response.status).toBe(400)
      expect(response.json).toEqual({
        ok: false,
        error: {
          code: 'invalid-input',
          message: 'Field cannot be converted to its declared logical type: value',
        },
      })
    }

    const exactDecimal = await materializeValue(
      'value\n0000000000000000000000000001.00000000000\n',
      'csv',
      'decimal',
      8,
    )
    expect(exactDecimal.status).toBe(200)

    const exponentInteger = await materializeValue(
      '[{"value":1e3}]',
      'json',
      'integer',
      9,
    )
    expect(exponentInteger.status).toBe(200)
    expect(exponentInteger.json).toMatchObject({
      ok: true,
      result: {
        profile: {
          columns: [{
            minimum: '1000',
            maximum: '1000',
          }],
        },
      },
    })

    const exponentDecimal = await materializeValue(
      '[{"value":1.25e-2}]',
      'json',
      'decimal',
      'c',
    )
    expect(exponentDecimal.status).toBe(200)
    expect(exponentDecimal.json).toMatchObject({
      ok: true,
      result: {
        profile: {
          columns: [{
            minimum: '0.0125',
            maximum: '0.0125',
          }],
        },
      },
    })

    const exactJsonDecimal = await materializeValue(
      '[{"value":1234567890123456.1234567891}]',
      'json',
      'decimal',
      'a',
    )
    expect(exactJsonDecimal.status).toBe(200)
    expect(exactJsonDecimal.json).toMatchObject({
      ok: true,
      result: {
        profile: {
          columns: [{
            minimum: '1234567890123456.1234567891',
            maximum: '1234567890123456.1234567891',
          }],
        },
      },
    })

    const exactJsonlDecimal = await materializeValue(
      '{"value":1234567890123456.1234567891}\n',
      'jsonl',
      'decimal',
      'b',
    )
    expect(exactJsonlDecimal.status).toBe(200)
    expect(exactJsonlDecimal.json).toMatchObject({
      ok: true,
      result: {
        profile: {
          columns: [{
            minimum: '1234567890123456.1234567891',
            maximum: '1234567890123456.1234567891',
          }],
        },
      },
    })

    const unexpectedColumn = await materializeValue(
      '[{"value":1,"extra":2}]',
      'json',
      'integer',
      'c',
    )
    expect(unexpectedColumn.status).toBe(400)
    expect(unexpectedColumn.json).toEqual({
      ok: false,
      error: {
        code: 'invalid-input',
        message: 'Structured input columns do not match the declared schema',
      },
    })

    const malformed = await materializeValue(
      '[{"value":1}',
      'json',
      'integer',
      'd',
    )
    expect(malformed.status).toBe(400)
    expect(malformed.json).toEqual({
      ok: false,
      error: {
        code: 'invalid-input',
        message: 'Structured JSON input is invalid',
      },
    })
  }, 20_000)
})
