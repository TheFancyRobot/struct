import {
  CitationValidationFact,
  DocumentChunkId,
  DocumentId,
  DocumentLocator,
  ProjectId,
  ProvenanceEdge,
  ProvenanceGraph,
  ReportId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import { SqlClient } from '../sql-client.js'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type { SqlExecutorShape } from '../sql-client.js'
/* eslint-enable no-unused-vars */

export class ProvenanceGraphPersistenceError
  extends Schema.TaggedError<ProvenanceGraphPersistenceError>()(
    'ProvenanceGraphPersistenceError',
    { operation: Schema.String, message: Schema.String },
  ) {}

export class ProvenanceGraphScopeError
  extends Schema.TaggedError<ProvenanceGraphScopeError>()(
    'ProvenanceGraphScopeError',
    {
      reportId: ReportId,
      workspaceId: WorkspaceId,
      projectId: ProjectId,
      message: Schema.String,
    },
  ) {}

export class ProvenanceGraphConflictError
  extends Schema.TaggedError<ProvenanceGraphConflictError>()(
    'ProvenanceGraphConflictError',
    {
      reportId: ReportId,
      reportRevision: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      revalidationKey: Schema.String,
      message: Schema.String,
    },
  ) {}

export class ProvenanceGraphDecodeError
  extends Schema.TaggedError<ProvenanceGraphDecodeError>()(
    'ProvenanceGraphDecodeError',
    {
      entity: Schema.Literal('graph', 'edge', 'validation'),
      message: Schema.String,
    },
  ) {}

export class ProvenanceDocumentScopeError
  extends Schema.TaggedError<ProvenanceDocumentScopeError>()(
    'ProvenanceDocumentScopeError',
    {
      chunkId: DocumentChunkId,
      workspaceId: WorkspaceId,
      projectId: ProjectId,
      message: Schema.String,
    },
  ) {}

export type ProvenanceGraphRepositoryError =
  | ProvenanceGraphPersistenceError
  | ProvenanceGraphScopeError
  | ProvenanceGraphConflictError
  | ProvenanceGraphDecodeError
  | ProvenanceDocumentScopeError

export interface ProvenanceDocumentEvidenceProjection {
  readonly chunkId: typeof DocumentChunkId.Type
  readonly documentId: typeof DocumentId.Type
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly chunkingVersion: string
  readonly ordinal: number
  readonly locator: typeof DocumentLocator.Type
  readonly excerpt: string
}

function graphHash(graph: ProvenanceGraph): string {
  const edges = [...graph.edges]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((edge) => Schema.encodeSync(ProvenanceEdge)(edge))
  const validations = [...graph.validations]
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .map((fact) => ({
      claimId: fact.claimId,
      edgeId: fact.edgeId,
      evidenceId: fact.evidenceId,
      reportId: fact.reportId,
      reportRevision: fact.reportRevision,
      status: fact.status,
      reason: fact.reason,
    }))
  return `sha256:${new Bun.CryptoHasher('sha256')
    .update(new TextEncoder().encode(JSON.stringify({
      workspaceId: graph.workspaceId,
      projectId: graph.projectId,
      reportId: graph.reportId,
      reportRevision: graph.reportRevision,
      trigger: graph.trigger,
      edges,
      validations,
    })))
    .digest('hex')}`
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function evidenceId(edge: ProvenanceEdge): string | null {
  return edge.kind === 'evidence-document'
    || edge.kind === 'evidence-dataset'
    || edge.kind === 'evidence-recursive'
    ? edge.evidenceId
    : null
}

async function loadGraphRows(
  sql: SqlExecutorShape,
  graphRow: Readonly<Record<string, unknown>>,
): Promise<{
  readonly graph: Readonly<Record<string, unknown>>
  readonly edges: readonly Record<string, unknown>[]
  readonly validations: readonly Record<string, unknown>[]
}> {
  const graphId = graphRow['id']
  const edges = await sql.unsafe(
    `SELECT edge_snapshot
     FROM provenance_edges
     WHERE graph_id = $1
     ORDER BY claim_id, edge_kind, edge_id`,
    [graphId],
  )
  const validations = await sql.unsafe(
    `SELECT edge.claim_id, fact.edge_id, edge.evidence_id,
            fact.report_id, fact.report_revision,
            fact.status, fact.reason, fact.checked_at
     FROM citation_validation_facts fact
     JOIN provenance_edges edge
       ON edge.graph_id = fact.graph_id AND edge.edge_id = fact.edge_id
     WHERE fact.graph_id = $1
     ORDER BY edge.claim_id, fact.edge_id`,
    [graphId],
  )
  return { graph: graphRow, edges, validations }
}

function decodeLoaded(
  rows: Awaited<ReturnType<typeof loadGraphRows>>,
): Effect.Effect<ProvenanceGraph, ProvenanceGraphDecodeError> {
  return Effect.gen(function* () {
    const edges = yield* Effect.forEach(rows.edges, (row) =>
      Schema.decodeUnknown(ProvenanceEdge)(parseJson(row['edge_snapshot'])).pipe(
        Effect.mapError(() => new ProvenanceGraphDecodeError({
          entity: 'edge',
          message: 'A stored provenance edge is invalid',
        })),
      ))
    const validations = yield* Effect.forEach(rows.validations, (row) =>
      Schema.decodeUnknown(CitationValidationFact)({
        claimId: row['claim_id'],
        edgeId: row['edge_id'],
        evidenceId: row['evidence_id'],
        reportId: row['report_id'],
        reportRevision: Number(row['report_revision']),
        status: row['status'],
        reason: row['reason'],
        checkedAt: row['checked_at'] instanceof Date
          ? row['checked_at'].getTime()
          : row['checked_at'],
      }).pipe(
        Effect.mapError(() => new ProvenanceGraphDecodeError({
          entity: 'validation',
          message: 'A stored citation validation is invalid',
        })),
      ))
    const createdAt = rows.graph['created_at'] instanceof Date
      ? BigInt(rows.graph['created_at'].getTime())
      : typeof rows.graph['created_at'] === 'bigint'
        ? rows.graph['created_at']
        : BigInt(Number(rows.graph['created_at']))
    return yield* Schema.decodeUnknown(Schema.typeSchema(ProvenanceGraph))({
      id: rows.graph['id'],
      workspaceId: rows.graph['workspace_id'],
      projectId: rows.graph['project_id'],
      reportId: rows.graph['report_id'],
      reportRevision: Number(rows.graph['report_revision']),
      revalidationKey: rows.graph['revalidation_key'],
      trigger: parseJson(rows.graph['trigger_snapshot']),
      edges,
      validations,
      createdAt,
    }).pipe(
      Effect.mapError(() => new ProvenanceGraphDecodeError({
        entity: 'graph',
        message: 'The stored provenance graph is invalid',
      })),
    )
  })
}

export class ProvenanceGraphRepo
  extends Effect.Service<ProvenanceGraphRepo>()(
    'ProvenanceGraphRepo',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const sql = yield* SqlClient

        const save = Effect.fn('ProvenanceGraphRepo.save')(
          function* (input: ProvenanceGraph) {
            const graph = yield* Schema.decodeUnknown(
              Schema.typeSchema(ProvenanceGraph),
            )(input).pipe(
              Effect.mapError(() => new ProvenanceGraphDecodeError({
                entity: 'graph',
                message: 'The provenance graph input is invalid',
              })),
            )
            const expectedHash = graphHash(graph)
            const loaded = yield* Effect.tryPromise({
              try: () => sql.transaction(async (transaction) => {
                const scoped = await transaction.unsafe(
                  `SELECT report_id AS id
                   FROM report_revision_snapshots
                   WHERE report_id = $1
                     AND workspace_id = $2 AND project_id = $3
                     AND revision = $4
                   FOR SHARE`,
                  [
                    graph.reportId,
                    graph.workspaceId,
                    graph.projectId,
                    graph.reportRevision,
                  ],
                )
                if (scoped.length !== 1) {
                  throw new ProvenanceGraphScopeError({
                    reportId: graph.reportId,
                    workspaceId: graph.workspaceId,
                    projectId: graph.projectId,
                    message: 'Report revision was not found in this scope',
                  })
                }
                const inserted = await transaction.unsafe(
                  `INSERT INTO provenance_graphs (
                     id, workspace_id, project_id, report_id, report_revision,
                     revalidation_key, trigger_snapshot, graph_hash, created_at
                   ) VALUES (
                     $1, $2, $3, $4, $5, $6, $7::jsonb, $8,
                     to_timestamp($9 / 1000.0)
                   )
                   ON CONFLICT (report_id, report_revision, revalidation_key)
                   DO NOTHING
                   RETURNING *`,
                  [
                    graph.id,
                    graph.workspaceId,
                    graph.projectId,
                    graph.reportId,
                    graph.reportRevision,
                    graph.revalidationKey,
                    JSON.stringify(graph.trigger),
                    expectedHash,
                    Number(graph.createdAt),
                  ],
                )
                const graphRows = inserted.length === 1
                  ? inserted
                  : await transaction.unsafe(
                      `SELECT * FROM provenance_graphs
                       WHERE report_id = $1 AND report_revision = $2
                         AND revalidation_key = $3
                       FOR SHARE`,
                      [
                        graph.reportId,
                        graph.reportRevision,
                        graph.revalidationKey,
                      ],
                    )
                const row = graphRows[0]
                if (row === undefined || row['graph_hash'] !== expectedHash) {
                  throw new ProvenanceGraphConflictError({
                    reportId: graph.reportId,
                    reportRevision: graph.reportRevision,
                    revalidationKey: graph.revalidationKey,
                    message: 'Revalidation key already identifies different facts',
                  })
                }
                if (inserted.length === 1) {
                  for (const edge of graph.edges) {
                    await transaction.unsafe(
                      `INSERT INTO provenance_edges (
                         graph_id, edge_id, report_id, report_revision, claim_id,
                         claim_revision_id, claim_revision, edge_kind,
                         evidence_id, edge_snapshot
                       ) VALUES (
                         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
                       )`,
                      [
                        graph.id,
                        edge.id,
                        graph.reportId,
                        graph.reportRevision,
                        edge.claimId,
                        edge.claimRevisionId,
                        edge.claimRevision,
                        edge.kind,
                        evidenceId(edge),
                        JSON.stringify(Schema.encodeSync(ProvenanceEdge)(edge)),
                      ],
                    )
                  }
                  for (const fact of graph.validations) {
                    await transaction.unsafe(
                      `INSERT INTO citation_validation_facts (
                         graph_id, edge_id, report_id, report_revision,
                         status, reason, checked_at
                       ) VALUES (
                         $1, $2, $3, $4, $5, $6,
                         to_timestamp($7 / 1000.0)
                       )`,
                      [
                        graph.id,
                        fact.edgeId,
                        graph.reportId,
                        graph.reportRevision,
                        fact.status,
                        fact.reason,
                        Number(fact.checkedAt),
                      ],
                    )
                  }
                }
                return loadGraphRows(transaction, row)
              }),
              catch: (cause) =>
                cause instanceof ProvenanceGraphScopeError
                  || cause instanceof ProvenanceGraphConflictError
                  ? cause
                  : new ProvenanceGraphPersistenceError({
                      operation: 'save',
                      message: 'Provenance graph persistence failed',
                    }),
            })
            return yield* decodeLoaded(loaded)
          },
        )

        const find = Effect.fn('ProvenanceGraphRepo.find')(
          function* (
            workspaceId: typeof WorkspaceId.Type,
            projectId: typeof ProjectId.Type,
            reportId: typeof ReportId.Type,
            reportRevision: number,
          ) {
            const graphRows = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `SELECT graph.*
                 FROM provenance_graphs graph
                 JOIN reports report ON report.id = graph.report_id
                 WHERE graph.workspace_id = $1 AND graph.project_id = $2
                   AND graph.report_id = $3 AND graph.report_revision = $4
                   AND report.workspace_id = $1 AND report.project_id = $2
                 ORDER BY graph.created_at DESC, graph.id DESC
                 LIMIT 1`,
                [workspaceId, projectId, reportId, reportRevision],
              ),
              catch: () => new ProvenanceGraphPersistenceError({
                operation: 'find',
                message: 'Provenance graph lookup failed',
              }),
            })
            const row = graphRows[0]
            if (row === undefined) {
              return yield* new ProvenanceGraphScopeError({
                reportId,
                workspaceId,
                projectId,
                message: 'Provenance graph was not found in this scope',
              })
            }
            const loaded = yield* Effect.tryPromise({
              try: () => loadGraphRows(sql, row),
              catch: () => new ProvenanceGraphPersistenceError({
                operation: 'find rows',
                message: 'Provenance graph rows could not be loaded',
              }),
            })
            return yield* decodeLoaded(loaded)
          },
        )

        const openDocumentEvidence = Effect.fn(
          'ProvenanceGraphRepo.openDocumentEvidence',
        )(function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          chunkId: typeof DocumentChunkId.Type,
          documentId: typeof DocumentId.Type,
          sourceVersionId: typeof SourceVersionId.Type,
          chunkingVersion: string,
          ordinal: number,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT chunk.id, chunk.document_id, chunk.source_version_id,
                      chunk.chunking_version, chunk.ordinal, chunk.text,
                      chunk.page, chunk.section, chunk.paragraph,
                      chunk.char_start, chunk.char_end,
                      chunk.byte_start, chunk.byte_end
               FROM document_chunks chunk
               JOIN documents document
                 ON document.id = chunk.document_id
                AND document.source_version_id = chunk.source_version_id
               JOIN sources source ON source.id = document.source_id
               JOIN projects project ON project.id = source.project_id
               WHERE chunk.id = $1 AND chunk.document_id = $2
                 AND chunk.source_version_id = $3
                 AND chunk.chunking_version = $4 AND chunk.ordinal = $5
                 AND document.workspace_id = $6
                 AND document.project_id = $7
                 AND source.project_id = $7
                 AND project.workspace_id = $6`,
              [
                chunkId,
                documentId,
                sourceVersionId,
                chunkingVersion,
                ordinal,
                workspaceId,
                projectId,
              ],
            ),
            catch: () => new ProvenanceGraphPersistenceError({
              operation: 'open document evidence',
              message: 'Document provenance could not be opened',
            }),
          })
          const row = rows[0]
          if (row === undefined) {
            return yield* new ProvenanceDocumentScopeError({
              chunkId,
              workspaceId,
              projectId,
              message: 'Document evidence was not found in this scope',
            })
          }
          return yield* Schema.decodeUnknown(
            Schema.Struct({
              chunkId: DocumentChunkId,
              documentId: DocumentId,
              sourceVersionId: SourceVersionId,
              chunkingVersion: Schema.String.pipe(Schema.minLength(1)),
              ordinal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
              locator: DocumentLocator,
              excerpt: Schema.String.pipe(Schema.minLength(1)),
            }),
          )({
            chunkId: row['id'],
            documentId: row['document_id'],
            sourceVersionId: row['source_version_id'],
            chunkingVersion: row['chunking_version'],
            ordinal: Number(row['ordinal']),
            locator: {
              page: row['page'] === null ? null : Number(row['page']),
              section: row['section'],
              paragraph: row['paragraph'] === null
                ? null
                : Number(row['paragraph']),
              charStart: Number(row['char_start']),
              charEnd: Number(row['char_end']),
              byteStart: Number(row['byte_start']),
              byteEnd: Number(row['byte_end']),
            },
            excerpt: row['text'],
          }).pipe(
            Effect.mapError(() => new ProvenanceGraphDecodeError({
              entity: 'edge',
              message: 'Document provenance row is invalid',
            })),
          )
        })

        return { save, find, openDocumentEvidence }
      }),
    },
  ) {}
