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

async function disconnectQuery(body: unknown): Promise<void> {
  const encoded = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: 4300 })
    socket.once('error', reject)
    socket.once('connect', () => {
      socket.write([
        'POST /v1/query HTTP/1.1',
        'Host: 127.0.0.1:4300',
        `Authorization: Bearer ${token}`,
        'Content-Type: application/json',
        `Content-Length: ${Buffer.byteLength(encoded)}`,
        'Connection: close',
        '',
        encoded,
      ].join('\r\n'))
      setTimeout(() => {
        socket.destroy()
        resolve()
      }, 5)
    })
  })
}

interface ContainerResponse {
  readonly status: number
  readonly json?: unknown
  readonly digest?: string
  readonly byteLength?: number
  readonly bytes?: Uint8Array
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
      bytes,
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
    if (firstArtifact.bytes === undefined || firstArtifact.digest === undefined) {
      throw new Error('sidecar did not return Parquet bytes')
    }
    const parquetPath = join(
      process.cwd(),
      '.local/artifacts/objects/sha256',
      firstArtifact.digest.slice(0, 2),
      firstArtifact.digest,
    )
    await mkdir(dirname(parquetPath), { recursive: true })
    await Bun.write(parquetPath, firstArtifact.bytes)

    const query = {
      protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
      operation: 'query',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      projectId: '550e8400-e29b-41d4-a716-446655440002',
      sql: `
        WITH totals AS (
          SELECT active, sum(amount) AS total
          FROM records
          GROUP BY active
        )
        SELECT active, total FROM totals ORDER BY ALL
      `,
      snapshots: [{
        alias: 'records',
        datasetId: '550e8400-e29b-41d4-a716-446655440004',
        snapshotId,
        schemaHash: `sha256:${'a'.repeat(64)}`,
        parquetDigest: firstArtifact.digest,
      }],
      limits: {
        maxRows: 100,
        maxOutputBytes: 100_000,
        maxMemoryMb: 64,
        timeoutMs: 5_000,
      },
    }
    const queryResult = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: query,
    })
    const queryReplay = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: query,
    })
    expect(queryResult.status).toBe(200)
    expect(queryReplay.status).toBe(200)
    const firstQuery = queryResult.json as {
      readonly result: {
        readonly executionMs: unknown
        readonly [key: string]: unknown
      }
    }
    const replayQuery = queryReplay.json as typeof firstQuery
    expect({
      ...replayQuery.result,
      executionMs: firstQuery.result['executionMs'],
    }).toEqual(firstQuery.result)
    expect(firstQuery.result['rows']).toEqual([
      [false, '7.250000000000000000'],
      [true, '12.500000000000000000'],
    ])
    expect(firstQuery.result['truncated']).toBe(false)
    expect(firstQuery.result['engineVersion']).toBe('duckdb-1.5.4')
    expect(firstQuery.result['engineConfigHash']).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    )
    const expectedArtifactHash = new Bun.CryptoHasher('sha256')
      .update(`${JSON.stringify({
        columns: firstQuery.result['columns'],
        rows: firstQuery.result['rows'],
        rowCount: firstQuery.result['rowCount'],
        truncated: firstQuery.result['truncated'],
      })}\n`)
      .digest('hex')
    expect(firstQuery.result['resultArtifactHash']).toBe(
      `sha256:${expectedArtifactHash}`,
    )
    const joinedQuery = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: {
        ...query,
        sql: `SELECT left_rows.id, right_rows.name
              FROM records left_rows
              JOIN records right_rows ON right_rows.id = left_rows.id
              WHERE left_rows.active = true
              ORDER BY ALL`,
      },
    })
    expect(joinedQuery.status).toBe(200)
    expect(joinedQuery.json).toMatchObject({
      ok: true,
      result: { rows: [['1', 'alpha']], truncated: false },
    })
    const unusedBinding = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: {
        ...query,
        sql: 'SELECT id FROM records ORDER BY ALL',
        snapshots: [
          ...query.snapshots,
          {
            ...query.snapshots[0],
            alias: 'unused_rows',
            datasetId: '970e8400-e29b-41d4-a716-446655440001',
            snapshotId: '970e8400-e29b-41d4-a716-446655440002',
          },
        ],
      },
    })
    expect(unusedBinding.json).toMatchObject({
      ok: false,
      error: { code: 'lineage' },
    })
    expect(unusedBinding.status).toBe(400)
    const projectedQuery = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: {
        ...query,
        sql: 'SELECT id FROM records ORDER BY ALL',
      },
    })
    expect(projectedQuery.status).toBe(200)
    expect(
      (projectedQuery.json as { result: { schemaHash: string } }).result
        .schemaHash,
    ).not.toBe(firstQuery.result['schemaHash'])

    const rejectedQueries = [
      'DELETE FROM records',
      'INSERT INTO records SELECT * FROM records',
      'UPDATE records SET id = 1',
      'CREATE TABLE escaped AS SELECT * FROM records',
      'DROP VIEW records',
      "COPY records TO '/tmp/export.csv'",
      "ATTACH '/tmp/other.db' AS other",
      'DETACH other',
      'INSTALL httpfs',
      'LOAD httpfs',
      'SELECT * FROM records',
      'SELECT id FROM records ORDER BY id',
      'SELECT * FROM records; SELECT * FROM records ORDER BY ALL',
      "SELECT read_csv_auto('/etc/passwd') FROM records ORDER BY ALL",
      "SELECT read_json_auto('../secret.json') FROM records ORDER BY ALL",
      "SELECT read_parquet('relative/file.parquet') FROM records ORDER BY ALL",
      "SELECT glob('*.csv') FROM records ORDER BY ALL",
      'PRAGMA version',
      'SELECT * FROM unknown ORDER BY ALL',
      'SELECT * FROM records -- bypass\nORDER BY ALL',
      'SELECT * FROM records /* bypass */ ORDER BY ALL',
      "SELECT * FROM records WHERE name = 'https://example.com/x' ORDER BY ALL",
      'SELECT CURRENT_TIMESTAMP FROM records ORDER BY ALL',
      'SELECT CURRENT_DATE FROM records ORDER BY ALL',
      'SELECT LOCALTIME FROM records ORDER BY ALL',
      'SELECT * FROM records TABLESAMPLE 10% ORDER BY ALL',
      'SELECT * FROM records USING SAMPLE 1 ROWS ORDER BY ALL',
    ]
    for (const sql of rejectedQueries) {
      const rejected = await hostRequest({
        path: '/v1/query',
        method: 'POST',
        credential: token,
        body: { ...query, sql },
      })
      expect(rejected.status).toBe(400)
      expect(rejected.json).toMatchObject({ ok: false })
      expect(JSON.stringify(rejected.json)).not.toContain('/artifacts')
      expect(JSON.stringify(rejected.json)).not.toContain('DuckDB')
    }
    const truncatedQuery = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: {
        ...query,
        sql: 'SELECT id FROM records ORDER BY ALL',
        limits: { ...query.limits, maxRows: 1 },
      },
    })
    expect(truncatedQuery.status).toBe(200)
    expect(truncatedQuery.json).toMatchObject({
      ok: true,
      result: { rows: [['1']], rowCount: 1, truncated: true },
    })
    const oversizedQuery = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: {
        ...query,
        limits: { ...query.limits, maxOutputBytes: 1 },
      },
    })
    expect(oversizedQuery.status).toBe(413)
    expect(oversizedQuery.json).toMatchObject({
      ok: false,
      error: { code: 'resource-limit' },
    })
    const expensiveSql = `SELECT sum(r01.id)
      FROM records r01
      ${Array.from(
        { length: 20 },
        (_, index) =>
          `CROSS JOIN records r${String(index + 2).padStart(2, '0')}`,
      ).join('\n')}
      ORDER BY ALL`
    const timedOutQuery = await hostRequest({
      path: '/v1/query',
      method: 'POST',
      credential: token,
      body: {
        ...query,
        sql: expensiveSql,
        limits: { ...query.limits, timeoutMs: 1 },
      },
    })
    expect(timedOutQuery.status).toBe(400)
    expect(timedOutQuery.json).toMatchObject({
      ok: false,
      error: { code: 'timeout' },
    })
    await disconnectQuery({
      ...query,
      sql: expensiveSql,
      limits: { ...query.limits, timeoutMs: 5_000 },
    })
    let recovered: ContainerResponse | undefined
    for (let attempt = 0; attempt < 20; attempt += 1) {
      recovered = await hostRequest({
        path: '/v1/query',
        method: 'POST',
        credential: token,
        body: {
          ...query,
          sql: 'SELECT id FROM records ORDER BY ALL',
        },
      })
      if (recovered.status === 200) break
      await Bun.sleep(10)
    }
    expect(recovered?.status).toBe(200)

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
        text: '[{"value":1.1234567890123456789}]',
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

    const corpusPrecisionDecimal = await materializeValue(
      '[{"value":59.93000000000001}]',
      'json',
      'decimal',
      'd',
    )
    expect(corpusPrecisionDecimal.status).toBe(200)
    expect(corpusPrecisionDecimal.json).toMatchObject({
      ok: true,
      result: {
        profile: {
          columns: [{
            minimum: '59.93000000000001',
            maximum: '59.93000000000001',
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
