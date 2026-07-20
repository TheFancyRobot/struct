import postgres from 'postgres'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { main as runOperation, parseLocalDatabaseTarget, resolveBackupPath } from './production-operations'

const ids = {
  workspace: '10000000-0000-4000-8000-000000000001',
  project: '10000000-0000-4000-8000-000000000002',
  source: '10000000-0000-4000-8000-000000000003',
  sourceVersion: '10000000-0000-4000-8000-000000000004',
  thread: '10000000-0000-4000-8000-000000000005',
  run: '10000000-0000-4000-8000-000000000006',
  citation: '10000000-0000-4000-8000-000000000007',
  report: '10000000-0000-4000-8000-000000000008',
  provenance: '10000000-0000-4000-8000-000000000009',
} as const

const hash = `sha256:${'a'.repeat(64)}`

export function recoveryReturnArtifactRoot(configuredArtifactRoot: string): string {
  if (!configuredArtifactRoot.endsWith('_recovery_test')) {
    throw new Error('Recovery proof artifact root must end in _recovery_test')
  }
  return configuredArtifactRoot.slice(0, -'_recovery_test'.length)
}

export async function runWithRecoveryCleanup(
  operation: () => Promise<void>,
  cleanup: () => Promise<void>,
): Promise<void> {
  let operationFailure: unknown
  try {
    await operation()
  } catch (cause) {
    operationFailure = cause
  }

  let cleanupFailure: unknown
  try {
    await cleanup()
  } catch (cause) {
    cleanupFailure = cause
  }

  if (operationFailure !== undefined && cleanupFailure !== undefined) {
    throw new AggregateError(
      [operationFailure, cleanupFailure],
      'Recovery proof and recovery cleanup both failed',
    )
  }
  if (operationFailure !== undefined) throw operationFailure
  if (cleanupFailure !== undefined) throw cleanupFailure
}

export async function runRecoveryCleanupSteps(
  steps: ReadonlyArray<() => Promise<void>>,
): Promise<void> {
  const failures: unknown[] = []
  for (const step of steps) {
    try {
      await step()
    } catch (cause) {
      failures.push(cause)
    }
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Multiple recovery cleanup steps failed')
  }
}

async function seed(sql: postgres.Sql, artifactRef: string, contentHash: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO workspaces (id, name) VALUES (${ids.workspace}, 'Recovery proof workspace')`
    await tx`INSERT INTO projects (id, workspace_id, name) VALUES (${ids.project}, ${ids.workspace}, 'Recovery proof project')`
    await tx`INSERT INTO sources (id, project_id, name, kind) VALUES (${ids.source}, ${ids.project}, 'proof.txt', 'document')`
    await tx`INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
      VALUES (${ids.sourceVersion}, ${ids.source}, 1, ${artifactRef}, ${contentHash})`
    await tx`INSERT INTO research_threads (id, project_id, title) VALUES (${ids.thread}, ${ids.project}, 'Recovery proof thread')`
    await tx`INSERT INTO research_runs (id, thread_id, question, status)
      VALUES (${ids.run}, ${ids.thread}, 'Can recovery preserve v1 state?', 'completed')`
    await tx`INSERT INTO research_run_control (
      run_id, workspace_id, project_id, plan, checkpoint, budget_usage, terminal_status
    ) VALUES (
      ${ids.run}, ${ids.workspace}, ${ids.project}, ${tx.json({ steps: ['verify'] })},
      ${tx.json({ completed: true })}, ${tx.json({ tokens: 1 })}, 'completed'
    )`
    await tx`INSERT INTO citations (id, run_id, source_version_id, locator, status)
      VALUES (${ids.citation}, ${ids.run}, ${ids.sourceVersion}, 'line:1', 'validated')`
    await tx`INSERT INTO reports (
      id, workspace_id, project_id, run_id, revision, current_title_revision,
      publication_state, created_at, updated_at
    ) VALUES (
      ${ids.report}, ${ids.workspace}, ${ids.project}, ${ids.run}, 0, 0,
      'publishable', NOW(), NOW()
    )`
    await tx`INSERT INTO report_revision_snapshots (
      report_id, revision, workspace_id, project_id, run_id, expected_previous_revision,
      idempotency_key, payload_hash, snapshot, created_at
    ) VALUES (
      ${ids.report}, 0, ${ids.workspace}, ${ids.project}, ${ids.run}, NULL,
      'recovery-proof:revision:0', ${hash}, ${tx.json({ title: 'Recovery proof report' })}, NOW()
    )`
    await tx`INSERT INTO provenance_graphs (
      id, workspace_id, project_id, report_id, report_revision, revalidation_key,
      trigger_snapshot, graph_hash, created_at
    ) VALUES (
      ${ids.provenance}, ${ids.workspace}, ${ids.project}, ${ids.report}, 0,
      'recovery-proof:provenance', ${tx.json({ reason: 'recovery-proof' })}, ${hash}, NOW()
    )`
  })
}

async function fingerprint(sql: postgres.Sql): Promise<string> {
  const rows = await sql`
    SELECT
      w.id AS workspace_id,
      p.id AS project_id,
      s.id AS source_id,
      sv.id AS source_version_id,
      rr.id AS run_id,
      rrc.terminal_status,
      c.id AS citation_id,
      r.id AS report_id,
      rrs.revision AS report_revision,
      pg.id AS provenance_id
    FROM workspaces w
    JOIN projects p ON p.workspace_id = w.id
    JOIN sources s ON s.project_id = p.id
    JOIN source_versions sv ON sv.source_id = s.id
    JOIN research_threads rt ON rt.project_id = p.id
    JOIN research_runs rr ON rr.thread_id = rt.id
    JOIN research_run_control rrc
      ON rrc.run_id = rr.id AND rrc.workspace_id = w.id AND rrc.project_id = p.id
    JOIN citations c ON c.run_id = rr.id AND c.source_version_id = sv.id
    JOIN reports r
      ON r.run_id = rr.id AND r.workspace_id = w.id AND r.project_id = p.id
    JOIN report_revision_snapshots rrs
      ON rrs.report_id = r.id AND rrs.revision = r.revision
      AND rrs.workspace_id = w.id AND rrs.project_id = p.id
    JOIN provenance_graphs pg
      ON pg.report_id = r.id AND pg.report_revision = rrs.revision
      AND pg.workspace_id = w.id AND pg.project_id = p.id
    WHERE w.id = ${ids.workspace}
  `
  if (rows.length !== 1) throw new Error(`Expected one coherent recovery fixture, found ${rows.length}`)
  return JSON.stringify(rows[0])
}

async function verifySnapshotImmutability(sql: postgres.Sql): Promise<void> {
  try {
    await sql`UPDATE report_revision_snapshots
      SET snapshot = ${sql.json({ mutated: true })}
      WHERE report_id = ${ids.report} AND revision = 0`
    throw new Error('Restored report revision snapshot was mutable')
  } catch (error) {
    if (error instanceof Error && error.message === 'Restored report revision snapshot was mutable') throw error
    if (!(error instanceof postgres.PostgresError) || !error.message.includes('append-only')) throw error
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')
  const target = parseLocalDatabaseTarget(databaseUrl)
  if (!target.database.endsWith('_recovery_test')) {
    throw new Error('Recovery proof requires a database ending in _recovery_test')
  }
  if (process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET !== target.database) {
    throw new Error(`Set STRUCT_ALLOW_DESTRUCTIVE_RESET=${target.database}`)
  }
  const configuredArtifactRoot = process.env.ARTIFACT_STORAGE_ROOT
  if (!configuredArtifactRoot || !configuredArtifactRoot.endsWith('_recovery_test')) {
    throw new Error('Recovery proof requires ARTIFACT_STORAGE_ROOT ending in _recovery_test')
  }
  const artifactRoot = resolve(configuredArtifactRoot)
  const returnArtifactRoot = resolve(
    process.env.RECOVERY_RETURN_ARTIFACT_STORAGE_ROOT
      ?? recoveryReturnArtifactRoot(configuredArtifactRoot),
  )
  if (returnArtifactRoot === artifactRoot || returnArtifactRoot.endsWith('_recovery_test')) {
    throw new Error('Recovery return artifact root must be a distinct non-test path')
  }

  const archive = resolveBackupPath('.local/backups/recovery-proof.dump')
  const artifactArchive = '.local/backups/recovery-proof.artifacts'
  await runOperation(['database:reset'])
  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 2 })
  await runWithRecoveryCleanup(async () => {
    await rm(artifactRoot, { recursive: true, force: true })
    await mkdir(artifactRoot, { recursive: true })
    const bytes = new TextEncoder().encode('Struct recovery proof artifact bytes')
    const digest = createHash('sha256').update(bytes).digest('hex')
    const objectPath = join(artifactRoot, 'objects', 'sha256', digest.slice(0, 2), digest)
    await mkdir(resolve(objectPath, '..'), { recursive: true })
    await writeFile(objectPath, bytes)
    await seed(sql, `artifact://sha256/${digest}`, `sha256:${digest}`)
    const before = await fingerprint(sql)
    await runOperation(['database:backup', '--output', archive])
    await runOperation(['artifacts:backup', '--output', artifactArchive])
    await runOperation(['database:reset'])
    await rm(artifactRoot, { recursive: true, force: true })
    await mkdir(artifactRoot, { recursive: true })
    const empty = await sql`SELECT count(*)::int AS count FROM workspaces`
    if (empty[0]?.count !== 0) throw new Error('Destructive reset did not produce an empty application state')
    await runOperation(['database:restore', '--input', archive])
    await runOperation(['artifacts:restore', '--input', artifactArchive])
    const restored = await fingerprint(sql)
    if (restored !== before) throw new Error('Restored ownership/report/provenance fingerprint changed')
    const restoredArtifact = await readFile(objectPath)
    if (!Buffer.from(restoredArtifact).equals(Buffer.from(bytes))) {
      throw new Error('Restored artifact bytes changed')
    }
    await verifySnapshotImmutability(sql)
    await runOperation(['stack:restart'])
    const restarted = await fingerprint(sql)
    if (restarted !== before) throw new Error('Dependency restart changed durable state')
    process.stdout.write('Recovery proof passed: database and artifact reset, backup, restore, integrity, immutability, and restart\n')
  }, () => runRecoveryCleanupSteps([
    () => sql.end(),
    () => rm(artifactRoot, { recursive: true, force: true }),
    () => mkdir(returnArtifactRoot, { recursive: true }).then(() => undefined),
    async () => {
      const recoveryArtifactRoot = process.env.ARTIFACT_STORAGE_ROOT
      process.env.ARTIFACT_STORAGE_ROOT = returnArtifactRoot
      try {
        await runOperation(['stack:restart'])
      } finally {
        if (recoveryArtifactRoot === undefined) {
          delete process.env.ARTIFACT_STORAGE_ROOT
        } else {
          process.env.ARTIFACT_STORAGE_ROOT = recoveryArtifactRoot
        }
      }
    },
  ]))
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`Recovery proof failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
