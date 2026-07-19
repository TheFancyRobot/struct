import { describe, expect, it } from 'bun:test'
import { mkdir } from 'node:fs/promises'
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
      readonly parquetDigest: string
      readonly parquetByteLength: number
      readonly profile: unknown
    }
    const replay = replayResponse.json.result
    expect(replay).toEqual(first)
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
      path: `/v1/artifacts/${first.parquetDigest}`,
      credential: token,
    })
    const replayArtifact = await hostRequest({
      path: `/v1/artifacts/${first.parquetDigest}`,
      credential: token,
    })
    expect(replayArtifact).toEqual(firstArtifact)
    expect(firstArtifact.digest).toBe(first.parquetDigest)
    expect(firstArtifact.byteLength).toBe(first.parquetByteLength)

    const unauthorized = await hostRequest({
      path: '/v1/materialize',
      method: 'POST',
      credential: 'invalid-credential',
      body: JSON.stringify(request),
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

    const unauthenticatedHealth = await hostRequest({ path: '/healthz' })
    expect(unauthenticatedHealth.status).toBe(401)
  }, 20_000)
})
