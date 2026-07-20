import {
  Claim,
  ClaimOrigin,
  CrossSourceEvidence,
  Finding,
  ProjectId,
  Report,
  ReportId,
  ReportSection,
  WorkspaceId,
} from '@struct/domain'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type { FindingId } from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Option, Schema } from 'effect'
import { SqlClient } from '../sql-client.js'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type { SqlExecutorShape } from '../sql-client.js'
/* eslint-enable no-unused-vars */

export class DurableArtifactPersistenceError
  extends Schema.TaggedError<DurableArtifactPersistenceError>()(
    'DurableArtifactPersistenceError',
    { operation: Schema.String, message: Schema.String },
  ) {}

export class DurableArtifactScopeError
  extends Schema.TaggedError<DurableArtifactScopeError>()(
    'DurableArtifactScopeError',
    {
      entity: Schema.Literal('run', 'finding', 'report'),
      id: Schema.String,
      workspaceId: WorkspaceId,
      projectId: ProjectId,
      message: Schema.String,
    },
  ) {}

export class DurableArtifactConflictError
  extends Schema.TaggedError<DurableArtifactConflictError>()(
    'DurableArtifactConflictError',
    {
      entity: Schema.Literal('finding', 'report'),
      id: Schema.String,
      idempotencyKey: Schema.String,
      message: Schema.String,
    },
  ) {}

export class DurableArtifactStaleWriteError
  extends Schema.TaggedError<DurableArtifactStaleWriteError>()(
    'DurableArtifactStaleWriteError',
    {
      reportId: ReportId,
      expectedRevision: Schema.Number.pipe(Schema.int()),
      actualRevision: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      message: Schema.String,
    },
  ) {}

export class DurableArtifactDecodeError
  extends Schema.TaggedError<DurableArtifactDecodeError>()(
    'DurableArtifactDecodeError',
    {
      entity: Schema.Literal('finding', 'report'),
      message: Schema.String,
    },
  ) {}

export type DurableArtifactRepositoryError =
  | DurableArtifactPersistenceError
  | DurableArtifactScopeError
  | DurableArtifactConflictError
  | DurableArtifactStaleWriteError
  | DurableArtifactDecodeError

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function payloadHash(snapshot: unknown): string {
  return `sha256:${new Bun.CryptoHasher('sha256')
    .update(new TextEncoder().encode(JSON.stringify(snapshot)))
    .digest('hex')}`
}

export function resolveArtifactIdentityCollision(
  entity: 'finding' | 'report',
  id: string,
  idempotencyKey: string,
  hash: string,
  row: Readonly<Record<string, unknown>> | undefined,
): unknown {
  if (
    row?.['idempotency_key'] === idempotencyKey
    && row['payload_hash'] === hash
  ) return row['snapshot']
  throw new DurableArtifactConflictError({
    entity,
    id,
    idempotencyKey,
    message: `${entity === 'finding' ? 'Finding' : 'Report'} identity names a different durable artifact`,
  })
}

function decodeFinding(value: unknown) {
  return Schema.decodeUnknown(Finding)(parseJson(value)).pipe(
    Effect.mapError(() => new DurableArtifactDecodeError({
      entity: 'finding',
      message: 'A stored finding snapshot is invalid',
    })),
  )
}

function decodeReport(value: unknown) {
  return Schema.decodeUnknown(Report)(parseJson(value)).pipe(
    Effect.mapError(() => new DurableArtifactDecodeError({
      entity: 'report',
      message: 'A stored report snapshot is invalid',
    })),
  )
}

function isRepositoryError(
  cause: unknown,
): cause is DurableArtifactRepositoryError {
  return cause instanceof DurableArtifactPersistenceError
    || cause instanceof DurableArtifactScopeError
    || cause instanceof DurableArtifactConflictError
    || cause instanceof DurableArtifactStaleWriteError
    || cause instanceof DurableArtifactDecodeError
}

async function assertCompletedRun(
  sql: SqlExecutorShape,
  finding: Finding,
): Promise<string> {
  const rows = await sql.unsafe(
    `SELECT result.answer
     FROM research_run_results result
     JOIN research_runs run ON run.id = result.run_id
     JOIN research_threads thread ON thread.id = run.thread_id
     JOIN projects project ON project.id = thread.project_id
     WHERE result.run_id = $1
       AND run.status = 'completed'
       AND thread.project_id = $2
       AND project.workspace_id = $3`,
    [finding.runId, finding.projectId, finding.workspaceId],
  )
  if (rows.length !== 1) {
    throw new DurableArtifactScopeError({
      entity: 'run',
      id: finding.runId,
      workspaceId: finding.workspaceId,
      projectId: finding.projectId,
      message: 'A completed research output was not found in this scope',
    })
  }
  const answer = rows[0]?.['answer']
  if (typeof answer !== 'string') {
    throw new DurableArtifactPersistenceError({
      operation: 'validate completed run',
      message: 'The completed research output is invalid',
    })
  }
  return answer
}

async function persistClaim(
  sql: SqlExecutorShape,
  finding: Finding,
  claim: Claim,
): Promise<void> {
  const snapshot = Schema.encodeSync(Claim)(claim)
  const hash = payloadHash(snapshot)
  const inserted = await sql.unsafe(
    `INSERT INTO durable_claims (
       id, citation_id, workspace_id, project_id, run_id, claim_signature,
       origin, support_state, evidence_mode, unsupported_reason,
       citation_state, citation_revision, superseded_by_citation_id,
       citation_last_idempotency_key, citation_updated_at, current_revision,
       created_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13,
       $14, to_timestamp($15 / 1000.0), $16, to_timestamp($17 / 1000.0)
     )
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      claim.id,
      claim.citation.citationId,
      finding.workspaceId,
      finding.projectId,
      finding.runId,
      claim.claimSignature,
      JSON.stringify(Schema.encodeSync(ClaimOrigin)(claim.origin)),
      claim.support.kind,
      claim.support.kind === 'supported' ? claim.support.mode : null,
      claim.support.kind === 'unsupported' ? claim.support.reason : null,
      claim.citation.state,
      claim.citation.revision,
      claim.citation.supersededBy,
      claim.citation.lastIdempotencyKey,
      Number(claim.citation.updatedAt),
      claim.currentRevision,
      Number(claim.createdAt),
    ],
  )
  const exact = await sql.unsafe(
    `SELECT 1 FROM durable_claims
     WHERE id = $1 AND citation_id = $2 AND workspace_id = $3
       AND project_id = $4 AND run_id = $5 AND claim_signature = $6`,
    [
      claim.id,
      claim.citation.citationId,
      finding.workspaceId,
      finding.projectId,
      finding.runId,
      claim.claimSignature,
    ],
  )
  if (exact.length !== 1) {
    throw new DurableArtifactConflictError({
      entity: 'finding',
      id: finding.id,
      idempotencyKey: claim.revisions[0]?.idempotencyKey ?? 'claim',
      message: 'A durable claim identity already names different evidence',
    })
  }
  const replay = await sql.unsafe(
    `SELECT payload_hash, snapshot
     FROM durable_claim_snapshots
     WHERE claim_id = $1`,
    [claim.id],
  )
  if (replay[0] !== undefined) {
    if (replay[0]['payload_hash'] !== hash) {
      throw new DurableArtifactConflictError({
        entity: 'finding',
        id: finding.id,
        idempotencyKey: claim.revisions[0]?.idempotencyKey ?? 'claim',
        message: 'A durable claim identity already names a different aggregate',
      })
    }
    return
  }
  if (inserted.length !== 1) {
    throw new DurableArtifactConflictError({
      entity: 'finding',
      id: finding.id,
      idempotencyKey: claim.revisions[0]?.idempotencyKey ?? 'claim',
      message: 'An existing claim is missing its canonical immutable snapshot',
    })
  }
  for (const revision of claim.revisions) {
    await sql.unsafe(
      `INSERT INTO claim_revisions (
         claim_id, id, revision, content, authorship_kind, authorship,
         idempotency_key, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6::jsonb, $7, to_timestamp($8 / 1000.0)
       ) ON CONFLICT (claim_id, revision) DO NOTHING`,
      [
        claim.id,
        revision.id,
        revision.revision,
        revision.content,
        revision.authorship.kind,
        JSON.stringify(revision.authorship),
        revision.idempotencyKey,
        Number(revision.createdAt),
      ],
    )
  }
  if (claim.support.kind === 'supported') {
    for (const evidence of claim.support.evidence) {
      await sql.unsafe(
        `INSERT INTO claim_evidence (
           claim_id, evidence_id, claim_signature, evidence_kind, stance,
           evidence_snapshot
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (claim_id, evidence_id) DO NOTHING`,
        [
          claim.id,
          evidence.id,
          evidence.claimSignature,
          evidence.payload.kind,
          evidence.stance,
          JSON.stringify(Schema.encodeSync(CrossSourceEvidence)(evidence)),
        ],
      )
    }
  }
  await sql.unsafe(
    `INSERT INTO durable_claim_snapshots (
       claim_id, payload_hash, snapshot, created_at
     ) VALUES (
       $1, $2, $3::jsonb, to_timestamp($4 / 1000.0)
     )`,
    [claim.id, hash, JSON.stringify(snapshot), Number(claim.createdAt)],
  )
}

async function syncReportProjection(
  sql: SqlExecutorShape,
  report: Report,
): Promise<void> {
  for (const [ordinal, sourceVersionId] of report.sourceVersionIds.entries()) {
    await sql.unsafe(
      `INSERT INTO report_revision_source_versions (
         report_id, report_revision, source_version_id, ordinal
       ) VALUES ($1, $2, $3, $4)`,
      [report.id, report.revision, sourceVersionId, ordinal],
    )
  }
  for (const section of report.sections) {
    await sql.unsafe(
      `INSERT INTO report_revision_sections (
         report_id, report_revision, section_id, ordinal, section_snapshot
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        report.id,
        report.revision,
        section.id,
        section.ordinal,
        JSON.stringify(Schema.encodeSync(ReportSection)(section)),
      ],
    )
    for (const findingId of section.findingIds) {
      await sql.unsafe(
        `INSERT INTO report_revision_findings (
           report_id, report_revision, finding_id, section_id, ordinal
         ) VALUES ($1, $2, $3, $4, $5)`,
        [
          report.id,
          report.revision,
          findingId,
          section.id,
          report.findingIds.indexOf(findingId),
        ],
      )
    }
    for (const [ordinal, claimId] of section.claimIds.entries()) {
      await sql.unsafe(
        `INSERT INTO report_revision_claims (
           report_id, report_revision, section_id, claim_id, ordinal
         ) VALUES ($1, $2, $3, $4, $5)`,
        [report.id, report.revision, section.id, claimId, ordinal],
      )
    }
  }
}

export class DurableArtifactsRepo
  extends Effect.Service<DurableArtifactsRepo>()(
    'DurableArtifactsRepo',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const sql = yield* SqlClient

        const saveFinding = Effect.fn('DurableArtifactsRepo.saveFinding')(
          function* (finding: Finding, idempotencyKey: string) {
            const snapshot = yield* Schema.encode(Finding)(finding)
            const hash = payloadHash(snapshot)
            const row = yield* Effect.tryPromise({
              try: () => sql.transaction(async (transaction) => {
                await transaction.unsafe(
                  `SELECT pg_advisory_xact_lock(
                     hashtextextended($1, 0)
                   )`,
                  [
                    [
                      finding.workspaceId,
                      finding.projectId,
                      idempotencyKey,
                    ].join(':'),
                  ],
                )
                const replay = await transaction.unsafe(
                  `SELECT payload_hash, snapshot
                   FROM finding_snapshots
                   WHERE workspace_id = $1 AND project_id = $2
                     AND idempotency_key = $3`,
                  [finding.workspaceId, finding.projectId, idempotencyKey],
                )
                if (replay[0] !== undefined) {
                  if (replay[0]['payload_hash'] !== hash) {
                    throw new DurableArtifactConflictError({
                      entity: 'finding',
                      id: finding.id,
                      idempotencyKey,
                      message: 'Idempotency key names a different finding',
                    })
                  }
                  return replay[0]['snapshot']
                }
                const duplicateIdentity = await transaction.unsafe(
                  `SELECT 1 FROM finding_snapshots WHERE finding_id = $1`,
                  [finding.id],
                )
                if (duplicateIdentity[0] !== undefined) {
                  throw new DurableArtifactConflictError({
                    entity: 'finding',
                    id: finding.id,
                    idempotencyKey,
                    message: 'Finding identity already has another idempotency key',
                  })
                }
                const completedAnswer = await assertCompletedRun(
                  transaction,
                  finding,
                )
                if (!finding.claims.some((claim) =>
                  claim.origin.kind === 'research-run'
                  && claim.origin.runId === finding.runId
                  && claim.revisions[claim.currentRevision]?.content
                    === completedAnswer
                )) {
                  throw new DurableArtifactConflictError({
                    entity: 'finding',
                    id: finding.id,
                    idempotencyKey,
                    message: 'Finding content differs from the completed run output',
                  })
                }
                if (finding.claims.some((claim) =>
                  claim.origin.kind === 'research-run'
                  && claim.origin.runId !== finding.runId
                )) {
                  throw new DurableArtifactScopeError({
                    entity: 'run',
                    id: finding.runId,
                    workspaceId: finding.workspaceId,
                    projectId: finding.projectId,
                    message: 'Finding claims reference a different research run',
                  })
                }
                if (finding.claims.some((claim) =>
                  claim.support.kind === 'supported'
                  && claim.support.evidence.some((evidence) =>
                    evidence.payload.kind === 'dataset'
                    && (
                      evidence.payload.evidence.citation.workspaceId
                        !== finding.workspaceId
                      || evidence.payload.evidence.citation.projectId
                        !== finding.projectId
                      || evidence.payload.evidence.snapshot.workspaceId
                        !== finding.workspaceId
                      || evidence.payload.evidence.snapshot.projectId
                        !== finding.projectId
                    ))
                )) {
                  throw new DurableArtifactScopeError({
                    entity: 'finding',
                    id: finding.id,
                    workspaceId: finding.workspaceId,
                    projectId: finding.projectId,
                    message: 'Dataset evidence is outside the finding scope',
                  })
                }
                const insertedFinding = await transaction.unsafe(
                  `INSERT INTO findings (
                     id, workspace_id, project_id, run_id, current_revision,
                     superseded_by, created_at, updated_at
                   ) VALUES (
                     $1, $2, $3, $4, $5, $6,
                     to_timestamp($7 / 1000.0), to_timestamp($8 / 1000.0)
                   )
                   ON CONFLICT DO NOTHING
                   RETURNING id`,
                  [
                    finding.id,
                    finding.workspaceId,
                    finding.projectId,
                    finding.runId,
                    finding.currentRevision,
                    finding.supersededBy,
                    Number(finding.createdAt),
                    Number(finding.updatedAt),
                  ],
                )
                if (insertedFinding[0] === undefined) {
                  const concurrent = await transaction.unsafe(
                    `SELECT idempotency_key, payload_hash, snapshot
                     FROM finding_snapshots WHERE finding_id = $1`,
                    [finding.id],
                  )
                  return resolveArtifactIdentityCollision(
                    'finding',
                    finding.id,
                    idempotencyKey,
                    hash,
                    concurrent[0],
                  )
                }
                for (const [ordinal, sourceVersionId] of finding.sourceVersionIds.entries()) {
                  await transaction.unsafe(
                    `INSERT INTO finding_source_versions (
                       finding_id, source_version_id, ordinal
                     )
                     SELECT $1, version.id, $3
                     FROM source_versions version
                     JOIN sources source ON source.id = version.source_id
                     JOIN projects project ON project.id = source.project_id
                     WHERE version.id = $2 AND source.project_id = $4
                       AND project.workspace_id = $5`,
                    [
                      finding.id,
                      sourceVersionId,
                      ordinal,
                      finding.projectId,
                      finding.workspaceId,
                    ],
                  )
                }
                const sourceCount = await transaction.unsafe(
                  `SELECT count(*)::int AS count
                   FROM finding_source_versions WHERE finding_id = $1`,
                  [finding.id],
                )
                if (Number(sourceCount[0]?.['count']) !== finding.sourceVersionIds.length) {
                  throw new DurableArtifactScopeError({
                    entity: 'finding',
                    id: finding.id,
                    workspaceId: finding.workspaceId,
                    projectId: finding.projectId,
                    message: 'A finding source version is outside the project scope',
                  })
                }
                for (const revision of finding.titleRevisions) {
                  await transaction.unsafe(
                    `INSERT INTO finding_title_revisions (
                       finding_id, id, revision, content, authorship_kind,
                       authorship, idempotency_key, created_at
                     ) VALUES (
                       $1, $2, $3, $4, $5, $6::jsonb, $7,
                       to_timestamp($8 / 1000.0)
                     )`,
                    [
                      finding.id,
                      revision.id,
                      revision.revision,
                      revision.content,
                      revision.authorship.kind,
                      JSON.stringify(revision.authorship),
                      revision.idempotencyKey,
                      Number(revision.createdAt),
                    ],
                  )
                }
                for (const [ordinal, claim] of finding.claims.entries()) {
                  await persistClaim(transaction, finding, claim)
                  await transaction.unsafe(
                    `INSERT INTO finding_claims (
                       finding_id, claim_id, ordinal
                     ) VALUES ($1, $2, $3)`,
                    [finding.id, claim.id, ordinal],
                  )
                }
                await transaction.unsafe(
                  `INSERT INTO finding_snapshots (
                     finding_id, workspace_id, project_id, run_id,
                     idempotency_key, payload_hash, snapshot, created_at
                   ) VALUES (
                     $1, $2, $3, $4, $5, $6, $7::jsonb,
                     to_timestamp($8 / 1000.0)
                   )`,
                  [
                    finding.id,
                    finding.workspaceId,
                    finding.projectId,
                    finding.runId,
                    idempotencyKey,
                    hash,
                    JSON.stringify(snapshot),
                    Number(finding.createdAt),
                  ],
                )
                return snapshot
              }),
              catch: (cause) => isRepositoryError(cause)
                ? cause
                : new DurableArtifactPersistenceError({
                  operation: 'save finding',
                  message: 'The durable finding could not be saved',
                }),
            })
            return yield* decodeFinding(row)
          },
        )

        const listFindings = Effect.fn('DurableArtifactsRepo.listFindings')(
          function* (
            workspaceId: typeof WorkspaceId.Type,
            projectId: typeof ProjectId.Type,
          ) {
            const rows = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `SELECT snapshot FROM finding_snapshots
                 WHERE workspace_id = $1 AND project_id = $2
                 ORDER BY created_at DESC, finding_id`,
                [workspaceId, projectId],
              ),
              catch: () => new DurableArtifactPersistenceError({
                operation: 'list findings',
                message: 'The project notebook could not be loaded',
              }),
            })
            return yield* Effect.forEach(rows, (row) =>
              decodeFinding(row['snapshot']))
          },
        )

        const findFinding = Effect.fn('DurableArtifactsRepo.findFinding')(
          function* (
            workspaceId: typeof WorkspaceId.Type,
            projectId: typeof ProjectId.Type,
            findingId: typeof FindingId.Type,
          ) {
            const rows = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `SELECT snapshot FROM finding_snapshots
                 WHERE finding_id = $1 AND workspace_id = $2
                   AND project_id = $3`,
                [findingId, workspaceId, projectId],
              ),
              catch: () => new DurableArtifactPersistenceError({
                operation: 'find finding',
                message: 'The durable finding could not be loaded',
              }),
            })
            if (rows[0] === undefined) {
              return yield* new DurableArtifactScopeError({
                entity: 'finding',
                id: findingId,
                workspaceId,
                projectId,
                message: 'The durable finding was not found in this scope',
              })
            }
            return yield* decodeFinding(rows[0]['snapshot'])
          },
        )

        const saveReport = Effect.fn('DurableArtifactsRepo.saveReport')(
          function* (
            report: Report,
            expectedPreviousRevision: number | null,
            idempotencyKey: string,
          ) {
            const snapshot = yield* Schema.encode(Report)(report)
            const hash = payloadHash(snapshot)
            const row = yield* Effect.tryPromise({
              try: () => sql.transaction(async (transaction) => {
                const replay = await transaction.unsafe(
                  `SELECT payload_hash, snapshot
                   FROM report_revision_snapshots
                   WHERE report_id = $1 AND idempotency_key = $2`,
                  [report.id, idempotencyKey],
                )
                if (replay[0] !== undefined) {
                  if (replay[0]['payload_hash'] !== hash) {
                    throw new DurableArtifactConflictError({
                      entity: 'report',
                      id: report.id,
                      idempotencyKey,
                      message: 'Idempotency key names a different report revision',
                    })
                  }
                  return replay[0]['snapshot']
                }
                const current = await transaction.unsafe(
                  `SELECT revision FROM reports
                   WHERE id = $1 AND workspace_id = $2 AND project_id = $3
                   FOR UPDATE`,
                  [report.id, report.workspaceId, report.projectId],
                )
                if (current[0] === undefined) {
                  if (expectedPreviousRevision !== null || report.revision !== 0) {
                    throw new DurableArtifactStaleWriteError({
                      reportId: report.id,
                      expectedRevision: expectedPreviousRevision ?? -1,
                      actualRevision: 0,
                      message: 'The report does not exist at the expected revision',
                    })
                  }
                  const run = await transaction.unsafe(
                    `SELECT 1
                     FROM research_runs run
                     JOIN research_threads thread ON thread.id = run.thread_id
                     JOIN projects project ON project.id = thread.project_id
                     WHERE run.id = $1 AND thread.project_id = $2
                       AND project.workspace_id = $3`,
                    [report.runId, report.projectId, report.workspaceId],
                  )
                  if (run.length !== 1) {
                    throw new DurableArtifactScopeError({
                      entity: 'run',
                      id: report.runId,
                      workspaceId: report.workspaceId,
                      projectId: report.projectId,
                      message: 'The report run was not found in this scope',
                    })
                  }
                  const insertedReport = await transaction.unsafe(
                    `INSERT INTO reports (
                       id, workspace_id, project_id, run_id, revision,
                       current_title_revision, publication_state, superseded_by,
                       last_publication_key, created_at, updated_at
                     ) VALUES (
                       $1, $2, $3, $4, $5, $6, $7, $8, $9,
                       to_timestamp($10 / 1000.0),
                       to_timestamp($11 / 1000.0)
                     )
                     ON CONFLICT DO NOTHING
                     RETURNING id`,
                    [
                      report.id,
                      report.workspaceId,
                      report.projectId,
                      report.runId,
                      report.revision,
                      report.currentTitleRevision,
                      report.publicationState,
                      report.supersededBy,
                      report.lastPublicationKey,
                      Number(report.createdAt),
                      Number(report.updatedAt),
                    ],
                  )
                  if (insertedReport[0] === undefined) {
                    const concurrent = await transaction.unsafe(
                      `SELECT idempotency_key, payload_hash, snapshot
                       FROM report_revision_snapshots
                       WHERE report_id = $1 AND revision = 0`,
                      [report.id],
                    )
                    return resolveArtifactIdentityCollision(
                      'report',
                      report.id,
                      idempotencyKey,
                      hash,
                      concurrent[0],
                    )
                  }
                } else {
                  const actual = Number(current[0]['revision'])
                  if (
                    expectedPreviousRevision === null
                    || actual !== expectedPreviousRevision
                    || report.revision !== actual + 1
                  ) {
                    throw new DurableArtifactStaleWriteError({
                      reportId: report.id,
                      expectedRevision: expectedPreviousRevision ?? -1,
                      actualRevision: actual,
                      message: 'The report changed before this revision was saved',
                    })
                  }
                  await transaction.unsafe(
                    `UPDATE reports SET
                       revision = $4,
                       current_title_revision = $5,
                       publication_state = $6,
                       superseded_by = $7,
                       last_publication_key = $8,
                       updated_at = to_timestamp($9 / 1000.0)
                     WHERE id = $1 AND workspace_id = $2 AND project_id = $3`,
                    [
                      report.id,
                      report.workspaceId,
                      report.projectId,
                      report.revision,
                      report.currentTitleRevision,
                      report.publicationState,
                      report.supersededBy,
                      report.lastPublicationKey,
                      Number(report.updatedAt),
                    ],
                  )
                }
                const scopedFindings = await transaction.unsafe(
                  `SELECT finding_id, snapshot
                   FROM finding_snapshots
                   WHERE finding_id = ANY($1::uuid[])
                     AND workspace_id = $2 AND project_id = $3`,
                  [report.findingIds, report.workspaceId, report.projectId],
                )
                if (scopedFindings.length !== report.findingIds.length) {
                  throw new DurableArtifactScopeError({
                    entity: 'report',
                    id: report.id,
                    workspaceId: report.workspaceId,
                    projectId: report.projectId,
                    message: 'A report finding is outside the authorized scope',
                  })
                }
                const selectedFindings = scopedFindings.map((row) =>
                  Schema.decodeUnknownSync(Finding)(
                    parseJson(row['snapshot']),
                  ))
                const expectedSources = new Set(selectedFindings.flatMap(
                  (finding) => finding.sourceVersionIds,
                ))
                const expectedClaims = new Set(selectedFindings.flatMap(
                  (finding) => finding.claims.map((claim) => claim.id),
                ))
                const expectedClaimHashes = new Map(selectedFindings.flatMap(
                  (finding) => finding.claims.map((claim) => [
                    claim.id,
                    payloadHash(Schema.encodeSync(Claim)(claim)),
                  ] as const)),
                )
                if (
                  expectedSources.size !== report.sourceVersionIds.length
                  || report.sourceVersionIds.some((id) => !expectedSources.has(id))
                  || expectedClaims.size !== report.claims.length
                  || report.claims.some((claim) => !expectedClaims.has(claim.id))
                  || report.claims.some((claim) =>
                    expectedClaimHashes.get(claim.id)
                    !== payloadHash(Schema.encodeSync(Claim)(claim)))
                ) {
                  throw new DurableArtifactScopeError({
                    entity: 'report',
                    id: report.id,
                    workspaceId: report.workspaceId,
                    projectId: report.projectId,
                    message: 'Report evidence scope differs from selected findings',
                  })
                }
                await transaction.unsafe(
                  `INSERT INTO report_revision_snapshots (
                     report_id, revision, workspace_id, project_id, run_id,
                     expected_previous_revision, idempotency_key, payload_hash,
                     snapshot, created_at
                   ) VALUES (
                     $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
                     to_timestamp($10 / 1000.0)
                   )`,
                  [
                    report.id,
                    report.revision,
                    report.workspaceId,
                    report.projectId,
                    report.runId,
                    expectedPreviousRevision,
                    idempotencyKey,
                    hash,
                    JSON.stringify(snapshot),
                    Number(report.updatedAt),
                  ],
                )
                await syncReportProjection(transaction, report)
                return snapshot
              }),
              catch: (cause) => isRepositoryError(cause)
                ? cause
                : new DurableArtifactPersistenceError({
                  operation: 'save report',
                  message: cause instanceof Error
                    ? `The report revision could not be saved: ${cause.message}`
                    : 'The report revision could not be saved',
                }),
            })
            return yield* decodeReport(row)
          },
        )

        const findReport = Effect.fn('DurableArtifactsRepo.findReport')(
          function* (
            workspaceId: typeof WorkspaceId.Type,
            projectId: typeof ProjectId.Type,
            reportId: typeof ReportId.Type,
          ) {
            const rows = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `SELECT snapshot
                 FROM report_revision_snapshots
                 WHERE report_id = $1 AND workspace_id = $2
                   AND project_id = $3
                 ORDER BY revision DESC LIMIT 1`,
                [reportId, workspaceId, projectId],
              ),
              catch: () => new DurableArtifactPersistenceError({
                operation: 'find report',
                message: 'The report could not be loaded',
              }),
            })
            if (rows[0] === undefined) {
              return yield* new DurableArtifactScopeError({
                entity: 'report',
                id: reportId,
                workspaceId,
                projectId,
                message: 'The report was not found in this scope',
              })
            }
            return yield* decodeReport(rows[0]['snapshot'])
          },
        )

        const findReportRevision = Effect.fn(
          'DurableArtifactsRepo.findReportRevision',
        )(function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          reportId: typeof ReportId.Type,
          revision: number,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT snapshot
               FROM report_revision_snapshots
               WHERE report_id = $1 AND workspace_id = $2
                 AND project_id = $3 AND revision = $4`,
              [reportId, workspaceId, projectId, revision],
            ),
            catch: () => new DurableArtifactPersistenceError({
              operation: 'find report revision',
              message: 'The report revision could not be loaded',
            }),
          })
          if (rows[0] === undefined) {
            return yield* new DurableArtifactScopeError({
              entity: 'report',
              id: reportId,
              workspaceId,
              projectId,
              message: 'The report revision was not found in this scope',
            })
          }
          return yield* decodeReport(rows[0]['snapshot'])
        })

        const findReportRevisionByKey = Effect.fn(
          'DurableArtifactsRepo.findReportRevisionByKey',
        )(function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          reportId: typeof ReportId.Type,
          idempotencyKey: string,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT snapshot
               FROM report_revision_snapshots
               WHERE report_id = $1 AND workspace_id = $2
                 AND project_id = $3 AND idempotency_key = $4`,
              [reportId, workspaceId, projectId, idempotencyKey],
            ),
            catch: () => new DurableArtifactPersistenceError({
              operation: 'find report revision by key',
              message: 'The report operation replay could not be loaded',
            }),
          })
          if (rows[0] === undefined) return Option.none<Report>()
          return Option.some(yield* decodeReport(rows[0]['snapshot']))
        })

        return {
          saveFinding,
          listFindings,
          findFinding,
          saveReport,
          findReport,
          findReportRevision,
          findReportRevisionByKey,
        }
      }),
    },
  ) {}
