import { Effect, Schema } from 'effect'
import {
  Note,
  NoteId,
  NoteOrigin,
  type ProjectId,
  type WorkspaceId,
} from '@struct/domain'
import { QueryError } from '../errors.js'
import { SqlClient } from '../sql-client.js'
/* eslint-disable no-unused-vars -- Babel does not mark type-only imports as used. */
import type { SqlExecutorShape } from '../sql-client.js'
/* eslint-enable no-unused-vars */

export class NoteConflictError
  extends Schema.TaggedError<NoteConflictError>()('NoteConflictError', {
    currentRevision: Schema.Number,
    message: Schema.String,
  }) {}

export class NoteNotFoundError
  extends Schema.TaggedError<NoteNotFoundError>()('NoteNotFoundError', {
    message: Schema.String,
  }) {}

export class NoteProvenanceError
  extends Schema.TaggedError<NoteProvenanceError>()('NoteProvenanceError', {
    message: Schema.String,
  }) {}

type NoteType = typeof Note.Type
type Workspace = typeof WorkspaceId.Type
type Project = typeof ProjectId.Type
type Id = typeof NoteId.Type

export interface CreateNoteInput {
  readonly id: Id
  readonly workspaceId: Workspace
  readonly projectId: Project
  readonly authorId: Workspace
  readonly origin: typeof NoteOrigin.Type
  readonly title: string
  readonly body: string
  readonly contentHash: string
  readonly idempotencyKey: string
  readonly now: bigint
}

export interface UpdateNoteInput {
  readonly workspaceId: Workspace
  readonly projectId: Project
  readonly noteId: Id
  readonly authorId: Workspace
  readonly expectedRevision: number
  readonly title: string
  readonly body: string
  readonly contentHash: string
  readonly now: bigint
}

function asTime(value: unknown): bigint {
  const date = value instanceof Date ? value : new Date(String(value))
  return BigInt(date.getTime())
}

async function decodeNoteRow(row: Record<string, unknown>): Promise<NoteType> {
  const origin = typeof row['origin'] === 'string'
    ? JSON.parse(row['origin'])
    : row['origin']
  return Schema.decodeUnknownSync(Note)({
    id: row['id'],
    workspaceId: row['workspace_id'],
    projectId: row['project_id'],
    authorId: row['author_id'],
    origin,
    current: {
      revision: Number(row['revision']),
      title: row['title'],
      body: row['body'],
      authorId: row['revision_author_id'],
      contentHash: row['content_hash'],
      createdAt: Number(asTime(row['revision_created_at'])),
    },
    archived: row['archived'],
    createdAt: Number(asTime(row['created_at'])),
    updatedAt: Number(asTime(row['updated_at'])),
  })
}

const NOTE_SELECT = `
  SELECT n.*, r.revision, r.title, r.body,
         r.author_id AS revision_author_id,
         r.content_hash,
         r.created_at AS revision_created_at
  FROM notes n
  JOIN note_revisions r
    ON r.note_id = n.id AND r.revision = n.current_revision`

async function find(
  sql: SqlExecutorShape,
  workspaceId: Workspace,
  projectId: Project,
  noteId: Id,
): Promise<NoteType> {
  const rows = await sql.unsafe(
    `${NOTE_SELECT}
     WHERE n.id = $1 AND n.workspace_id = $2 AND n.project_id = $3`,
    [noteId, workspaceId, projectId],
  )
  if (rows[0] === undefined) {
    throw new NoteNotFoundError({ message: 'Note not found' })
  }
  return decodeNoteRow(rows[0])
}

async function validateOrigin(
  sql: SqlExecutorShape,
  input: CreateNoteInput,
): Promise<void> {
  const runs = await sql.unsafe(
    `SELECT 1
     FROM research_runs rr
     JOIN research_threads rt ON rt.id = rr.thread_id
     JOIN projects p ON p.id = rt.project_id
     WHERE rr.id = $1 AND rt.id = $2
       AND p.id = $3 AND p.workspace_id = $4
       AND rr.status IN ('completed', 'partial')`,
    [
      input.origin.runId,
      input.origin.threadId,
      input.projectId,
      input.workspaceId,
    ],
  )
  if (runs.length !== 1) {
    throw new NoteProvenanceError({ message: 'Origin run is not saveable' })
  }
  for (const citation of input.origin.citations) {
    const rows = citation.kind === 'document'
      ? await sql.unsafe(
          `SELECT 1 FROM citations
           WHERE id = $1 AND run_id = $2 AND source_version_id = $3
             AND locator = $4 AND status = 'validated'`,
          [
            citation.id,
            input.origin.runId,
            citation.sourceVersionId,
            citation.locator,
          ],
        )
      : await sql.unsafe(
          `SELECT 1
           FROM research_run_dataset_citations rdc
           JOIN dataset_citations dc ON dc.id = rdc.dataset_citation_id
           WHERE rdc.run_id = $1 AND dc.id = $2
             AND dc.query_result_snapshot_id = $3
             AND dc.dataset_snapshot_id = $4
             AND dc.workspace_id = $5 AND dc.project_id = $6`,
          [
            input.origin.runId,
            citation.id,
            citation.queryResultSnapshotId,
            citation.datasetSnapshotId,
            input.workspaceId,
            input.projectId,
          ],
        )
    if (rows.length !== 1) {
      throw new NoteProvenanceError({ message: 'Origin citation is not valid' })
    }
  }
}

function repository(sql: import('../sql-client.js').SqlClientShape) {
  const query = <A>(
    operation: string,
    run: () => Promise<A>,
  ): Effect.Effect<A, QueryError | NoteConflictError | NoteNotFoundError | NoteProvenanceError> =>
    Effect.tryPromise({
      try: run,
      catch: (error) =>
        error instanceof NoteConflictError
        || error instanceof NoteNotFoundError
        || error instanceof NoteProvenanceError
          ? error
          : new QueryError({
              operation,
              entity: 'Note',
              message: 'Note persistence failed',
            }),
    })

  return {
    create: (input: CreateNoteInput) => query('create', () =>
      sql.transaction(async (tx) => {
        await tx.unsafe(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`${input.workspaceId}:${input.projectId}:${input.idempotencyKey}`],
        )
        const replay = await tx.unsafe(
          `SELECT note_id FROM note_idempotency_keys
           WHERE workspace_id = $1 AND project_id = $2 AND idempotency_key = $3`,
          [input.workspaceId, input.projectId, input.idempotencyKey],
        )
        if (replay[0] !== undefined) {
          const existing = await find(
            tx,
            input.workspaceId,
            input.projectId,
            NoteId.make(String(replay[0]['note_id'])),
          )
          if (
            existing.current.contentHash !== input.contentHash
            || JSON.stringify(existing.origin) !== JSON.stringify(input.origin)
          ) {
            throw new NoteConflictError({
              currentRevision: existing.current.revision,
              message: 'Idempotency key names a different note',
            })
          }
          return existing
        }
        await validateOrigin(tx, input)
        await tx.unsafe(
          `INSERT INTO notes (
             id, workspace_id, project_id, author_id, origin,
             created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5::jsonb,
             to_timestamp($6 / 1000.0), to_timestamp($6 / 1000.0))`,
          [
            input.id,
            input.workspaceId,
            input.projectId,
            input.authorId,
            JSON.stringify(input.origin),
            Number(input.now),
          ],
        )
        await tx.unsafe(
          `INSERT INTO note_revisions (
             note_id, revision, title, body, author_id, content_hash, created_at
           ) VALUES ($1, 1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))`,
          [
            input.id,
            input.title,
            input.body,
            input.authorId,
            input.contentHash,
            Number(input.now),
          ],
        )
        await tx.unsafe(
          `INSERT INTO note_idempotency_keys (
             workspace_id, project_id, idempotency_key, note_id
           ) VALUES ($1, $2, $3, $4)`,
          [input.workspaceId, input.projectId, input.idempotencyKey, input.id],
        )
        return find(tx, input.workspaceId, input.projectId, input.id)
      })),
    list: (workspaceId: Workspace, projectId: Project, archived = false) =>
      query('list', async () => {
        const rows = await sql.unsafe(
          `${NOTE_SELECT}
           WHERE n.workspace_id = $1 AND n.project_id = $2 AND n.archived = $3
           ORDER BY n.updated_at DESC, n.id DESC LIMIT 100`,
          [workspaceId, projectId, archived],
        )
        return Promise.all(rows.map(decodeNoteRow))
      }),
    find: (workspaceId: Workspace, projectId: Project, noteId: Id) =>
      query('find', () => find(sql, workspaceId, projectId, noteId)),
    update: (input: UpdateNoteInput) => query('update', () =>
      sql.transaction(async (tx) => {
        await tx.unsafe(
          `SELECT id FROM notes
           WHERE id = $1 AND workspace_id = $2 AND project_id = $3
           FOR UPDATE`,
          [input.noteId, input.workspaceId, input.projectId],
        )
        const current = await find(
          tx,
          input.workspaceId,
          input.projectId,
          input.noteId,
        )
        if (current.current.revision !== input.expectedRevision) {
          throw new NoteConflictError({
            currentRevision: current.current.revision,
            message: 'Note revision is stale',
          })
        }
        if (
          current.current.contentHash === input.contentHash
          && current.current.title === input.title
          && current.current.body === input.body
        ) return current
        const revision = input.expectedRevision + 1
        await tx.unsafe(
          `INSERT INTO note_revisions (
             note_id, revision, title, body, author_id, content_hash, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))`,
          [
            input.noteId,
            revision,
            input.title,
            input.body,
            input.authorId,
            input.contentHash,
            Number(input.now),
          ],
        )
        const updated = await tx.unsafe(
          `UPDATE notes SET current_revision = $1,
             updated_at = to_timestamp($2 / 1000.0)
           WHERE id = $3 AND workspace_id = $4 AND project_id = $5
             AND current_revision = $6 RETURNING id`,
          [
            revision,
            Number(input.now),
            input.noteId,
            input.workspaceId,
            input.projectId,
            input.expectedRevision,
          ],
        )
        if (updated.length !== 1) {
          throw new NoteConflictError({
            currentRevision: (await find(
              tx,
              input.workspaceId,
              input.projectId,
              input.noteId,
            )).current.revision,
            message: 'Note revision is stale',
          })
        }
        return find(tx, input.workspaceId, input.projectId, input.noteId)
      })),
    archive: (
      workspaceId: Workspace,
      projectId: Project,
      noteId: Id,
      archived: boolean,
      expectedRevision: number,
      now: bigint,
    ) => query('archive', async () => {
      const rows = await sql.unsafe(
        `UPDATE notes SET archived = $1, updated_at = to_timestamp($2 / 1000.0)
         WHERE id = $3 AND workspace_id = $4 AND project_id = $5
           AND current_revision = $6 RETURNING id`,
        [archived, Number(now), noteId, workspaceId, projectId, expectedRevision],
      )
      if (rows.length !== 1) {
        const current = await find(sql, workspaceId, projectId, noteId)
        throw new NoteConflictError({
          currentRevision: current.current.revision,
          message: 'Note revision is stale',
        })
      }
      return find(sql, workspaceId, projectId, noteId)
    }),
  }
}

export class NoteRepo extends Effect.Service<NoteRepo>()('NoteRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    return repository(yield* SqlClient)
  }),
}) {}
