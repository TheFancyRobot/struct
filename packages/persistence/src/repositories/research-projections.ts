/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Effect } from 'effect'
import type * as typeDomain from '@struct/domain'
import { EntityNotFoundError, QueryError } from '../errors.js'
import { SqlClient } from '../sql-client.js'
import { decodeEventJournalRow, type EventJournalRow } from './decode.js'

export interface CompletedResearchProjection {
  readonly answer: string
  readonly citations: ReadonlyArray<{
    readonly id: string
    readonly sourceVersionId: string
    readonly locator: string
  }>
}

export interface CitationSourceProjection {
  readonly id: string
  readonly runId: string
  readonly sourceVersionId: string
  readonly sourceName: string
  readonly sourceVersion: number
  readonly locator: string
  readonly content: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class ResearchProjectionRepo extends Effect.Service<ResearchProjectionRepo>()(
  'ResearchProjectionRepo',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const listEventsAfter = Effect.fn('ResearchProjectionRepo.listEventsAfter')(
        function* (
          projectId: typeof typeDomain.ProjectId.Type,
          runId: typeof typeDomain.ResearchRunId.Type,
          cursor: bigint,
          limit: number,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT event.*
               FROM event_journal event
               JOIN research_runs run ON run.id = event.entity_id
               JOIN research_threads thread ON thread.id = run.thread_id
               WHERE event.entity_type = 'research'
                 AND event.entity_id = $1
                 AND thread.project_id = $2
                 AND event.cursor > $3
               ORDER BY event.cursor ASC
               LIMIT $4`,
              [runId, projectId, cursor.toString(), limit],
            ),
            catch: () => new QueryError({
              operation: 'listEventsAfter',
              entity: 'ResearchProjection',
              message: 'Research events could not be loaded',
            }),
          })
          return yield* Effect.forEach(rows, (row) =>
            decodeEventJournalRow(row as unknown as EventJournalRow).pipe(
              Effect.mapError(() => new QueryError({
                operation: 'listEventsAfter',
                entity: 'ResearchProjection',
                message: 'Research event data is invalid',
              })),
            ),
          )
        },
      )

      const findCompleted = Effect.fn('ResearchProjectionRepo.findCompleted')(
        function* (runId: typeof typeDomain.ResearchRunId.Type) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT result.answer,
                      COALESCE(
                        jsonb_agg(
                          jsonb_build_object(
                            'id', citation.id,
                            'sourceVersionId', citation.source_version_id,
                            'locator', citation.locator
                          )
                          ORDER BY citation.created_at, citation.id
                        ) FILTER (WHERE citation.id IS NOT NULL),
                        '[]'::jsonb
                      ) AS citations
               FROM research_run_results result
               LEFT JOIN citations citation ON citation.run_id = result.run_id
               WHERE result.run_id = $1
               GROUP BY result.answer`,
              [runId],
            ),
            catch: () => new QueryError({
              operation: 'findCompleted',
              entity: 'ResearchProjection',
              message: 'Research result could not be loaded',
            }),
          })
          const row = rows[0]
          if (row === undefined || typeof row['answer'] !== 'string') {
            return yield* new EntityNotFoundError({
              entity: 'ResearchResult',
              id: runId,
              message: 'Research result not found',
            })
          }
          const citations = row['citations']
          if (!Array.isArray(citations)) {
            return yield* new QueryError({
              operation: 'findCompleted',
              entity: 'ResearchProjection',
              message: 'Research result data is invalid',
            })
          }
          return {
            answer: row['answer'],
            citations: citations.flatMap((value) => {
              if (!isRecord(value)) return []
              const record = value
              return typeof record['id'] === 'string'
                && typeof record['sourceVersionId'] === 'string'
                && typeof record['locator'] === 'string'
                ? [{
                    id: record['id'],
                    sourceVersionId: record['sourceVersionId'],
                    locator: record['locator'],
                  }]
                : []
            }),
          } satisfies CompletedResearchProjection
        },
      )

      const findCitation = Effect.fn('ResearchProjectionRepo.findCitation')(
        function* (
          projectId: typeof typeDomain.ProjectId.Type,
          threadId: typeof typeDomain.ResearchThreadId.Type,
          citationId: typeof typeDomain.CitationId.Type,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT citation.id,
                      citation.run_id,
                      citation.source_version_id,
                      citation.locator,
                      source.name AS source_name,
                      version.version AS source_version,
                      text.content
               FROM citations citation
               JOIN research_runs run ON run.id = citation.run_id
               JOIN research_threads thread ON thread.id = run.thread_id
               JOIN source_versions version ON version.id = citation.source_version_id
               JOIN sources source ON source.id = version.source_id
               JOIN source_text_index text ON text.source_version_id = version.id
               WHERE citation.id = $1
                 AND citation.status = 'validated'
                 AND thread.id = $2
                 AND thread.project_id = $3
                 AND source.project_id = $3`,
              [citationId, threadId, projectId],
            ),
            catch: () => new QueryError({
              operation: 'findCitation',
              entity: 'ResearchProjection',
              message: 'Citation could not be loaded',
            }),
          })
          const row = rows[0]
          if (row === undefined) {
            return yield* new EntityNotFoundError({
              entity: 'Citation',
              id: citationId,
              message: 'Citation not found',
            })
          }
          if (
            typeof row['id'] !== 'string'
            || typeof row['run_id'] !== 'string'
            || typeof row['source_version_id'] !== 'string'
            || typeof row['source_name'] !== 'string'
            || typeof row['source_version'] !== 'number'
            || typeof row['locator'] !== 'string'
            || typeof row['content'] !== 'string'
          ) {
            return yield* new QueryError({
              operation: 'findCitation',
              entity: 'ResearchProjection',
              message: 'Citation data is invalid',
            })
          }
          return {
            id: row['id'],
            runId: row['run_id'],
            sourceVersionId: row['source_version_id'],
            sourceName: row['source_name'],
            sourceVersion: row['source_version'],
            locator: row['locator'],
            content: row['content'],
          } satisfies CitationSourceProjection
        },
      )

      return { listEventsAfter, findCompleted, findCitation }
    }),
  },
) {}
