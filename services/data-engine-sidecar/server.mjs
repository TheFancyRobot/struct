/* global Buffer, URL, clearInterval, clearTimeout, process, setInterval, setTimeout */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import {
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
} from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { DuckDBInstance } from '@duckdb/node-api'
import Parser from 'stream-json/Parser.js'
import Stringer from 'stream-json/Stringer.js'

const PROTOCOL_VERSION = '1'
const ARTIFACT_ROOT = '/artifacts'
const SCRATCH_ROOT = '/scratch'
const OUTPUT_ROOT = join(SCRATCH_ROOT, 'output')
const TOKEN = process.env.DATA_ENGINE_TOKEN ?? ''
const MEMORY_LIMIT = '192MB'
const THREADS = 1
const MAX_REQUEST_BYTES = 256 * 1024
const MAX_INPUT_BYTES = 64 * 1024 * 1024
const MAX_ROWS = 1_000_000
const MAX_OUTPUT_BYTES = 128 * 1024 * 1024
const MAX_TIMEOUT_MS = 60_000
const MAX_QUERY_ROWS = 10_000
const MAX_QUERY_OUTPUT_BYTES = 4 * 1024 * 1024
const MAX_QUERY_MEMORY_MB = 192
const HANDOFF_TTL_MS = 5 * 60_000
const HANDOFF_SWEEP_MS = 60_000
let busy = false

async function sweepExpiredHandoffs() {
  const now = Date.now()
  const entries = await readdir(OUTPUT_ROOT, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    if (
      !entry.isFile()
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[a-f0-9]{64}$/.test(entry.name)
    ) return
    const path = join(OUTPUT_ROOT, entry.name)
    const metadata = await stat(path)
    if (now - metadata.mtimeMs >= HANDOFF_TTL_MS) {
      await rm(path, { force: true })
    }
  }))
}

function json(response, status, body) {
  const encoded = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(encoded),
  })
  response.end(encoded)
}

function fail(response, status, code, message) {
  json(response, status, { ok: false, error: { code, message } })
}

function authenticated(request) {
  if (TOKEN.length < 16) return false
  const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? ''
  const left = Buffer.from(TOKEN)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

async function body(request) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > MAX_REQUEST_BYTES) throw new RequestFailure('resource-limit', 'Request body exceeds 256 KiB')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

class RequestFailure extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function exactKeys(value, keys) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}

function validateRequest(value) {
  if (!exactKeys(value, ['protocolVersion', 'operation', 'snapshotId', 'inputs', 'fields', 'limits'])) {
    throw new RequestFailure('protocol', 'Request fields do not match protocol version 1')
  }
  if (value.protocolVersion !== PROTOCOL_VERSION || value.operation !== 'materialize') {
    throw new RequestFailure('protocol', 'Unsupported protocol version or operation')
  }
  if (!/^[0-9a-f-]{36}$/.test(value.snapshotId)) {
    throw new RequestFailure('invalid-input', 'Snapshot ID is invalid')
  }
  if (!Array.isArray(value.inputs) || value.inputs.length === 0 || !Array.isArray(value.fields) || value.fields.length === 0) {
    throw new RequestFailure('invalid-input', 'Inputs and fields must be non-empty')
  }
  for (const [ordinal, input] of value.inputs.entries()) {
    if (
      !exactKeys(input, ['ordinal', 'format', 'artifactDigest', 'contentHash'])
      || input.ordinal !== ordinal
      || !['json', 'jsonl', 'csv'].includes(input.format)
      || !/^[a-f0-9]{64}$/.test(input.artifactDigest)
      || input.contentHash !== `sha256:${input.artifactDigest}`
    ) {
      throw new RequestFailure('lineage', 'Input lineage is invalid')
    }
  }
  const names = new Set()
  for (const [ordinal, field] of value.fields.entries()) {
    if (
      !exactKeys(field, ['ordinal', 'name', 'sourceType', 'logicalType', 'nullable'])
      || field.ordinal !== ordinal
      || typeof field.name !== 'string'
      || field.name.length === 0
      || field.name.length > 255
      || names.has(field.name)
      || !['boolean', 'integer', 'decimal', 'string', 'date', 'timestamp', 'json'].includes(field.logicalType)
      || typeof field.nullable !== 'boolean'
    ) {
      throw new RequestFailure('invalid-input', 'Field schema is invalid')
    }
    names.add(field.name)
  }
  if (
    !exactKeys(value.limits, ['maxInputBytes', 'maxRows', 'maxOutputBytes', 'timeoutMs'])
    || !Object.values(value.limits).every((limit) => Number.isSafeInteger(limit) && limit > 0)
    || value.limits.maxInputBytes > MAX_INPUT_BYTES
    || value.limits.maxRows > MAX_ROWS
    || value.limits.maxOutputBytes > MAX_OUTPUT_BYTES
    || value.limits.timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new RequestFailure('resource-limit', 'Materialization limits exceed sidecar policy')
  }
  return value
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/
const DIGEST_PATTERN = /^[a-f0-9]{64}$/
const ALIAS_PATTERN = /^[a-z][a-z0-9_]{0,62}$/
const FORBIDDEN_SQL_WORDS = new Set([
  'alter', 'attach', 'begin', 'call', 'checkpoint', 'commit', 'copy',
  'create', 'current_catalog', 'current_database', 'current_date',
  'current_role', 'current_schema', 'current_time', 'current_timestamp',
  'current_user', 'delete', 'detach', 'drop', 'export', 'force', 'import',
  'insert', 'install', 'load', 'localtime', 'localtimestamp', 'merge',
  'pragma', 'replace', 'reset', 'rollback', 'sample', 'session_user', 'set',
  'system_user', 'tablesample', 'transaction', 'truncate', 'update', 'use',
  'vacuum',
])
const ALLOWED_SQL_FUNCTIONS = new Set([
  'abs', 'as', 'avg', 'cast', 'ceil', 'ceiling', 'coalesce', 'count',
  'date_part', 'date_trunc', 'decimal', 'extract', 'floor', 'greatest', 'least',
  'exists', 'in', 'length', 'lower', 'max', 'min', 'nullif', 'over',
  'round', 'sum', 'trim', 'try_cast', 'upper',
])

function validateQueryRequest(value) {
  if (!exactKeys(value, [
    'protocolVersion',
    'operation',
    'workspaceId',
    'projectId',
    'sql',
    'snapshots',
    'limits',
  ])) {
    throw new RequestFailure('protocol', 'Query fields do not match protocol version 1')
  }
  if (value.protocolVersion !== PROTOCOL_VERSION || value.operation !== 'query') {
    throw new RequestFailure('protocol', 'Unsupported protocol version or operation')
  }
  if (!UUID_PATTERN.test(value.workspaceId) || !UUID_PATTERN.test(value.projectId)) {
    throw new RequestFailure('invalid-input', 'Query scope is invalid')
  }
  if (
    typeof value.sql !== 'string'
    || value.sql.length === 0
    || value.sql.length > 32_768
  ) {
    throw new RequestFailure('invalid-query', 'SQL text is invalid')
  }
  if (!Array.isArray(value.snapshots) || value.snapshots.length < 1 || value.snapshots.length > 8) {
    throw new RequestFailure('invalid-input', 'Query requires one to eight catalog snapshots')
  }
  const aliases = new Set()
  const snapshotIds = new Set()
  for (const snapshot of value.snapshots) {
    if (
      !exactKeys(snapshot, [
        'alias',
        'datasetId',
        'snapshotId',
        'schemaHash',
        'parquetDigest',
      ])
      || !ALIAS_PATTERN.test(snapshot.alias)
      || !UUID_PATTERN.test(snapshot.datasetId)
      || !UUID_PATTERN.test(snapshot.snapshotId)
      || !SHA256_PATTERN.test(snapshot.schemaHash)
      || !DIGEST_PATTERN.test(snapshot.parquetDigest)
      || aliases.has(snapshot.alias)
      || snapshotIds.has(snapshot.snapshotId)
    ) {
      throw new RequestFailure('lineage', 'Query snapshot binding is invalid')
    }
    aliases.add(snapshot.alias)
    snapshotIds.add(snapshot.snapshotId)
  }
  if (
    !exactKeys(value.limits, [
      'maxRows',
      'maxOutputBytes',
      'maxMemoryMb',
      'timeoutMs',
    ])
    || !Object.values(value.limits).every(
      (limit) => Number.isSafeInteger(limit) && limit > 0,
    )
    || value.limits.maxRows > MAX_QUERY_ROWS
    || value.limits.maxOutputBytes > MAX_QUERY_OUTPUT_BYTES
    || value.limits.maxMemoryMb > MAX_QUERY_MEMORY_MB
    || value.limits.timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new RequestFailure('resource-limit', 'Query limits exceed sidecar policy')
  }
  return value
}

function canonicalizeSql(sql) {
  let canonical = ''
  let quote
  let pendingSpace = false
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    if (quote !== undefined) {
      canonical += character
      if (character === quote) {
        if (sql[index + 1] === quote) {
          canonical += sql[index + 1]
          index += 1
        } else {
          quote = undefined
        }
      }
      continue
    }
    if (character === "'" || character === '"') {
      if (pendingSpace && canonical.length > 0) canonical += ' '
      pendingSpace = false
      quote = character
      canonical += character
      continue
    }
    if (/\s/.test(character)) {
      pendingSpace = true
      continue
    }
    if (pendingSpace && canonical.length > 0) canonical += ' '
    pendingSpace = false
    canonical += character
  }
  if (quote !== undefined) {
    throw new RequestFailure('invalid-query', 'SQL contains an unterminated quoted value')
  }
  canonical = canonical.trim()
  if (canonical.endsWith(';')) canonical = canonical.slice(0, -1).trim()
  return canonical
}

function sqlTokens(sql) {
  const hasControlCharacter = [...sql].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)
      || code === 127
  })
  if (
    hasControlCharacter
    || sql.includes('--')
    || sql.includes('/*')
    || sql.includes('*/')
    || sql.includes('$$')
  ) {
    throw new RequestFailure('invalid-query', 'SQL comments or unsafe encoding are not allowed')
  }
  const tokens = []
  let index = 0
  while (index < sql.length) {
    const character = sql[index]
    if (/\s/.test(character)) {
      index += 1
      continue
    }
    if (character === "'" || character === '"') {
      const quote = character
      let value = character
      index += 1
      let closed = false
      while (index < sql.length) {
        value += sql[index]
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            value += sql[index + 1]
            index += 2
            continue
          }
          index += 1
          closed = true
          break
        }
        index += 1
      }
      if (!closed) {
        throw new RequestFailure('invalid-query', 'SQL contains an unterminated quoted value')
      }
      if (
        quote === "'"
        && (
          /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value)
          || /(?:https?|file):\/\//i.test(value)
          || /^'(?:\/|\\\\|[a-z]:[\\/])/i.test(value)
          || /[\\/]/.test(value)
        )
      ) {
        throw new RequestFailure('invalid-query', 'SQL paths and URLs are not allowed')
      }
      tokens.push({ kind: quote === "'" ? 'string' : 'identifier', value })
      continue
    }
    const identifier = /^[a-z_][a-z0-9_$]*/i.exec(sql.slice(index))
    if (identifier !== null) {
      tokens.push({ kind: 'identifier', value: identifier[0] })
      index += identifier[0].length
      continue
    }
    const number = /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[+-]?[0-9]+)?/i
      .exec(sql.slice(index))
    if (number !== null) {
      tokens.push({ kind: 'number', value: number[0] })
      index += number[0].length
      continue
    }
    if ('(),.*+-/%=<>!|&[]:;'.includes(character)) {
      tokens.push({ kind: 'symbol', value: character })
      index += 1
      continue
    }
    throw new RequestFailure('invalid-query', 'SQL contains an unsupported token')
  }
  return tokens
}

function validateSqlSubset(sql) {
  const canonicalSql = canonicalizeSql(sql)
  const tokens = sqlTokens(canonicalSql)
  const words = tokens
    .filter((token) => token.kind === 'identifier')
    .map((token) => token.value.toLowerCase())
  if (!['select', 'with'].includes(words[0])) {
    throw new RequestFailure('invalid-query', 'Only SELECT and WITH queries are allowed')
  }
  if (words.some((word) => FORBIDDEN_SQL_WORDS.has(word))) {
    throw new RequestFailure('invalid-query', 'SQL contains a forbidden operation')
  }
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]
    if (
      token.kind === 'identifier'
      && tokens[index + 1]?.value === '('
      && !ALLOWED_SQL_FUNCTIONS.has(token.value.toLowerCase())
    ) {
      throw new RequestFailure('invalid-query', 'SQL contains a non-allowlisted function')
    }
  }
  let depth = 0
  let totallyOrdered = false
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]
    if (token.value === '(') depth += 1
    if (token.value === ')') depth -= 1
    if (
      depth === 0
      && token.kind === 'identifier'
      && token.value.toLowerCase() === 'order'
      && tokens[index + 1]?.kind === 'identifier'
      && tokens[index + 1]?.value.toLowerCase() === 'by'
      && tokens[index + 2]?.kind === 'identifier'
      && tokens[index + 2]?.value.toLowerCase() === 'all'
    ) {
      totallyOrdered = true
    }
  }
  if (!totallyOrdered) {
    throw new RequestFailure(
      'invalid-query',
      'Deterministic queries require a top-level ORDER BY ALL',
    )
  }
  return canonicalSql
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

function sourcePath(input) {
  return join(
    ARTIFACT_ROOT,
    'objects',
    'sha256',
    input.artifactDigest.slice(0, 2),
    input.artifactDigest,
  )
}

function sourceSql(input, fields) {
  const path = (input.preparedPath ?? sourcePath(input)).replaceAll("'", "''")
  if (input.format === 'csv') {
    return `read_csv_auto('${path}', header=true, all_varchar=true, strict_mode=true)`
  }
  if (fields !== undefined) {
    const columns = fields
      .map((field) => `'${field.name.replaceAll("'", "''")}': 'VARCHAR'`)
      .join(', ')
    return `read_json_auto('${path}', format='auto', union_by_name=true, columns={${columns}}, maximum_object_size=16777216)`
  }
  return `read_json_auto('${path}', format='auto', union_by_name=true, maximum_object_size=16777216)`
}

class PreserveExactNumbers extends Transform {
  constructor(fieldNames, ensureActive) {
    super({ objectMode: true })
    this.fieldNames = fieldNames
    this.ensureActive = ensureActive
    this.containers = []
  }

  _transform(token, _encoding, callback) {
    try {
      this.ensureActive()
      const parent = this.containers.at(-1)
      if (token.name === 'startObject') {
        if (parent?.kind === 'object') parent.key = undefined
        this.containers.push({
          kind: 'object',
          record: this.containers.length === 0
            || (this.containers.length === 1 && parent?.kind === 'array' && parent.root),
          key: undefined,
        })
      } else if (token.name === 'startArray') {
        if (parent?.kind === 'object') parent.key = undefined
        this.containers.push({
          kind: 'array',
          root: this.containers.length === 0,
        })
      } else if (token.name === 'keyValue' && parent?.kind === 'object') {
        parent.key = token.value
      } else if (
        token.name === 'numberValue'
        && parent?.kind === 'object'
        && parent.record
        && this.fieldNames.has(parent.key)
      ) {
        parent.key = undefined
        return callback(null, { name: 'stringValue', value: token.value })
      } else if (
        ['stringValue', 'numberValue', 'nullValue', 'trueValue', 'falseValue'].includes(token.name)
        && parent?.kind === 'object'
      ) {
        parent.key = undefined
      } else if (token.name === 'endObject' || token.name === 'endArray') {
        this.containers.pop()
      }
      callback(null, token)
    } catch (error) {
      callback(error)
    }
  }
}

async function prepareExactJsonInput(input, request, ensureActive) {
  if (input.format === 'csv') return input
  const directory = join(SCRATCH_ROOT, 'input')
  await mkdir(directory, { recursive: true })
  const preparedPath = join(directory, `${request.snapshotId}-${input.ordinal}.json`)
  const exactNumberFields = new Set(
    request.fields
      .filter((field) => field.logicalType === 'integer' || field.logicalType === 'decimal')
      .map((field) => field.name),
  )
  try {
    await rm(preparedPath, { force: true })
    await pipeline(
      createReadStream(sourcePath(input)),
      Parser.make({
        jsonStreaming: input.format === 'jsonl',
        packKeys: true,
        packStrings: true,
        packNumbers: true,
        streamKeys: false,
        streamStrings: false,
        streamNumbers: false,
      }),
      new PreserveExactNumbers(exactNumberFields, ensureActive),
      Stringer.make({
        useValues: true,
        makeArray: input.format === 'jsonl',
      }),
      createWriteStream(preparedPath, { flags: 'wx' }),
    )
  } catch (error) {
    await rm(preparedPath, { force: true })
    if (error?.code === undefined) {
      throw new RequestFailure('invalid-input', 'Structured JSON input is invalid')
    }
    throw error
  }
  return { ...input, preparedPath }
}

function duckType(logicalType) {
  switch (logicalType) {
    case 'boolean': return 'BOOLEAN'
    case 'integer': return 'BIGINT'
    case 'decimal': return 'DECIMAL(38,10)'
    case 'date': return 'DATE'
    case 'timestamp': return 'TIMESTAMP'
    case 'json': return 'JSON'
    default: return 'VARCHAR'
  }
}

function normalize(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

async function hashFile(path, ensureActive = () => {}) {
  const hasher = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    ensureActive()
    hasher.update(chunk)
  }
  ensureActive()
  return hasher.digest('hex')
}

async function runStructuredImport(connection, statement) {
  try {
    await connection.run(statement)
  } catch (error) {
    if (
      /csv|json|malformed|parse|sniff|invalid input|conversion/i
        .test(String(error?.message))
    ) {
      throw new RequestFailure('invalid-input', 'Structured input could not be parsed')
    }
    throw error
  }
}

async function writeParquetWithinLimit(
  connection,
  statement,
  path,
  maxBytes,
  ensureActive,
) {
  let monitorFailure
  let checking = false
  const check = async () => {
    if (checking || monitorFailure !== undefined) return
    checking = true
    try {
      ensureActive()
      const metadata = await stat(path)
      if (metadata.size > maxBytes) {
        monitorFailure = new RequestFailure(
          'resource-limit',
          'Parquet output exceeds configured limit',
        )
        connection.interrupt()
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        monitorFailure = error
        connection.interrupt()
      }
    } finally {
      checking = false
    }
  }
  const monitor = setInterval(() => void check(), 2)
  try {
    await connection.run(statement)
    await check()
  } catch (error) {
    if (monitorFailure !== undefined) throw monitorFailure
    throw error
  } finally {
    clearInterval(monitor)
    while (checking) {
      await new Promise((resolve) => setTimeout(resolve, 1))
    }
  }
  if (monitorFailure !== undefined) throw monitorFailure
}

async function materialize(request, httpRequest, httpResponse) {
  let cancelled = httpResponse.destroyed
  let instance
  let connection
  const preparedPaths = []
  const temporary = join(OUTPUT_ROOT, `${request.snapshotId}.parquet.tmp`)
  const interrupt = () => {
    cancelled = true
    connection?.interrupt()
  }
  const ensureActive = () => {
    if (cancelled || httpRequest.aborted) {
      throw new RequestFailure('cancelled', 'Materialization was interrupted')
    }
  }
  httpRequest.once('aborted', interrupt)
  httpResponse.once('close', interrupt)
  const timeout = setTimeout(interrupt, request.limits.timeoutMs)
  try {
    await mkdir(OUTPUT_ROOT, { recursive: true })
    ensureActive()
    let inputBytes = 0
    for (const input of request.inputs) {
      let metadata
      try {
        metadata = await stat(sourcePath(input))
      } catch (error) {
        if (error?.code === 'ENOENT') {
          throw new RequestFailure('not-found', 'Input artifact was not found')
        }
        throw error
      }
      ensureActive()
      if (!metadata.isFile()) {
        throw new RequestFailure('invalid-input', 'Input artifact is not a regular file')
      }
      inputBytes += metadata.size
      if (inputBytes > request.limits.maxInputBytes) {
        throw new RequestFailure('resource-limit', 'Input bytes exceed configured limit')
      }
      if (await hashFile(sourcePath(input), ensureActive) !== input.artifactDigest) {
        throw new RequestFailure('lineage', 'Input artifact hash does not match catalog lineage')
      }
    }

    instance = await DuckDBInstance.create(':memory:', {
      memory_limit: MEMORY_LIMIT,
      threads: THREADS,
      temp_directory: join(SCRATCH_ROOT, 'tmp'),
      allow_community_extensions: 'false',
      allow_unsigned_extensions: 'false',
    })
    ensureActive()
    connection = await instance.connect()
    ensureActive()
    await connection.run(`SET allowed_directories=['${ARTIFACT_ROOT}','${SCRATCH_ROOT}']`)
    await connection.run('SET enable_external_access=false')
    const exactInputs = []
    for (const input of request.inputs) {
      const prepared = await prepareExactJsonInput(input, request, ensureActive)
      exactInputs.push(prepared)
      if (prepared.preparedPath !== undefined) preparedPaths.push(prepared.preparedPath)
    }
    const inferredUnion = exactInputs
      .map((input) => `SELECT * FROM ${sourceSql(input)}`)
      .join(' UNION ALL BY NAME ')
    await runStructuredImport(
      connection,
      `CREATE TABLE scanned AS SELECT * FROM (${inferredUnion}) LIMIT ${request.limits.maxRows + 1}`,
    )
    const countReader = await connection.runAndReadAll('SELECT count(*) AS row_count FROM scanned')
    await countReader.readAll()
    const rowCount = Number(countReader.getRowObjectsJS()[0].row_count)
    if (rowCount === 0) throw new RequestFailure('invalid-input', 'Structured input contains no rows')
    if (rowCount > request.limits.maxRows) {
      throw new RequestFailure('resource-limit', 'Input rows exceed configured limit')
    }
    const schemaReader = await connection.runAndReadAll("PRAGMA table_info('scanned')")
    await schemaReader.readAll()
    const importedNames = new Set(
      schemaReader.getRowObjectsJS().map((column) => String(column.name)),
    )
    const declaredNames = new Set(request.fields.map((field) => field.name))
    if (
      importedNames.size !== declaredNames.size
      || [...importedNames].some((name) => !declaredNames.has(name))
    ) {
      throw new RequestFailure(
        'invalid-input',
        'Structured input columns do not match the declared schema',
      )
    }
    await connection.run('DROP TABLE scanned')
    const exactUnion = exactInputs
      .map((input) => `SELECT * FROM ${sourceSql(input, request.fields)}`)
      .join(' UNION ALL BY NAME ')
    await runStructuredImport(
      connection,
      `CREATE TABLE imported AS SELECT * FROM (${exactUnion}) LIMIT ${request.limits.maxRows + 1}`,
    )
    for (const field of request.fields) {
      if (!importedNames.has(field.name)) {
        throw new RequestFailure(
          'invalid-input',
          `Declared field is missing from structured input: ${field.name}`,
        )
      }
      const name = quoteIdentifier(field.name)
      const text = `trim(CAST(${name} AS VARCHAR))`
      let invalid = `${name} IS NOT NULL AND TRY_CAST(${name} AS ${duckType(field.logicalType)}) IS NULL`
      if (field.logicalType === 'integer') {
        const fraction = `regexp_extract(${text}, '^[+-]?[0-9]+(?:\\.([0-9]+))?', 1)`
        const digits = `regexp_replace(regexp_replace(split_part(lower(${text}), 'e', 1), '^[+-]', ''), '\\.', '')`
        const exponentText = `regexp_extract(lower(${text}), 'e([+-]?[0-9]+)$', 1)`
        const exponent = `COALESCE(TRY_CAST(NULLIF(${exponentText}, '') AS INTEGER), 0)`
        const scale = `(length(${fraction}) - ${exponent})`
        const trailingZeros = `(length(${digits}) - length(rtrim(${digits}, '0')))`
        invalid = `${name} IS NOT NULL AND (
             NOT regexp_full_match(${text}, '^[+-]?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?$')
             OR (${exponentText} <> '' AND TRY_CAST(${exponentText} AS INTEGER) IS NULL)
             OR TRY_CAST(${name} AS BIGINT) IS NULL
             OR ${scale} > ${trailingZeros}
           )`
      } else if (field.logicalType === 'decimal') {
        const fraction = `regexp_extract(${text}, '^[+-]?[0-9]+(?:\\.([0-9]+))?', 1)`
        const digits = `regexp_replace(regexp_replace(split_part(lower(${text}), 'e', 1), '^[+-]', ''), '\\.', '')`
        const exponentText = `regexp_extract(lower(${text}), 'e([+-]?[0-9]+)$', 1)`
        const exponent = `COALESCE(TRY_CAST(NULLIF(${exponentText}, '') AS INTEGER), 0)`
        const scale = `(length(${fraction}) - ${exponent})`
        const trailingZeros = `(length(${digits}) - length(rtrim(${digits}, '0')))`
        const leadingZeros = `(length(${digits}) - length(ltrim(${digits}, '0')))`
        const integerDigits = `(CASE
          WHEN ltrim(${digits}, '0') = '' THEN 0
          ELSE greatest(length(${digits}) - ${scale} - ${leadingZeros}, 0)
        END)`
        invalid = `${name} IS NOT NULL AND (
             NOT regexp_full_match(${text}, '^[+-]?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?$')
             OR (${exponentText} <> '' AND TRY_CAST(${exponentText} AS INTEGER) IS NULL)
             OR ${integerDigits} > 28
             OR (${scale} > 10 AND ${trailingZeros} < ${scale} - 10)
             OR TRY_CAST(${name} AS DECIMAL(38,10)) IS NULL
           )`
      }
      const invalidReader = await connection.runAndReadAll(
        `SELECT count(*) AS invalid_count FROM imported WHERE ${invalid}`,
      )
      await invalidReader.readAll()
      if (Number(invalidReader.getRowObjectsJS()[0].invalid_count) > 0) {
        throw new RequestFailure(
          'invalid-input',
          `Field cannot be converted to its declared logical type: ${field.name}`,
        )
      }
    }
    const projection = request.fields.map((field) => {
      const name = quoteIdentifier(field.name)
      return `CAST(${name} AS ${duckType(field.logicalType)}) AS ${name}`
    }).join(', ')
    await connection.run(`CREATE TABLE materialized AS SELECT ${projection} FROM imported`)
    const profileColumns = []
    for (const field of request.fields) {
      const name = quoteIdentifier(field.name)
      const orderable = field.logicalType === 'json'
        ? `TRY_CAST(${name} AS VARCHAR)`
        : name
      const minimum = field.logicalType === 'decimal'
        ? `regexp_replace(regexp_replace(CAST(min(${name}) AS VARCHAR), '0+$', ''), '\\.$', '')`
        : `min(${orderable})`
      const maximum = field.logicalType === 'decimal'
        ? `regexp_replace(regexp_replace(CAST(max(${name}) AS VARCHAR), '0+$', ''), '\\.$', '')`
        : `max(${orderable})`
      const reader = await connection.runAndReadAll(
        `SELECT
           count(*) - count(${name}) AS null_count,
           count(DISTINCT ${name}) AS distinct_count,
           ${minimum} AS minimum,
           ${maximum} AS maximum
         FROM materialized`,
      )
      await reader.readAll()
      const profile = reader.getRowObjectsJS()[0]
      if (!field.nullable && Number(profile.null_count) > 0) {
        throw new RequestFailure(
          'invalid-input',
          `Non-nullable field contains null values: ${field.name}`,
        )
      }
      profileColumns.push({
        ordinal: field.ordinal,
        name: field.name,
        nullCount: Number(profile.null_count),
        distinctCount: Number(profile.distinct_count),
        minimum: normalize(profile.minimum),
        maximum: normalize(profile.maximum),
      })
    }
    const profile = { rowCount, columns: profileColumns }
    await rm(temporary, { force: true })
    await writeParquetWithinLimit(
      connection,
      `COPY (SELECT * FROM materialized ORDER BY ALL) TO '${temporary}' (FORMAT PARQUET, COMPRESSION ZSTD)`,
      temporary,
      request.limits.maxOutputBytes,
      ensureActive,
    )
    const outputMetadata = await stat(temporary)
    if (outputMetadata.size > request.limits.maxOutputBytes) {
      throw new RequestFailure('resource-limit', 'Parquet output exceeds configured limit')
    }
    const parquetDigest = await hashFile(temporary, ensureActive)
    const artifactToken = randomUUID()
    const destination = join(OUTPUT_ROOT, `${artifactToken}-${parquetDigest}`)
    await rename(temporary, destination)
    const profileHash = `sha256:${createHash('sha256').update(`${JSON.stringify(profile)}\n`).digest('hex')}`
    return {
      protocolVersion: PROTOCOL_VERSION,
      snapshotId: request.snapshotId,
      artifactToken,
      parquetDigest,
      parquetByteLength: outputMetadata.size,
      profileHash,
      profile,
    }
  } catch (error) {
    if (String(error?.message).toLowerCase().includes('interrupt')) {
      throw new RequestFailure('cancelled', 'Materialization was interrupted')
    }
    throw error
  } finally {
    clearTimeout(timeout)
    httpRequest.off('aborted', interrupt)
    httpResponse.off('close', interrupt)
    await rm(temporary, { force: true })
    await Promise.all(preparedPaths.map((path) => rm(path, { force: true })))
    connection?.disconnectSync()
    instance?.closeSync()
  }
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`
  }
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function queryValue(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new RequestFailure('engine', 'Query returned a non-finite numeric value')
    }
    return String(value)
  }
  if (typeof value === 'bigint') return value.toString()
  return stableJson(value)
}

async function querySnapshots(request, httpRequest, httpResponse) {
  let cancelled = httpResponse.destroyed
  let timedOut = false
  let instance
  let connection
  const interrupt = () => {
    cancelled = true
    connection?.interrupt()
  }
  const timeoutInterrupt = () => {
    timedOut = true
    interrupt()
  }
  const ensureActive = () => {
    if (timedOut) throw new RequestFailure('timeout', 'Query timed out')
    if (cancelled || httpRequest.aborted) {
      throw new RequestFailure('cancelled', 'Query was interrupted')
    }
  }
  httpRequest.once('aborted', interrupt)
  httpResponse.once('close', interrupt)
  const timeout = setTimeout(timeoutInterrupt, request.limits.timeoutMs)
  const startedAt = performance.now()
  try {
    const canonicalSql = validateSqlSubset(request.sql)
    instance = await DuckDBInstance.create(':memory:', {
      memory_limit: `${request.limits.maxMemoryMb}MB`,
      threads: THREADS,
      temp_directory: join(SCRATCH_ROOT, 'tmp'),
      allow_community_extensions: 'false',
      allow_unsigned_extensions: 'false',
    })
    connection = await instance.connect()
    await connection.run(`SET allowed_directories=['${ARTIFACT_ROOT}','${SCRATCH_ROOT}']`)
    await connection.run('SET enable_external_access=false')
    ensureActive()

    const referencedTables = await connection.getTableNames(canonicalSql, false)
    const allowedAliases = new Set(
      request.snapshots.map((snapshot) => snapshot.alias),
    )
    if (
      referencedTables.length === 0
      || referencedTables.some((table) => !allowedAliases.has(table))
    ) {
      throw new RequestFailure(
        'lineage',
        'Query references a table outside its catalog bindings',
      )
    }
    for (const snapshot of request.snapshots) {
      const path = join(
        ARTIFACT_ROOT,
        'objects',
        'sha256',
        snapshot.parquetDigest.slice(0, 2),
        snapshot.parquetDigest,
      )
      let metadata
      try {
        metadata = await stat(path)
      } catch (error) {
        if (error?.code === 'ENOENT') {
          throw new RequestFailure('not-found', 'Cataloged Parquet artifact was not found')
        }
        throw error
      }
      if (!metadata.isFile() || await hashFile(path, ensureActive) !== snapshot.parquetDigest) {
        throw new RequestFailure('lineage', 'Cataloged Parquet artifact failed lineage validation')
      }
      const escapedPath = path.replaceAll("'", "''")
      await connection.run(
        `CREATE VIEW ${quoteIdentifier(snapshot.alias)}
         AS SELECT * FROM read_parquet('${escapedPath}')`,
      )
      ensureActive()
    }

    const extracted = await connection.extractStatements(canonicalSql)
    if (extracted.count !== 1) {
      throw new RequestFailure('invalid-query', 'Exactly one SQL statement is required')
    }
    const prepared = await extracted.prepare(0)
    try {
      if (prepared.statementType !== 1) {
        throw new RequestFailure('invalid-query', 'Only read-only SELECT statements are allowed')
      }
    } finally {
      prepared.destroySync()
    }
    ensureActive()

    const reader = await connection.runAndReadAll(
      `SELECT * FROM (${canonicalSql}) AS bounded_query
       LIMIT ${request.limits.maxRows + 1}`,
    )
    await reader.readAll()
    ensureActive()
    const rawRows = reader.getRowsJson()
    const truncated = rawRows.length > request.limits.maxRows
    const rows = rawRows
      .slice(0, request.limits.maxRows)
      .map((row) => row.map(queryValue))
    const columns = reader.columnNames().map((name, ordinal) => ({
      ordinal,
      name,
      type: String(reader.columnTypes()[ordinal]),
    }))
    const snapshots = request.snapshots
    const schemaHash = `sha256:${createHash('sha256')
      .update(`${JSON.stringify(columns)}\n`)
      .digest('hex')}`
    const hashInput = {
      canonicalSql,
      snapshots,
      schemaHash,
      columns,
      rows,
      rowCount: rows.length,
      truncated,
    }
    const resultHash = `sha256:${createHash('sha256')
      .update(`${JSON.stringify(hashInput)}\n`)
      .digest('hex')}`
    const result = {
      protocolVersion: PROTOCOL_VERSION,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      ...hashInput,
      resultHash,
      executionMs: Math.max(0, Math.round(performance.now() - startedAt)),
    }
    if (Buffer.byteLength(JSON.stringify(result)) > request.limits.maxOutputBytes) {
      throw new RequestFailure('resource-limit', 'Query output exceeds configured limit')
    }
    return result
  } catch (error) {
    if (timedOut) {
      throw new RequestFailure('timeout', 'Query timed out')
    }
    if (
      error instanceof RequestFailure
      || !String(error?.message).toLowerCase().includes('interrupt')
    ) {
      throw error
    }
    throw new RequestFailure('cancelled', 'Query was interrupted')
  } finally {
    clearTimeout(timeout)
    httpRequest.off('aborted', interrupt)
    httpResponse.off('close', interrupt)
    connection?.disconnectSync()
    instance?.closeSync()
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://data-engine')
  if (url.pathname === '/healthz' && TOKEN.length < 16) {
    return fail(response, 503, 'authentication', 'Service credential is not configured')
  }
  if (!authenticated(request)) return fail(response, 401, 'authentication', 'Authentication failed')
  if (url.pathname === '/healthz') {
    return json(response, 200, { ok: true, protocolVersion: PROTOCOL_VERSION })
  }
  const artifactMatch = /^\/v1\/artifacts\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([a-f0-9]{64})$/.exec(url.pathname)
  if (request.method === 'GET' && artifactMatch !== null) {
    const path = join(OUTPUT_ROOT, `${artifactMatch[1]}-${artifactMatch[2]}`)
    let artifact
    try {
      artifact = await open(path, 'r')
      const metadata = await artifact.stat()
      await rm(path)
      response.writeHead(200, {
        'content-type': 'application/vnd.apache.parquet',
        'content-length': metadata.size,
      })
      await pipeline(artifact.createReadStream({ autoClose: false }), response)
      return
    } catch (error) {
      if (response.headersSent) return response.destroy()
      if (error?.code === 'ENOENT') {
        return fail(
          response,
          404,
          'handoff-not-found',
          'Materialized artifact handoff was not found',
        )
      }
      return fail(
        response,
        500,
        'engine',
        'Materialized artifact handoff failed',
      )
    } finally {
      await artifact?.close()
    }
  }
  if (
    request.method !== 'POST'
    || !['/v1/materialize', '/v1/query'].includes(url.pathname)
  ) {
    return fail(response, 404, 'protocol', 'Unknown operation')
  }
  let validated
  try {
    const decoded = await body(request)
    validated = url.pathname === '/v1/query'
      ? validateQueryRequest(decoded)
      : validateRequest(decoded)
  } catch (error) {
    const code = error instanceof RequestFailure ? error.code : 'engine'
    const status = code === 'not-found'
      ? 404
      : code === 'resource-limit'
        ? 413
        : 400
    return fail(
      response,
      status,
      code,
      error instanceof RequestFailure ? error.message : 'Data-engine request failed',
    )
  }
  if (busy) return fail(response, 429, 'busy', 'Data-engine concurrency limit reached')
  busy = true
  try {
    const result = url.pathname === '/v1/query'
      ? await querySnapshots(validated, request, response)
      : await materialize(validated, request, response)
    return json(response, 200, { ok: true, result })
  } catch (error) {
    const code = error instanceof RequestFailure ? error.code : 'engine'
    const status = code === 'not-found'
      ? 404
      : code === 'resource-limit'
        ? 413
        : code === 'busy'
          ? 429
          : 400
    return fail(
      response,
      status,
      code,
      error instanceof RequestFailure ? error.message : 'Data-engine operation failed',
    )
  } finally {
    busy = false
  }
})

await mkdir(join(SCRATCH_ROOT, 'tmp'), { recursive: true })
await rm(OUTPUT_ROOT, { recursive: true, force: true })
await mkdir(OUTPUT_ROOT, { recursive: true })
setInterval(() => {
  void sweepExpiredHandoffs().catch(() => undefined)
}, HANDOFF_SWEEP_MS).unref()
server.listen(4300, '0.0.0.0')
