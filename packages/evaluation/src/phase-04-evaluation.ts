import { mkdir, readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { dirname, resolve } from 'node:path'
import {
  DATA_ENGINE_ADAPTER_VERSION,
  DATA_ENGINE_EXECUTION_POLICY_VERSION,
  DATA_ENGINE_PROTOCOL_VERSION,
  DATA_ENGINE_VERSION,
  DatasetQueryAuthenticationError,
  DatasetQueryAuthorizationError,
  DatasetQueryCatalogError,
  DatasetQueryToolPersistenceError,
  makeDataEngineClient,
  makeDeterministicDatasetQueryService,
  makeReadOnlySqlService,
  type QuerySnapshotBinding,
} from '@struct/data-engine'
import {
  DatasetCitationId,
  DatasetId,
  DatasetSchemaFamilyId,
  DatasetSnapshotId,
  JobQueueId,
  ProjectId,
  QueryResultSnapshotId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  DatasetMaterializationRepo,
  DatasetQueryEvidenceRepo,
  SqlClientLive,
} from '@struct/persistence'
import { Effect, Layer, Option, Schema } from 'effect'
import postgres from 'postgres'
import {
  canonicalJson,
  compareCorpusManifests,
  CORPUS_CANONICAL_SEED,
  CORPUS_GENERATOR_VERSION,
  CORPUS_VERSION,
  generateCorpus,
  type CorpusProfile,
  type CorpusSchemaFamily,
  verifyCorpus,
} from './corpus.js'

const workspaceId = WorkspaceId.make('940e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('940e8400-e29b-41d4-a716-446655440002')
const credential = 'phase-04-evaluation-user'
const fixedTime = 1_721_430_000_000

const familyIds = {
  'fam.call_log': {
    alias: 'call_logs',
    datasetId: DatasetId.make('940e8400-e29b-41d4-a716-446655440010'),
    familyId: DatasetSchemaFamilyId.make('940e8400-e29b-41d4-a716-446655440011'),
    snapshotId: DatasetSnapshotId.make('940e8400-e29b-41d4-a716-446655440012'),
    sourceId: SourceId.make('940e8400-e29b-41d4-a716-446655440013'),
    sourceVersionId: SourceVersionId.make('940e8400-e29b-41d4-a716-446655440014'),
    jobId: JobQueueId.make('940e8400-e29b-41d4-a716-446655440015'),
  },
  'fam.device_telemetry': {
    alias: 'telemetry',
    datasetId: DatasetId.make('940e8400-e29b-41d4-a716-446655440020'),
    familyId: DatasetSchemaFamilyId.make('940e8400-e29b-41d4-a716-446655440021'),
    snapshotId: DatasetSnapshotId.make('940e8400-e29b-41d4-a716-446655440022'),
    sourceId: SourceId.make('940e8400-e29b-41d4-a716-446655440023'),
    sourceVersionId: SourceVersionId.make('940e8400-e29b-41d4-a716-446655440024'),
    jobId: JobQueueId.make('940e8400-e29b-41d4-a716-446655440025'),
  },
  'fam.transaction': {
    alias: 'transactions',
    datasetId: DatasetId.make('940e8400-e29b-41d4-a716-446655440030'),
    familyId: DatasetSchemaFamilyId.make('940e8400-e29b-41d4-a716-446655440031'),
    snapshotId: DatasetSnapshotId.make('940e8400-e29b-41d4-a716-446655440032'),
    sourceId: SourceId.make('940e8400-e29b-41d4-a716-446655440033'),
    sourceVersionId: SourceVersionId.make('940e8400-e29b-41d4-a716-446655440034'),
    jobId: JobQueueId.make('940e8400-e29b-41d4-a716-446655440035'),
  },
  'fam.inventory_item': {
    alias: 'inventory',
    datasetId: DatasetId.make('940e8400-e29b-41d4-a716-446655440040'),
    familyId: DatasetSchemaFamilyId.make('940e8400-e29b-41d4-a716-446655440041'),
    snapshotId: DatasetSnapshotId.make('940e8400-e29b-41d4-a716-446655440042'),
    sourceId: SourceId.make('940e8400-e29b-41d4-a716-446655440043'),
    sourceVersionId: SourceVersionId.make('940e8400-e29b-41d4-a716-446655440044'),
    jobId: JobQueueId.make('940e8400-e29b-41d4-a716-446655440045'),
  },
} as const

interface GroundTruthExact {
  readonly answer: unknown
}

interface GroundTruth {
  readonly expectedSchemas: ReadonlyArray<CorpusSchemaFamily>
  readonly exact: Readonly<Record<string, GroundTruthExact>>
  readonly securityCases: Readonly<Record<string, ReadonlyArray<string>>>
  readonly recoveryCases: ReadonlyArray<{
    readonly boundary: string
    readonly expected: 'idempotent-replay'
  }>
}

interface MaterializedFamily {
  readonly family: CorpusSchemaFamily
  readonly binding: QuerySnapshotBinding
  readonly sourceDigest: string
  readonly parquetDigest: string
  readonly parquetByteLength: number
  readonly profileHash: typeof Sha256Digest.Type
  readonly profile: {
    readonly rowCount: number
    readonly columns: ReadonlyArray<{
      readonly ordinal: number
      readonly name: string
      readonly nullCount: number
      readonly distinctCount: number
      readonly minimum: string | null
      readonly maximum: string | null
    }>
  }
}

interface EvaluationCase {
  readonly id: string
  readonly category:
    | 'exact-answer'
    | 'schema-family'
    | 'citation'
    | 'sql-guardrail'
    | 'authentication'
    | 'sidecar-isolation'
    | 'corpus-security'
    | 'recovery'
    | 'negative-control'
  readonly status: 'passed'
  readonly evidenceHash: string
}

interface Phase04EvaluationReportBody {
  readonly schemaVersion: '1.0.0'
  readonly evaluationId: 'phase-04-exact-computation-v1'
  readonly status: 'passed'
  readonly corpus: {
    readonly profile: CorpusProfile
    readonly corpusVersion: typeof CORPUS_VERSION
    readonly generatorVersion: typeof CORPUS_GENERATOR_VERSION
    readonly questionSetVersion: typeof CORPUS_VERSION
    readonly seed: string
    readonly totalFiles: number
    readonly manifestSha256: string
    readonly corpusSha256: string
    readonly groundTruthSha256: string
    readonly questionSetSha256: string
  }
  readonly runtime: {
    readonly host: 'bun'
    readonly hostVersion: string
    readonly protocolVersion: typeof DATA_ENGINE_PROTOCOL_VERSION
    readonly engineVersion: typeof DATA_ENGINE_VERSION
    readonly engineAdapterVersion: typeof DATA_ENGINE_ADAPTER_VERSION
    readonly executionPolicyVersion: typeof DATA_ENGINE_EXECUTION_POLICY_VERSION
    readonly engineConfigHash: string
    readonly modelProvider: 'not-applicable'
  }
  readonly counts: Readonly<Record<EvaluationCase['category'], number>>
  readonly cases: ReadonlyArray<EvaluationCase>
}

export interface Phase04EvaluationReport extends Phase04EvaluationReportBody {
  readonly reportSha256: string
}

export interface Phase04EvaluationResult {
  readonly report: Phase04EvaluationReport
  readonly timings: {
    readonly corpusGenerationMs: number
    readonly materializationMs: number
    readonly exactQueryMs: number
    readonly recoveryMs: number
    readonly totalMs: number
  }
}

export class Phase04EvaluationError
  extends Schema.TaggedError<Phase04EvaluationError>()(
    'Phase04EvaluationError',
    {
      category: Schema.String,
      caseId: Schema.String,
      message: Schema.String,
    },
  ) {}

function sha256(value: string | Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

function evidenceHash(value: unknown): string {
  return sha256(canonicalJson(value))
}

function uuid(sequence: number): string {
  return `940e8400-e29b-41d4-a716-${sequence.toString().padStart(12, '0')}`
}

function fail(category: string, caseId: string, message: string) {
  return new Phase04EvaluationError({ category, caseId, message })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGroundTruth(value: unknown): value is GroundTruth {
  return isRecord(value)
    && Array.isArray(value['expectedSchemas'])
    && isRecord(value['exact'])
    && isRecord(value['securityCases'])
    && Array.isArray(value['recoveryCases'])
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value)
}

function isEvaluationCase(value: unknown): value is EvaluationCase {
  return isRecord(value)
    && typeof value['id'] === 'string'
    && [
      'exact-answer',
      'schema-family',
      'citation',
      'sql-guardrail',
      'authentication',
      'sidecar-isolation',
      'corpus-security',
      'recovery',
      'negative-control',
    ].includes(String(value['category']))
    && value['status'] === 'passed'
    && typeof value['evidenceHash'] === 'string'
}

function isEvaluationReport(value: unknown): value is Phase04EvaluationReport {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== '1.0.0'
    || value['evaluationId'] !== 'phase-04-exact-computation-v1'
    || value['status'] !== 'passed'
    || !isRecord(value['corpus'])
    || !isRecord(value['runtime'])
    || !isRecord(value['counts'])
    || !Array.isArray(value['cases'])
    || !value['cases'].every(isEvaluationCase)
    || !isSha256Hex(value['reportSha256'])
  ) {
    return false
  }
  const corpus = value['corpus']
  const runtime = value['runtime']
  const counts = value['counts']
  return (corpus['profile'] === 'smoke' || corpus['profile'] === 'full')
    && corpus['corpusVersion'] === CORPUS_VERSION
    && corpus['generatorVersion'] === CORPUS_GENERATOR_VERSION
    && corpus['questionSetVersion'] === CORPUS_VERSION
    && typeof corpus['seed'] === 'string'
    && Number.isSafeInteger(corpus['totalFiles'])
    && [
      'manifestSha256',
      'corpusSha256',
      'groundTruthSha256',
      'questionSetSha256',
    ].every((field) => typeof corpus[field] === 'string')
    && runtime['host'] === 'bun'
    && typeof runtime['hostVersion'] === 'string'
    && runtime['protocolVersion'] === DATA_ENGINE_PROTOCOL_VERSION
    && runtime['engineVersion'] === DATA_ENGINE_VERSION
    && runtime['engineAdapterVersion'] === DATA_ENGINE_ADAPTER_VERSION
    && runtime['executionPolicyVersion'] === DATA_ENGINE_EXECUTION_POLICY_VERSION
    && isSha256Digest(runtime['engineConfigHash'])
    && runtime['modelProvider'] === 'not-applicable'
    && Object.keys(expectedCaseCounts).every((category) =>
      Number.isSafeInteger(counts[category]))
    && passesEvaluationGate(value['cases'], expectedCaseCounts['negative-control'])
}

function familyIdentity(familyId: string) {
  switch (familyId) {
    case 'fam.call_log': return familyIds['fam.call_log']
    case 'fam.device_telemetry': return familyIds['fam.device_telemetry']
    case 'fam.transaction': return familyIds['fam.transaction']
    case 'fam.inventory_item': return familyIds['fam.inventory_item']
    default: return undefined
  }
}

function isStringArray(value: unknown): value is ReadonlyArray<string> {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

interface TemperatureAnswer {
  readonly readingId: string
  readonly recordId: string
  readonly temperatureC: number
}

function isTemperatureAnswer(
  value: unknown,
): value is ReadonlyArray<TemperatureAnswer> {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item)
    && typeof item['readingId'] === 'string'
    && typeof item['recordId'] === 'string'
    && typeof item['temperatureC'] === 'number')
}

function logicalType(
  declaredType: string,
): 'boolean' | 'integer' | 'decimal' | 'string' | 'timestamp' | 'json' {
  switch (declaredType) {
    case 'boolean': return 'boolean'
    case 'integer': return 'integer'
    case 'number': return 'decimal'
    case 'timestamp': return 'timestamp'
    case 'nested': return 'json'
    default: return 'string'
  }
}

async function writeArtifact(
  artifactRoot: string,
  bytes: Uint8Array,
): Promise<string> {
  const digest = sha256(bytes)
  const path = resolve(
    artifactRoot,
    'objects',
    'sha256',
    digest.slice(0, 2),
    digest,
  )
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, bytes)
  return digest
}

async function loadGroundTruth(root: string): Promise<GroundTruth> {
  const value: unknown = await Bun.file(resolve(root, 'ground-truth.json')).json()
  if (!isGroundTruth(value)) {
    throw fail('corpus', 'ground-truth', 'Ground truth has an invalid shape')
  }
  return value
}

async function materializeFamilies(
  root: string,
  manifest: import('./corpus.js').CorpusManifest,
  artifactRoot: string,
  baseUrl: string,
  token: string,
): Promise<ReadonlyArray<MaterializedFamily>> {
  const client = makeDataEngineClient({ baseUrl, credential: token })
  const materializedFamilies: MaterializedFamily[] = []
  for (const family of manifest.schemaFamilies) {
    const ids = familyIdentity(family.schemaFamilyId)
    if (ids === undefined) {
      throw fail(
        'schema-family',
        family.schemaFamilyId,
        'Corpus schema family has no evaluation identity',
      )
    }
    const entries = manifest.files.filter(
      (entry) => entry.schemaFamilyId === family.schemaFamilyId,
    )
    const rows = await Effect.runPromise(Effect.forEach(
      entries,
      (entry) => Effect.tryPromise({
        try: () => Bun.file(resolve(root, entry.path)).json() as Promise<unknown>,
        catch: () =>
          fail(
            'materialization',
            entry.path,
            'Corpus record could not be read',
          ),
      }).pipe(
        Effect.flatMap((record) =>
          isRecord(record)
            ? Effect.succeed({ ...record, _record_id: entry.recordId })
            : Effect.fail(fail(
                'materialization',
                entry.path,
                'Corpus record has an invalid shape',
              ))),
      ),
      { concurrency: 64 },
    ))
    const sourceBytes = new TextEncoder().encode(canonicalJson(rows))
    const sourceDigest = await writeArtifact(artifactRoot, sourceBytes)
    const fields = [
      ...family.fields.map((field, ordinal) => ({
        ordinal,
        name: field.name,
        sourceType: field.declaredType,
        logicalType: logicalType(field.declaredType),
        nullable: field.nullable || field.optional,
      })),
      {
        ordinal: family.fields.length,
        name: '_record_id',
        sourceType: 'string',
        logicalType: 'string' as const,
        nullable: false,
      },
    ]
    const started = performance.now()
    const materialized = await Effect.runPromise(client.materialize({
      protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
      operation: 'materialize',
      snapshotId: ids.snapshotId,
      inputs: [{
        ordinal: 0,
        format: 'json',
        artifactDigest: sourceDigest,
        contentHash: Sha256Digest.make(`sha256:${sourceDigest}`),
      }],
      fields,
      limits: {
        maxInputBytes: 64 * 1024 * 1024,
        maxRows: 1_000_000,
        maxOutputBytes: 128 * 1024 * 1024,
        timeoutMs: 60_000,
      },
    }))
    const parquet = await Effect.runPromise(client.readArtifact(
      materialized.artifactToken,
      materialized.parquetDigest,
      128 * 1024 * 1024,
      60_000,
    ))
    if (performance.now() - started > 60_000) {
      throw fail(
        'materialization',
        family.schemaFamilyId,
        'Materialization exceeded its wall-clock budget',
      )
    }
    const parquetDigest = await writeArtifact(artifactRoot, parquet)
    if (
      parquetDigest !== materialized.parquetDigest
      || parquet.byteLength !== materialized.parquetByteLength
      || materialized.profile.rowCount !== entries.length
      || materialized.profile.columns.length !== fields.length
      || materialized.profile.columns.some(
        (column, index) => column.name !== fields[index]?.name,
      )
    ) {
      throw fail(
        'materialization',
        family.schemaFamilyId,
        'Materialized artifact or profile does not match the corpus family',
      )
    }
    const schemaHash = Sha256Digest.make(`sha256:${evidenceHash(fields)}`)
    materializedFamilies.push({
      family,
      binding: {
        alias: ids.alias,
        datasetId: ids.datasetId,
        snapshotId: ids.snapshotId,
        schemaHash,
        parquetDigest,
      },
      sourceDigest,
      parquetDigest,
      parquetByteLength: parquet.byteLength,
      profileHash: materialized.profileHash,
      profile: materialized.profile,
    })
  }
  return materializedFamilies
}

async function seedCatalog(
  sql: import('postgres').Sql,
  families: ReadonlyArray<MaterializedFamily>,
) {
  await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
  await sql.unsafe(
    `INSERT INTO workspaces (id, name) VALUES ($1, 'Phase 04 evaluation')`,
    [workspaceId],
  )
  await sql.unsafe(
    `INSERT INTO projects (id, workspace_id, name)
     VALUES ($1, $2, 'Phase 04 evaluation')`,
    [projectId, workspaceId],
  )
  for (const materialized of families) {
    const ids = familyIdentity(materialized.family.schemaFamilyId)
    if (ids === undefined) {
      throw fail(
        'schema-family',
        materialized.family.schemaFamilyId,
        'Materialized family has no evaluation identity',
      )
    }
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, $3, 'dataset')`,
      [ids.sourceId, projectId, materialized.family.name],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       ) VALUES ($1, $2, 1, $3, $4)`,
      [
        ids.sourceVersionId,
        ids.sourceId,
        `artifact://sha256/${materialized.sourceDigest}`,
        `sha256:${materialized.sourceDigest}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_assets (
         id, workspace_id, project_id, name, lifecycle_status
       ) VALUES ($1, $2, $3, $4, 'active')`,
      [ids.datasetId, workspaceId, projectId, materialized.family.name],
    )
    await sql.unsafe(
      `INSERT INTO dataset_schema_families (
         id, dataset_id, workspace_id, project_id, schema_hash
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        ids.familyId,
        ids.datasetId,
        workspaceId,
        projectId,
        materialized.binding.schemaHash,
      ],
    )
    const fields = [
      ...materialized.family.fields.map((field, ordinal) => ({
        ordinal,
        name: field.name,
        sourceType: field.declaredType,
        logicalType: logicalType(field.declaredType),
        nullable: field.nullable || field.optional,
      })),
      {
        ordinal: materialized.family.fields.length,
        name: '_record_id',
        sourceType: 'string',
        logicalType: 'string',
        nullable: false,
      },
    ]
    for (const field of fields) {
      await sql.unsafe(
        `INSERT INTO dataset_field_schemas (
           schema_family_id, ordinal, name, source_type, logical_type, nullable
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ids.familyId,
          field.ordinal,
          field.name,
          field.sourceType,
          field.logicalType,
          field.nullable,
        ],
      )
    }
    await sql.unsafe(
      `INSERT INTO dataset_snapshots (
         id, dataset_id, workspace_id, project_id, version,
         schema_family_id, content_hash
       ) VALUES ($1, $2, $3, $4, 1, $5, $6)`,
      [
        ids.snapshotId,
        ids.datasetId,
        workspaceId,
        projectId,
        ids.familyId,
        `sha256:${materialized.sourceDigest}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshot_sources (
         snapshot_id, dataset_id, workspace_id, project_id, ordinal,
         source_id, source_version_id, content_hash
       ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        ids.snapshotId,
        ids.datasetId,
        workspaceId,
        projectId,
        ids.sourceId,
        ids.sourceVersionId,
        `sha256:${materialized.sourceDigest}`,
      ],
    )
  }
}

async function persistMaterializationsWithRecovery(
  sql: import('postgres').Sql,
  families: ReadonlyArray<MaterializedFamily>,
  recoveryTruth: GroundTruth['recoveryCases'],
): Promise<ReadonlyArray<EvaluationCase>> {
  const layer = Layer.provide(DatasetMaterializationRepo.Default, SqlClientLive(sql))
  const run = <A, E>(effect: Effect.Effect<A, E, DatasetMaterializationRepo>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))
  const cases: EvaluationCase[] = []
  for (const [index, materialized] of families.entries()) {
    const ids = familyIdentity(materialized.family.schemaFamilyId)
    if (ids === undefined) {
      throw fail(
        'schema-family',
        materialized.family.schemaFamilyId,
        'Materialized family has no evaluation identity',
      )
    }
    await run(DatasetMaterializationRepo.enqueue({
      jobId: ids.jobId,
      workspaceId,
      snapshotId: ids.snapshotId,
      sourceFormats: ['json'],
      maxAttempts: 3,
    }))
    const claimed = await run(DatasetMaterializationRepo.claimNext(5_000))
    if (Option.isNone(claimed) || claimed.value.jobId !== ids.jobId) {
      throw fail('recovery', materialized.family.schemaFamilyId, 'Job was not claimed')
    }
    const result = {
      snapshotId: ids.snapshotId,
      workspaceId,
      projectId,
      datasetId: ids.datasetId,
      parquetRef: `artifact://sha256/${materialized.parquetDigest}` as const,
      parquetHash: Sha256Digest.make(`sha256:${materialized.parquetDigest}`),
      parquetByteLength: materialized.parquetByteLength,
      profileRef: `artifact://sha256/${materialized.profileHash.slice('sha256:'.length)}` as const,
      profileHash: materialized.profileHash,
      profile: materialized.profile,
    }
    if (index !== 0) {
      await run(DatasetMaterializationRepo.complete(claimed.value, result))
      continue
    }
    await sql.unsafe(
      `CREATE OR REPLACE FUNCTION fail_phase_04_evaluation_event()
       RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.entity_type = 'dataset-materialization'
            AND NEW.entity_id = '${ids.snapshotId}'::uuid THEN
           RAISE EXCEPTION 'phase-04-injected-event-boundary';
         END IF;
         RETURN NEW;
       END $$`,
    )
    await sql.unsafe(
      `CREATE TRIGGER fail_phase_04_evaluation_event
       BEFORE INSERT ON event_journal
       FOR EACH ROW EXECUTE FUNCTION fail_phase_04_evaluation_event()`,
    )
    const interrupted = await (async () => {
      try {
        return await Effect.runPromiseExit(
          DatasetMaterializationRepo.complete(claimed.value, result).pipe(
            Effect.provide(layer),
          ),
        )
      } finally {
        await sql.unsafe(
          'DROP TRIGGER IF EXISTS fail_phase_04_evaluation_event ON event_journal',
        )
        await sql.unsafe(
          'DROP FUNCTION IF EXISTS fail_phase_04_evaluation_event()',
        )
      }
    })()
    const rolledBack = await sql.unsafe(
      `SELECT
         (SELECT count(*) FROM dataset_materializations
          WHERE snapshot_id = $1) AS materializations,
         (SELECT status FROM job_queue WHERE id = $2) AS status`,
      [ids.snapshotId, ids.jobId],
    )
    if (
      interrupted._tag !== 'Failure'
      || Number(rolledBack[0]?.['materializations']) !== 0
      || rolledBack[0]?.['status'] !== 'in-progress'
    ) {
      throw fail(
        'recovery',
        'transaction-rollback',
        'Injected event failure did not atomically roll back completion',
      )
    }
    await sql.unsafe(
      `UPDATE dataset_materialization_jobs
       SET lease_expires_at = clock_timestamp() - interval '1 second'
       WHERE job_id = $1`,
      [ids.jobId],
    )
    if (await run(DatasetMaterializationRepo.recoverExpired()) !== 1) {
      throw fail('recovery', 'lease-expiry', 'Expired lease was not recovered')
    }
    await sql.unsafe(
      `UPDATE job_queue
       SET updated_at = clock_timestamp() - interval '6 seconds'
       WHERE id = $1`,
      [ids.jobId],
    )
    const reclaimed = await run(DatasetMaterializationRepo.claimNext(5_000))
    if (
      Option.isNone(reclaimed)
      || reclaimed.value.attempt !== claimed.value.attempt + 1
      || reclaimed.value.leaseToken === claimed.value.leaseToken
    ) {
      throw fail(
        'recovery',
        'lease-reclaim',
        'Recovered work did not receive a new attempt and lease',
      )
    }
    const stale = await Effect.runPromiseExit(
      DatasetMaterializationRepo.complete(claimed.value, result).pipe(
        Effect.provide(layer),
      ),
    )
    if (stale._tag !== 'Failure') {
      throw fail('recovery', 'stale-attempt-fence', 'Stale attempt completed')
    }
    await run(DatasetMaterializationRepo.complete(reclaimed.value, result))
    const durable = await sql.unsafe(
      `SELECT
         (SELECT count(*) FROM dataset_materializations
          WHERE snapshot_id = $1) AS materializations,
         (SELECT count(*) FROM event_journal
          WHERE entity_type = 'dataset-materialization'
            AND entity_id = $1
            AND event_type = 'dataset-materialized') AS events,
         (SELECT status FROM job_queue WHERE id = $2) AS status`,
      [ids.snapshotId, ids.jobId],
    )
    if (
      Number(durable[0]?.['materializations']) !== 1
      || Number(durable[0]?.['events']) !== 1
      || durable[0]?.['status'] !== 'completed'
    ) {
      throw fail(
        'recovery',
        'idempotent-replay',
        'Recovered completion produced duplicate or partial durable state',
      )
    }
    const boundaryEvidence: Readonly<Record<string, unknown>> = {
      discovery: {
        claimedSnapshotId: reclaimed.value.snapshotId,
        expectedSnapshotId: ids.snapshotId,
      },
      hashing: {
        parquetHash: result.parquetHash,
        expectedHash: `sha256:${materialized.parquetDigest}`,
      },
      'artifact-persistence': {
        materializations: Number(durable[0]?.['materializations']),
      },
      'version-creation': {
        snapshotId: result.snapshotId,
        datasetId: result.datasetId,
      },
      'event-publication': {
        events: Number(durable[0]?.['events']),
      },
      checkpoint: {
        status: durable[0]?.['status'],
        attempt: reclaimed.value.attempt,
        staleAttemptRejected: stale._tag === 'Failure',
      },
    }
    for (const recoveryCase of recoveryTruth) {
      const evidence = boundaryEvidence[recoveryCase.boundary]
      if (evidence === undefined) {
        throw fail(
          'recovery',
          recoveryCase.boundary,
          'Ground-truth recovery boundary has no real evaluator probe',
        )
      }
      cases.push({
        id: `RECOVERY-${recoveryCase.boundary}`,
        category: 'recovery',
        status: 'passed',
        evidenceHash: evidenceHash({
          boundary: recoveryCase.boundary,
          expected: recoveryCase.expected,
          evidence,
        }),
      })
    }
  }
  return cases
}

const exactQueries = [{
  id: 'EXACT-COUNT-FAILED',
  families: ['fam.call_log'],
  sql: "SELECT count(*) AS value FROM call_logs WHERE status = 'failed' ORDER BY ALL",
}, {
  id: 'EXACT-PERCENT-NULL-OWNER',
  families: ['fam.inventory_item'],
  sql: `SELECT sum(CASE WHEN owner_id IS NULL THEN 1 ELSE 0 END) AS numerator,
               count(*) AS denominator
        FROM inventory ORDER BY ALL`,
}, {
  id: 'EXACT-GROUP-BY-REGION',
  families: ['fam.call_log'],
  sql: 'SELECT region, count(*) AS count FROM call_logs GROUP BY region ORDER BY ALL',
}, {
  id: 'EXACT-FILTER-CRITICAL-FAILED',
  families: ['fam.call_log'],
  sql: `SELECT _record_id FROM call_logs
        WHERE severity = 'critical' AND status = 'failed' ORDER BY ALL`,
}, {
  id: 'EXACT-TOP-TEMPERATURES',
  families: ['fam.device_telemetry'],
  sql: `WITH ranked AS (
          SELECT reading_id, _record_id, temperature_c
          FROM telemetry
          ORDER BY temperature_c DESC, reading_id
          LIMIT 5
        )
        SELECT reading_id, _record_id, temperature_c FROM ranked ORDER BY ALL`,
}, {
  id: 'EXACT-JOIN-FAILED-TRANSACTIONS',
  families: ['fam.call_log', 'fam.transaction'],
  sql: `SELECT count(*) AS value
        FROM call_logs
        JOIN transactions
          ON transactions.incident_id = call_logs.incident_id
        WHERE call_logs.status = 'failed' ORDER BY ALL`,
}, {
  id: 'EXACT-MONTHLY-COUNTS',
  families: ['fam.call_log'],
  sql: `SELECT CAST(EXTRACT(month FROM occurred_at) AS INTEGER) AS month,
               count(*) AS count
        FROM call_logs GROUP BY month ORDER BY ALL`,
}, {
  id: 'EXACT-DISTINCT-CATEGORIES',
  families: ['fam.inventory_item'],
  sql: 'SELECT DISTINCT category FROM inventory ORDER BY ALL',
}] as const

function valueAt(
  result: import('@struct/data-engine').QueryResult,
  row: number,
  column: string,
): string | null {
  const ordinal = result.columns.find((candidate) => candidate.name === column)?.ordinal
  if (ordinal === undefined) return null
  const value = result.rows[row]?.[ordinal]
  return value === null || value === undefined ? null : String(value)
}

function normalizeAnswer(
  id: string,
  result: import('@struct/data-engine').QueryResult,
): unknown {
  switch (id) {
    case 'EXACT-COUNT-FAILED':
    case 'EXACT-JOIN-FAILED-TRANSACTIONS':
      return Number(valueAt(result, 0, 'value'))
    case 'EXACT-PERCENT-NULL-OWNER': {
      const numerator = Number(valueAt(result, 0, 'numerator'))
      const denominator = Number(valueAt(result, 0, 'denominator'))
      return {
        numerator,
        denominator,
        percentBasisPoints: Math.round(numerator * 10_000 / denominator),
      }
    }
    case 'EXACT-GROUP-BY-REGION':
      return Object.fromEntries(result.rows.map((_, index) => [
        valueAt(result, index, 'region'),
        Number(valueAt(result, index, 'count')),
      ]))
    case 'EXACT-FILTER-CRITICAL-FAILED':
      return result.rows.map((_, index) => valueAt(result, index, '_record_id'))
        .toSorted()
    case 'EXACT-TOP-TEMPERATURES':
      return result.rows.map((_, index) => ({
        readingId: valueAt(result, index, 'reading_id'),
        recordId: valueAt(result, index, '_record_id'),
        temperatureC: Number(valueAt(result, index, 'temperature_c')),
      })).toSorted((left, right) =>
        String(left.readingId).localeCompare(String(right.readingId)))
    case 'EXACT-MONTHLY-COUNTS':
      return Object.fromEntries(result.rows.map((_, index) => [
        `2026-${String(Number(valueAt(result, index, 'month'))).padStart(2, '0')}`,
        Number(valueAt(result, index, 'count')),
      ]))
    case 'EXACT-DISTINCT-CATEGORIES':
      return result.rows.map((_, index) => valueAt(result, index, 'category'))
    default:
      return undefined
  }
}

function answersMatch(id: string, actual: unknown, expected: unknown): boolean {
  if (id !== 'EXACT-TOP-TEMPERATURES') {
    const normalizedExpected =
      id === 'EXACT-FILTER-CRITICAL-FAILED' && isStringArray(expected)
        ? expected.toSorted()
        : expected
    return canonicalJson(actual) === canonicalJson(normalizedExpected)
  }
  if (!isTemperatureAnswer(actual) || !isTemperatureAnswer(expected)) {
    return false
  }
  const expectedRows = expected.toSorted((left, right) =>
    left.readingId.localeCompare(right.readingId))
  return actual.length === expectedRows.length
    && actual.every((row, index) => {
      const target = expectedRows[index]
      return target !== undefined
        && row.readingId === target.readingId
        && row.recordId === target.recordId
        && Math.abs(row.temperatureC - target.temperatureC) < 0.000_000_1
    })
}

async function runExactQueries(
  sql: import('postgres').Sql,
  families: ReadonlyArray<MaterializedFamily>,
  groundTruth: GroundTruth,
  baseUrl: string,
  token: string,
): Promise<{
  readonly cases: ReadonlyArray<EvaluationCase>
  readonly engineVersion: typeof DATA_ENGINE_VERSION
  readonly engineAdapterVersion: typeof DATA_ENGINE_ADAPTER_VERSION
  readonly executionPolicyVersion: typeof DATA_ENGINE_EXECUTION_POLICY_VERSION
  readonly engineConfigHash: string
}> {
  const client = makeDataEngineClient({ baseUrl, credential: token })
  const materializationLayer = Layer.provide(
    DatasetMaterializationRepo.Default,
    SqlClientLive(sql),
  )
  const evidenceLayer = Layer.provide(
    DatasetQueryEvidenceRepo.Default,
    SqlClientLive(sql),
  )
  const service = makeReadOnlySqlService({
    authorization: {
      authenticate: (supplied) =>
        supplied === credential
          ? Effect.succeed({ userId: 'phase-04-evaluator' })
          : Effect.fail(new DatasetQueryAuthenticationError({
              message: 'Evaluation credential was rejected',
            })),
      authorize: (_principal, requestedWorkspaceId, requestedProjectId) =>
        requestedWorkspaceId === workspaceId && requestedProjectId === projectId
          ? Effect.void
          : Effect.fail(new DatasetQueryAuthorizationError({
              message: 'Evaluation scope was rejected',
            })),
    },
    catalog: {
      resolve: (requestedWorkspaceId, requestedProjectId, snapshots) =>
        DatasetMaterializationRepo.resolveQuerySnapshots(
          requestedWorkspaceId,
          requestedProjectId,
          snapshots,
        ).pipe(
          Effect.provide(materializationLayer),
          Effect.mapError(() =>
            new DatasetQueryCatalogError({
              message: 'Evaluation catalog resolution failed',
            })),
        ),
    },
    client,
  })
  const cases: EvaluationCase[] = []
  let engineVersion: typeof DATA_ENGINE_VERSION = DATA_ENGINE_VERSION
  let engineAdapterVersion: typeof DATA_ENGINE_ADAPTER_VERSION = DATA_ENGINE_ADAPTER_VERSION
  let executionPolicyVersion: typeof DATA_ENGINE_EXECUTION_POLICY_VERSION =
    DATA_ENGINE_EXECUTION_POLICY_VERSION
  let engineConfigHash = ''
  let identity = 100
  for (const query of exactQueries) {
    const bindings = query.families.map((familyId) => {
      const materialized = families.find(
        (candidate) => candidate.family.schemaFamilyId === familyId,
      )
      if (materialized === undefined) {
        throw fail('exact-answer', query.id, `Missing ${familyId} materialization`)
      }
      return materialized.binding
    })
    let actualResult: import('@struct/data-engine').QueryResult | undefined
    const tool = makeDeterministicDatasetQueryService({
      query: {
        execute: (input) => service.execute(input).pipe(
          Effect.tap((result) => Effect.sync(() => {
            actualResult = result
          })),
        ),
      },
      store: {
        record: (result, citations) =>
          DatasetQueryEvidenceRepo.record(result, citations).pipe(
            Effect.provide(evidenceLayer),
            Effect.mapError(() =>
              new DatasetQueryToolPersistenceError({
                message: 'Evaluation evidence persistence failed',
              })),
          ),
      },
      identity: {
        resultId: () => QueryResultSnapshotId.make(uuid(identity++)),
        citationId: () => DatasetCitationId.make(uuid(identity++)),
        now: () => BigInt(fixedTime),
      },
    })
    let preview: import('@struct/data-engine').QueryResult
    try {
      preview = await Effect.runPromise(service.execute({
        credential,
        workspaceId,
        projectId,
        sql: query.sql,
        snapshots: bindings.map((binding) => ({
          alias: binding.alias,
          datasetId: binding.datasetId,
          snapshotId: binding.snapshotId,
        })),
        limits: {
          maxRows: 10_000,
          maxOutputBytes: 4 * 1024 * 1024,
          maxMemoryMb: 192,
          timeoutMs: 60_000,
        },
      }))
    } catch {
      throw fail(
        'exact-answer',
        query.id,
        `${query.id} exact SQL request failed`,
      )
    }
    const citations: ReadonlyArray<
      import('@struct/data-engine').DatasetCitationRequest
    > = bindings.map(
      (binding) => ({
        datasetId: binding.datasetId,
        datasetSnapshotId: binding.snapshotId,
        selectedColumns: preview.columns.map((column) => column.name),
        rowStart: 0,
        rowEndExclusive: preview.rows.length,
      }),
    )
    let output: import('@struct/data-engine').DeterministicDatasetQueryOutput
    try {
      output = await Effect.runPromise(tool.execute({
        query: {
          credential,
          workspaceId,
          projectId,
          sql: query.sql,
          snapshots: bindings.map((binding) => ({
            alias: binding.alias,
            datasetId: binding.datasetId,
            snapshotId: binding.snapshotId,
          })),
          limits: {
            maxRows: 10_000,
            maxOutputBytes: 4 * 1024 * 1024,
            maxMemoryMb: 192,
            timeoutMs: 60_000,
          },
        },
        citations,
      }))
    } catch {
      throw fail(
        'citation',
        query.id,
        `${query.id} exact evidence persistence failed`,
      )
    }
    if (actualResult === undefined) {
      throw fail('exact-answer', query.id, 'Query tool did not execute SQL')
    }
    const expected = groundTruth.exact[query.id]?.answer
    const answer = normalizeAnswer(query.id, actualResult)
    if (!answersMatch(query.id, answer, expected)) {
      throw fail(
        'exact-answer',
        query.id,
        `Exact result did not match independent ground truth: ${canonicalJson(answer).trim()}`,
      )
    }
    engineVersion = output.result.engineVersion
    engineAdapterVersion = output.result.engineAdapterVersion
    executionPolicyVersion = output.result.executionPolicyVersion
    engineConfigHash = output.result.engineConfigHash
    cases.push({
      id: query.id,
      category: 'exact-answer',
      status: 'passed',
      evidenceHash: evidenceHash({
        answer,
        resultHash: output.result.resultHash,
        resultArtifactHash: output.result.resultArtifactHash,
      }),
    })
    for (const citation of output.citations) {
      const reopened = await Effect.runPromise(
        DatasetQueryEvidenceRepo.reopen(
          workspaceId,
          projectId,
          citation.id,
        ).pipe(Effect.provide(evidenceLayer)),
      )
      if (
        canonicalJson(reopened.rows) !== canonicalJson(output.result.rows)
        || reopened.snapshot.resultHash !== output.result.resultHash
        || reopened.snapshot.resultArtifactHash !== output.result.resultArtifactHash
      ) {
        throw fail(
          'citation',
          `${query.id}:${citation.datasetSnapshotId}`,
          'Citation did not reopen exact immutable evidence',
        )
      }
      cases.push({
        id: `CITATION-${query.id}-${citation.datasetSnapshotId}`,
        category: 'citation',
        status: 'passed',
        evidenceHash: evidenceHash({
          citationId: citation.id,
          resultHash: reopened.snapshot.resultHash,
          rows: reopened.rows,
        }),
      })
    }
  }
  return {
    cases,
    engineVersion,
    engineAdapterVersion,
    executionPolicyVersion,
    engineConfigHash,
  }
}

async function runSecurityCases(
  baseUrl: string,
  token: string,
  families: ReadonlyArray<MaterializedFamily>,
): Promise<ReadonlyArray<EvaluationCase>> {
  const primary = families[0]?.binding
  const secondary = families[2]?.binding
  if (primary === undefined || secondary === undefined) {
    throw fail('security', 'bindings', 'Security evaluation bindings are missing')
  }
  const base = {
    protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
    operation: 'query',
    workspaceId,
    projectId,
    sql: 'SELECT count(*) AS value FROM call_logs ORDER BY ALL',
    snapshots: [primary],
    limits: {
      maxRows: 100,
      maxOutputBytes: 100_000,
      maxMemoryMb: 64,
      timeoutMs: 5_000,
    },
  }
  const request = async (
    caseId: string,
    body: unknown,
    expectedCode: string,
    suppliedToken = token,
  ): Promise<EvaluationCase> => {
    const response = await fetch(`${baseUrl}/v1/query`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${suppliedToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const payload: unknown = await response.json()
    const code =
      typeof payload === 'object'
      && payload !== null
      && 'error' in payload
      && typeof payload.error === 'object'
      && payload.error !== null
      && 'code' in payload.error
      ? payload.error.code
      : undefined
    if (response.ok || code !== expectedCode) {
      throw fail(
        'security',
        caseId,
        `Unsafe request did not fail with ${expectedCode}`,
      )
    }
    return {
      id: caseId,
      category: expectedCode === 'authentication'
        ? 'authentication'
        : 'sql-guardrail',
      status: 'passed',
      evidenceHash: evidenceHash({ caseId, status: response.status, code }),
    }
  }
  const cases: EvaluationCase[] = []
  cases.push(await request(
    'AUTH-BAD-TOKEN',
    base,
    'authentication',
    'wrong-evaluation-token',
  ))
  cases.push(await request(
    'SQL-MUTATION',
    { ...base, sql: 'DELETE FROM call_logs ORDER BY ALL' },
    'invalid-query',
  ))
  cases.push(await request(
    'SQL-ATTACH',
    { ...base, sql: "ATTACH '/tmp/db' ORDER BY ALL" },
    'invalid-query',
  ))
  cases.push(await request(
    'SQL-COMMENT-BYPASS',
    { ...base, sql: 'SELECT * FROM call_logs -- x ORDER BY ALL' },
    'invalid-query',
  ))
  cases.push(await request(
    'SQL-NO-TOTAL-ORDER',
    { ...base, sql: 'SELECT * FROM call_logs' },
    'invalid-query',
  ))
  cases.push(await request(
    'SQL-FUNCTION-BYPASS',
    { ...base, sql: 'SELECT random() FROM call_logs ORDER BY ALL' },
    'invalid-query',
  ))
  cases.push(await request(
    'PATH-ABSOLUTE',
    {
      ...base,
      sql: "SELECT read_parquet('/etc/passwd') FROM call_logs ORDER BY ALL",
    },
    'invalid-query',
  ))
  cases.push(await request(
    'EGRESS-HTTP',
    {
      ...base,
      sql: "SELECT read_json_auto('http://example.test/data') FROM call_logs ORDER BY ALL",
    },
    'invalid-query',
  ))
  cases.push(await request(
    'SQL-UNUSED-BINDING',
    { ...base, snapshots: [primary, secondary] },
    'lineage',
  ))
  cases.push(await request(
    'SQL-RESOURCE-LIMIT',
    { ...base, limits: { ...base.limits, maxMemoryMb: 193 } },
    'resource-limit',
  ))
  const expensiveSql = `SELECT sum(r01.duration_ms)
    FROM call_logs r01
    ${Array.from(
      { length: 20 },
      (_, index) =>
        `CROSS JOIN call_logs r${String(index + 2).padStart(2, '0')}`,
    ).join('\n')}
    ORDER BY ALL`
  const encoded = JSON.stringify({
    ...base,
    sql: expensiveSql,
    limits: { ...base.limits, timeoutMs: 5_000 },
  })
  const url = new URL(baseUrl)
  const cancellationSocket = await new Promise<ReturnType<typeof createConnection>>(
    (resolveStarted, rejectStarted) => {
      const socket = createConnection({
        host: url.hostname,
        port: Number(url.port || 80),
      })
      socket.once('error', rejectStarted)
      const timeout = setTimeout(() => {
        socket.destroy()
        rejectStarted(fail(
          'sidecar-isolation',
          'CANCEL-CLIENT-DISCONNECT',
          'Expensive query did not emit its start handshake',
        ))
      }, 5_000)
      let responsePrefix = ''
      socket.on('data', (chunk) => {
        responsePrefix += chunk.toString()
        if (!responsePrefix.includes('102 Processing')) return
        clearTimeout(timeout)
        resolveStarted(socket)
      })
      socket.once('connect', () => {
        socket.write([
          'POST /v1/query HTTP/1.1',
          `Host: ${url.host}`,
          `Authorization: Bearer ${token}`,
          'Content-Type: application/json',
          `Content-Length: ${Buffer.byteLength(encoded)}`,
          'Connection: close',
          '',
          encoded,
        ].join('\r\n'))
      })
    },
  )
  cancellationSocket.destroy()
  let recoveredStatus = 0
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/query`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(base),
    })
    recoveredStatus = response.status
    await response.arrayBuffer()
    if (response.ok) break
    await Bun.sleep(10)
  }
  if (recoveredStatus !== 200) {
    throw fail(
      'sidecar-isolation',
      'CANCEL-CLIENT-DISCONNECT',
      'Sidecar did not recover after client cancellation',
    )
  }
  cases.push({
    id: 'CANCEL-CLIENT-DISCONNECT',
    category: 'sidecar-isolation',
    status: 'passed',
    evidenceHash: evidenceHash({
      cancellation: 'client-disconnect',
      startHandshake: '102 Processing',
      subsequentStatus: recoveredStatus,
    }),
  })
  const service = makeReadOnlySqlService({
    authorization: {
      authenticate: (supplied) =>
        supplied === credential
          ? Effect.succeed({ userId: 'phase-04-evaluator' })
          : Effect.fail(new DatasetQueryAuthenticationError({
              message: 'Evaluation credential was rejected',
            })),
      authorize: () =>
        Effect.fail(new DatasetQueryAuthorizationError({
          message: 'Cross-workspace access was rejected',
        })),
    },
    catalog: {
      resolve: () => Effect.die('catalog must not run after authorization failure'),
    },
    client: {
      query: () => Effect.die('client must not run after authorization failure'),
    },
  })
  const crossScope = await Effect.runPromiseExit(service.execute({
    credential,
    workspaceId,
    projectId,
    sql: base.sql,
    snapshots: [{
      alias: primary.alias,
      datasetId: primary.datasetId,
      snapshotId: primary.snapshotId,
    }],
    limits: base.limits,
  }))
  if (
    crossScope._tag !== 'Failure'
    || !(crossScope.cause.toString().includes('DatasetQueryAuthorizationError'))
  ) {
    throw fail(
      'authentication',
      'AUTH-CROSS-WORKSPACE',
      'Cross-workspace authorization did not fail before catalog access',
    )
  }
  cases.push({
    id: 'AUTH-CROSS-WORKSPACE',
    category: 'authentication',
    status: 'passed',
    evidenceHash: evidenceHash({
      error: 'DatasetQueryAuthorizationError',
      catalogRead: false,
      sidecarCall: false,
    }),
  })
  return cases
}

async function runCorpusSecurityCases(
  groundTruth: GroundTruth,
  families: ReadonlyArray<MaterializedFamily>,
  baseUrl: string,
  token: string,
): Promise<ReadonlyArray<EvaluationCase>> {
  const client = makeDataEngineClient({ baseUrl, credential: token })
  const cases: EvaluationCase[] = []
  for (const [securityClass, expectedRecordIds] of Object.entries(
    groundTruth.securityCases,
  )) {
    const materializedRecordIds = new Set<string>()
    for (let offset = 0; offset < expectedRecordIds.length; offset += 200) {
      const literals = expectedRecordIds.slice(offset, offset + 200).map(
        (recordId) => `'${recordId.replaceAll("'", "''")}'`,
      ).join(', ')
      for (const materialized of families) {
        const result = await Effect.runPromise(client.query({
          protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
          operation: 'query',
          workspaceId,
          projectId,
          sql: `SELECT _record_id FROM ${materialized.binding.alias}
                WHERE _record_id IN (${literals}) ORDER BY ALL`,
          snapshots: [materialized.binding],
          limits: {
            maxRows: 10_000,
            maxOutputBytes: 4 * 1024 * 1024,
            maxMemoryMb: 128,
            timeoutMs: 30_000,
          },
        }))
        for (let index = 0; index < result.rows.length; index += 1) {
          const recordId = valueAt(result, index, '_record_id')
          if (recordId !== null) materializedRecordIds.add(recordId)
        }
      }
    }
    if (
      expectedRecordIds.some(
        (recordId) => !materializedRecordIds.has(recordId),
      )
    ) {
      throw fail(
        'corpus-security',
        securityClass,
        `Tagged ${securityClass} records did not survive exact materialization and query`,
      )
    }
    cases.push({
      id: `CORPUS-SECURITY-${securityClass}`,
      category: 'corpus-security',
      status: 'passed',
      evidenceHash: evidenceHash({
        securityClass,
        recordIds: expectedRecordIds.toSorted(),
      }),
    })
  }
  return cases
}

async function dockerInspect(name: string): Promise<Record<string, unknown>> {
  const process = Bun.spawn(['docker', 'inspect', name], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const output: unknown = await new Response(process.stdout).json()
  if (
    await process.exited !== 0
    || !Array.isArray(output)
    || !isRecord(output[0])
  ) {
    throw fail(
      'sidecar-isolation',
      name,
      'Docker isolation state could not be inspected',
    )
  }
  return output[0]
}

async function runContainerIsolationCases(): Promise<
  ReadonlyArray<EvaluationCase>
> {
  const sidecar = await dockerInspect('struct-data-engine')
  const gateway = await dockerInspect('struct-data-engine-gateway')
  const sidecarHost = sidecar['HostConfig']
  const gatewayHost = gateway['HostConfig']
  const sidecarMounts = sidecar['Mounts']
  const gatewayMounts = gateway['Mounts']
  const sidecarNetworks = isRecord(sidecar['NetworkSettings'])
    ? sidecar['NetworkSettings']['Networks']
    : undefined
  const gatewayPorts = isRecord(gateway['NetworkSettings'])
    ? gateway['NetworkSettings']['Ports']
    : undefined
  if (
    !isRecord(sidecarHost)
    || sidecarHost['ReadonlyRootfs'] !== true
    || !Array.isArray(sidecarHost['CapDrop'])
    || !sidecarHost['CapDrop'].includes('ALL')
    || !Array.isArray(sidecarHost['SecurityOpt'])
    || !sidecarHost['SecurityOpt'].includes('no-new-privileges:true')
    || !Array.isArray(sidecarMounts)
    || sidecarMounts.length !== 2
    || !sidecarMounts.some((mount) =>
      isRecord(mount)
      && mount['Destination'] === '/artifacts'
      && mount['RW'] === false)
    || !sidecarMounts.some((mount) =>
      isRecord(mount)
      && mount['Destination'] === '/scratch'
      && mount['Type'] === 'volume')
    || !isRecord(sidecarNetworks)
    || Object.keys(sidecarNetworks).length !== 1
  ) {
    throw fail(
      'sidecar-isolation',
      'ISOLATION-SIDECAR-CONTAINER',
      'Sidecar container isolation policy is not enforced',
    )
  }
  const networkName = Object.keys(sidecarNetworks)[0]
  if (networkName === undefined) {
    throw fail(
      'sidecar-isolation',
      'ISOLATION-INTERNAL-NETWORK',
      'Sidecar internal network is missing',
    )
  }
  const network = await dockerInspect(networkName)
  if (network['Internal'] !== true) {
    throw fail(
      'sidecar-isolation',
      'ISOLATION-INTERNAL-NETWORK',
      'Sidecar network permits external routing',
    )
  }
  const loopbackBindings = isRecord(gatewayPorts)
    && Array.isArray(gatewayPorts['4300/tcp'])
    ? gatewayPorts['4300/tcp']
    : []
  if (
    !isRecord(gatewayHost)
    || gatewayHost['ReadonlyRootfs'] !== true
    || !Array.isArray(gatewayMounts)
    || gatewayMounts.length !== 0
    || loopbackBindings.length !== 1
    || !isRecord(loopbackBindings[0])
    || loopbackBindings[0]['HostIp'] !== '127.0.0.1'
  ) {
    throw fail(
      'sidecar-isolation',
      'ISOLATION-FIXED-GATEWAY',
      'Gateway is not mount-free and loopback-bound',
    )
  }
  return [{
    id: 'ISOLATION-SIDECAR-CONTAINER',
    category: 'sidecar-isolation',
    status: 'passed',
    evidenceHash: evidenceHash({
      internalNetwork: networkName,
      readOnlyRoot: true,
      artifactMountReadOnly: true,
      scratchVolumeOnly: true,
      capabilitiesDropped: true,
    }),
  }, {
    id: 'ISOLATION-FIXED-GATEWAY',
    category: 'sidecar-isolation',
    status: 'passed',
    evidenceHash: evidenceHash({
      mounts: 0,
      hostIp: '127.0.0.1',
      readOnlyRoot: true,
    }),
  }]
}

function expectedDuckType(declaredType: string): string {
  if (declaredType === 'nested') return 'VARCHAR'
  switch (logicalType(declaredType)) {
    case 'boolean': return 'BOOLEAN'
    case 'integer': return 'BIGINT'
    case 'decimal': return 'DECIMAL(38,18)'
    case 'timestamp': return 'TIMESTAMP'
    case 'json': return 'VARCHAR'
    case 'string': return 'VARCHAR'
  }
}

async function schemaCases(
  manifest: import('./corpus.js').CorpusManifest,
  families: ReadonlyArray<MaterializedFamily>,
  expectedSchemas: GroundTruth['expectedSchemas'],
  baseUrl: string,
  token: string,
): Promise<ReadonlyArray<EvaluationCase>> {
  const client = makeDataEngineClient({ baseUrl, credential: token })
  const cases: EvaluationCase[] = []
  for (const family of manifest.schemaFamilies) {
    const actual = families.find(
      (candidate) => candidate.family.schemaFamilyId === family.schemaFamilyId,
    )
    const expected = expectedSchemas.find(
      (candidate) => candidate.schemaFamilyId === family.schemaFamilyId,
    )
    if (
      actual === undefined
      || expected === undefined
      || canonicalJson(family) !== canonicalJson(expected)
      || actual.profile.rowCount !== family.recordCount
      || actual.profile.columns.length !== family.fields.length + 1
      || actual.profile.columns.some((column, index) =>
        index < family.fields.length
          ? column.name !== family.fields[index]?.name
          : column.name !== '_record_id')
      || family.fields.some((field, index) =>
        !(field.nullable || field.optional)
        && actual.profile.columns[index]?.nullCount !== 0)
    ) {
      throw fail(
        'schema-family',
        family.schemaFamilyId,
        'Schema family profile does not match the manifest',
      )
    }
    const result = await Effect.runPromise(client.query({
      protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
      operation: 'query',
      workspaceId,
      projectId,
      sql: `SELECT * FROM ${actual.binding.alias} ORDER BY ALL LIMIT 1`,
      snapshots: [actual.binding],
      limits: {
        maxRows: 1,
        maxOutputBytes: 100_000,
        maxMemoryMb: 64,
        timeoutMs: 5_000,
      },
    }))
    const expectedColumns = [
      ...family.fields.map((field, ordinal) => ({
        ordinal,
        name: field.name,
        type: expectedDuckType(field.declaredType),
      })),
      {
        ordinal: family.fields.length,
        name: '_record_id',
        type: 'VARCHAR',
      },
    ]
    if (canonicalJson(result.columns) !== canonicalJson(expectedColumns)) {
      throw fail(
        'schema-family',
        family.schemaFamilyId,
        `Observed DuckDB schema types do not match independent ground truth: ${canonicalJson({
          actual: result.columns,
          expected: expectedColumns,
        }).trim()}`,
      )
    }
    cases.push({
      id: `SCHEMA-${family.schemaFamilyId}`,
      category: 'schema-family',
      status: 'passed',
      evidenceHash: evidenceHash({
        family: family.schemaFamilyId,
        fields: family.fields,
        profile: actual.profile,
        observedColumns: result.columns,
      }),
    })
  }
  return cases
}

const expectedCaseCounts: Readonly<Record<EvaluationCase['category'], number>> = {
  'exact-answer': 8,
  'schema-family': 4,
  citation: 9,
  'sql-guardrail': 9,
  authentication: 2,
  'sidecar-isolation': 3,
  'corpus-security': 8,
  recovery: 6,
  'negative-control': 2,
}

function passesEvaluationGate(
  cases: ReadonlyArray<EvaluationCase>,
  expectedNegativeControls: number,
): boolean {
  return Object.entries(expectedCaseCounts).every(([category, expected]) =>
    cases.filter((item) => item.category === category).length
      === (category === 'negative-control' ? expectedNegativeControls : expected))
    && cases.every((item) => item.status === 'passed')
    && new Set(cases.map((item) => item.id)).size === cases.length
}

function negativeControlCases(
  groundTruth: GroundTruth,
  coreCases: ReadonlyArray<EvaluationCase>,
): ReadonlyArray<EvaluationCase> {
  const expected = groundTruth.exact['EXACT-COUNT-FAILED']?.answer
  const weakenedPolicyCases = coreCases.filter(
    (evaluationCase) => evaluationCase.id !== 'SQL-MUTATION',
  )
  if (
    answersMatch('EXACT-COUNT-FAILED', 0, expected)
    || answersMatch('EXACT-COUNT-FAILED', Number(expected) + 1, expected)
    || passesEvaluationGate(weakenedPolicyCases, 0)
  ) {
    throw fail(
      'negative-control',
      'MUTATION-DETECTION',
      'Evaluator accepted a deliberately wrong result',
    )
  }
  return [{
    id: 'NEGATIVE-PLAUSIBLE-WRONG-ANSWER',
    category: 'negative-control',
    status: 'passed',
    evidenceHash: evidenceHash({
      expected,
      rejected: [0, Number(expected) + 1],
    }),
  }, {
    id: 'NEGATIVE-WEAKENED-POLICY',
    category: 'negative-control',
    status: 'passed',
    evidenceHash: evidenceHash({
      mutation: 'allow-unsafe-sql',
      expected: 'rejected',
    }),
  }]
}

export const runPhase04Evaluation = Effect.fn('runPhase04Evaluation')(
  function* (options: {
    readonly profile: CorpusProfile
    readonly outputRoot: string
    readonly artifactRoot: string
    readonly databaseUrl: string
    readonly dataEngineUrl: string
    readonly dataEngineToken: string
    readonly reportPath?: string
  }) {
    const started = performance.now()
    const firstRoot = resolve(options.outputRoot, 'first')
    const secondRoot = resolve(options.outputRoot, 'second')
    const corpusStarted = performance.now()
    yield* Effect.tryPromise({
      try: () => generateCorpus({
        outDir: firstRoot,
        profile: options.profile,
        seed: CORPUS_CANONICAL_SEED,
      }),
      catch: () => fail('corpus', 'generation-first', 'First corpus generation failed'),
    })
    yield* Effect.tryPromise({
      try: () => generateCorpus({
        outDir: secondRoot,
        profile: options.profile,
        seed: CORPUS_CANONICAL_SEED,
      }),
      catch: () => fail('corpus', 'generation-second', 'Second corpus generation failed'),
    })
    const manifest = yield* Effect.tryPromise({
      try: async () => {
        await verifyCorpus(resolve(firstRoot, 'manifest.json'))
        await verifyCorpus(resolve(secondRoot, 'manifest.json'))
        return compareCorpusManifests(
          resolve(firstRoot, 'manifest.json'),
          resolve(secondRoot, 'manifest.json'),
        )
      },
      catch: () => fail('corpus', 'reproducibility', 'Corpus generations differ'),
    })
    const corpusGenerationMs = Math.round(performance.now() - corpusStarted)
    const groundTruth = yield* Effect.tryPromise({
      try: () => loadGroundTruth(firstRoot),
      catch: () => fail('corpus', 'ground-truth', 'Ground truth could not be loaded'),
    })
    const materializationStarted = performance.now()
    const families = yield* Effect.tryPromise({
      try: () => materializeFamilies(
        firstRoot,
        manifest,
        options.artifactRoot,
        options.dataEngineUrl,
        options.dataEngineToken,
      ),
      catch: (cause) =>
        cause instanceof Phase04EvaluationError
          ? cause
          : fail(
              'materialization',
              'families',
              'Family materialization failed',
            ),
    })
    const materializationMs = Math.round(
      performance.now() - materializationStarted,
    )
    const sql = yield* Effect.acquireRelease(
      Effect.sync(() => postgres(options.databaseUrl, {
        max: 4,
        idle_timeout: 5,
      })),
      (connection) => Effect.promise(() => connection.end()),
    )
    yield* Effect.addFinalizer(() =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId]),
        catch: () =>
          fail('persistence', 'cleanup', 'Evaluation cleanup failed'),
      }).pipe(
        Effect.asVoid,
        Effect.orElseSucceed(() => undefined),
      ),
    )
    yield* Effect.tryPromise({
      try: () => seedCatalog(sql, families),
      catch: () => fail('persistence', 'catalog-seed', 'Evaluation catalog seed failed'),
    })
    const recoveryStarted = performance.now()
    const recoveryCases = yield* Effect.tryPromise({
      try: () => persistMaterializationsWithRecovery(
        sql,
        families,
        groundTruth.recoveryCases,
      ),
      catch: (cause) =>
        cause instanceof Phase04EvaluationError
          ? cause
          : fail('recovery', 'materializations', 'Recovery evaluation failed'),
    })
    const recoveryMs = Math.round(performance.now() - recoveryStarted)
    const exactStarted = performance.now()
    const exact = yield* Effect.tryPromise({
      try: () => runExactQueries(
        sql,
        families,
        groundTruth,
        options.dataEngineUrl,
        options.dataEngineToken,
      ),
      catch: (cause) =>
        cause instanceof Phase04EvaluationError
          ? cause
          : fail(
              'exact-answer',
              'queries',
              'Exact query evaluation failed',
            ),
    })
    const exactQueryMs = Math.round(performance.now() - exactStarted)
    const securityCases = yield* Effect.tryPromise({
      try: () => runSecurityCases(
        options.dataEngineUrl,
        options.dataEngineToken,
        families,
      ),
      catch: (cause) =>
        cause instanceof Phase04EvaluationError
          ? cause
          : fail('security', 'sidecar', 'Security evaluation failed'),
    })
    const corpusSecurityCases = yield* Effect.tryPromise({
      try: () => runCorpusSecurityCases(
        groundTruth,
        families,
        options.dataEngineUrl,
        options.dataEngineToken,
      ),
      catch: (cause) =>
        cause instanceof Phase04EvaluationError
          ? cause
          : fail('corpus-security', 'records', 'Corpus security evaluation failed'),
    })
    const isolationCases = yield* Effect.tryPromise({
      try: () => runContainerIsolationCases(),
      catch: (cause) =>
        cause instanceof Phase04EvaluationError
          ? cause
          : fail('sidecar-isolation', 'container', 'Container isolation evaluation failed'),
    })
    const evaluatedSchemaCases = yield* Effect.tryPromise({
      try: () => schemaCases(
        manifest,
        families,
        groundTruth.expectedSchemas,
        options.dataEngineUrl,
        options.dataEngineToken,
      ),
      catch: (cause) =>
        cause instanceof Phase04EvaluationError
          ? cause
          : fail('schema-family', 'observed', 'Observed schema evaluation failed'),
    })
    const coreCases = [
      ...evaluatedSchemaCases,
      ...exact.cases,
      ...securityCases,
      ...corpusSecurityCases,
      ...isolationCases,
      ...recoveryCases,
    ]
    const cases = [
      ...coreCases,
      ...negativeControlCases(groundTruth, coreCases),
    ].toSorted((left, right) => left.id.localeCompare(right.id))
    if (!passesEvaluationGate(cases, expectedCaseCounts['negative-control'])) {
      return yield* fail(
        'report',
        'acceptance-gate',
        'Evaluation case inventory is incomplete, duplicated, or failed',
      )
    }
    const categories: ReadonlyArray<EvaluationCase['category']> = [
      'exact-answer',
      'schema-family',
      'citation',
      'sql-guardrail',
      'authentication',
      'sidecar-isolation',
      'corpus-security',
      'recovery',
      'negative-control',
    ]
    const body: Phase04EvaluationReportBody = {
      schemaVersion: '1.0.0',
      evaluationId: 'phase-04-exact-computation-v1',
      status: 'passed',
      corpus: {
        profile: options.profile,
        corpusVersion: CORPUS_VERSION,
        generatorVersion: CORPUS_GENERATOR_VERSION,
        questionSetVersion: CORPUS_VERSION,
        seed: manifest.canonicalSeed,
        totalFiles: manifest.totalFiles,
        manifestSha256: manifest.manifestSha256,
        corpusSha256: manifest.corpusSha256,
        groundTruthSha256: manifest.groundTruthSha256,
        questionSetSha256: manifest.questionSetSha256,
      },
      runtime: {
        host: 'bun',
        hostVersion: Bun.version,
        protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
        engineVersion: exact.engineVersion,
        engineAdapterVersion: exact.engineAdapterVersion,
        executionPolicyVersion: exact.executionPolicyVersion,
        engineConfigHash: exact.engineConfigHash,
        modelProvider: 'not-applicable',
      },
      counts: categories.reduce<Record<EvaluationCase['category'], number>>(
        (counts, category) => {
          counts[category] = cases.filter(
            (item) => item.category === category,
          ).length
          return counts
        },
        {
          'exact-answer': 0,
          'schema-family': 0,
          citation: 0,
          'sql-guardrail': 0,
          authentication: 0,
          'sidecar-isolation': 0,
          'corpus-security': 0,
          recovery: 0,
          'negative-control': 0,
        },
      ),
      cases,
    }
    const report: Phase04EvaluationReport = {
      ...body,
      reportSha256: evidenceHash(body),
    }
    if (options.reportPath !== undefined) {
      const reportPath = options.reportPath
      yield* Effect.tryPromise({
        try: async () => {
          await mkdir(dirname(reportPath), { recursive: true })
          await Bun.write(reportPath, canonicalJson(report))
        },
        catch: () => fail('report', 'write', 'Evaluation report could not be written'),
      })
    }
    return {
      report,
      timings: {
        corpusGenerationMs,
        materializationMs,
        exactQueryMs,
        recoveryMs,
        totalMs: Math.round(performance.now() - started),
      },
    } satisfies Phase04EvaluationResult
  },
)

export async function readEvaluationReport(
  path: string,
): Promise<Phase04EvaluationReport> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (!isEvaluationReport(parsed)) {
    throw fail('report', 'shape', 'Evaluation report shape is invalid')
  }
  const report = parsed
  const { reportSha256, ...body } = report
  if (reportSha256 !== evidenceHash(body)) {
    throw fail('report', 'hash', 'Evaluation report hash is invalid')
  }
  return report
}

export const phase04EvaluationPins = {
  corpusVersion: CORPUS_VERSION,
  generatorVersion: CORPUS_GENERATOR_VERSION,
  seed: CORPUS_CANONICAL_SEED,
} as const
