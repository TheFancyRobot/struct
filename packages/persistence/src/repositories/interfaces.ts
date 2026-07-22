/**
 * Repository interfaces and Effect.Services.
 *
 * Defines the contract for each repository using Effect-TS types.
 * Each repository is an Effect.Service that depends on SqlClient.
 * Real implementations are provided via Layer from apps/api.
 */

import { Effect, Option, Schema } from 'effect'
import * as Domain from '@struct/domain'
import type { PersistenceError } from '../errors.js'
import { SqlClient } from '../sql-client.js'
import {
  EntityNotFoundError,
  IngestionEventValidationError,
  IngestionJobOwnershipLostError,
  QueryError,
} from '../errors.js'
import {
  decodeWorkspaceRow,
  decodeProjectRow,
  decodeSourceRow,
  decodeSourceVersionRow,
  decodeResearchThreadRow,
  decodeResearchRunRow,
  decodeCitationRow,
  decodeJobQueueRow,
  decodeEventJournalRow,
  type WorkspaceRow,
  type ProjectRow,
  type SourceRow,
  type SourceVersionRow,
  type ResearchThreadRow,
  type ResearchRunRow,
  type CitationRow,
  type JobQueueRow,
  type EventJournalRow,
  DecodeError,
} from './decode.js'

// =============================================================================
// Workspace Repository
// =============================================================================

export interface WorkspaceRepository {
  readonly create: (workspace: typeof Domain.Workspace.Type) => Effect.Effect<typeof Domain.Workspace.Type, PersistenceError, never>
  readonly findById: (id: typeof Domain.WorkspaceId.Type) => Effect.Effect<typeof Domain.Workspace.Type, PersistenceError, never>
  readonly findAll: () => Effect.Effect<ReadonlyArray<typeof Domain.Workspace.Type>, PersistenceError, never>
}

export class WorkspaceRepo extends Effect.Service<WorkspaceRepo>()('WorkspaceRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeWorkspaceRepositoryImpl(sql)
  }),
}) {}

function makeWorkspaceRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): WorkspaceRepository {
  type WorkspaceType = typeof Domain.Workspace.Type
  type RepoError = PersistenceError

  return {
    create: (workspace: WorkspaceType) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO workspaces (id, name, created_at, updated_at)
             VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0))
             RETURNING *`,
            [workspace.id, workspace.name, Number(workspace.createdAt), Number(workspace.updatedAt)],
          ),
        catch: (err) => new QueryError({ operation: 'create', entity: 'Workspace', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeWorkspaceRow(rows[0] as unknown as WorkspaceRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'create', entity: 'Workspace', message: err.message })
                : err,
            ),
          ) as Effect.Effect<WorkspaceType, RepoError, never>,
        ),
      ),

    findById: (id: typeof Domain.WorkspaceId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM workspaces WHERE id = $1`, [id]),
        catch: (err) => new QueryError({ operation: 'findById', entity: 'Workspace', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'Workspace', id, message: `Workspace ${id} not found` }))
          }
          return decodeWorkspaceRow(rows[0] as unknown as WorkspaceRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'findById', entity: 'Workspace', message: err.message })
                : err,
            ),
          ) as Effect.Effect<WorkspaceType, RepoError, never>
        }),
      ),

    findAll: () =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM workspaces ORDER BY created_at DESC`),
        catch: (err) => new QueryError({ operation: 'findAll', entity: 'Workspace', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeWorkspaceRow(row as unknown as WorkspaceRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'findAll', entity: 'Workspace', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<WorkspaceType, RepoError, never>,
          ),
        ),
      ),
  }
}

// =============================================================================
// Project Repository
// =============================================================================

export class ProjectConflictError
  extends Schema.TaggedError<ProjectConflictError>()('ProjectConflictError', {
    workspaceId: Domain.WorkspaceId,
    projectName: Schema.String,
    message: Schema.String,
  }) {}

export interface ProjectListOptions {
  readonly limit: number
  readonly cursor?: typeof Domain.ProjectListCursor.Type | null
}

export interface ProjectListPageResult {
  readonly items: ReadonlyArray<typeof Domain.Project.Type>
  readonly nextCursor: typeof Domain.ProjectListCursor.Type | null
}

export interface ProjectRepository {
  readonly create: (project: typeof Domain.Project.Type) => Effect.Effect<typeof Domain.Project.Type, PersistenceError, never>
  readonly createWithIdempotency: (input: { readonly project: typeof Domain.Project.Type, readonly idempotencyKey: string }) => Effect.Effect<typeof Domain.Project.Type, PersistenceError | ProjectConflictError, never>
  readonly findById: (id: typeof Domain.ProjectId.Type) => Effect.Effect<typeof Domain.Project.Type, PersistenceError, never>
  readonly findByWorkspaceId: (workspaceId: typeof Domain.WorkspaceId.Type) => Effect.Effect<ReadonlyArray<typeof Domain.Project.Type>, PersistenceError, never>
  readonly listByWorkspaceId: (workspaceId: typeof Domain.WorkspaceId.Type, options: ProjectListOptions) => Effect.Effect<ProjectListPageResult, PersistenceError, never>
}

export class ProjectRepo extends Effect.Service<ProjectRepo>()('ProjectRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeProjectRepositoryImpl(sql)
  }),
}) {}

const PROJECT_NAME_UNIQUE_INDEX = 'projects_workspace_name_ci_idx'

interface ProjectCursorEnvelope {
  readonly updatedAt: number
  readonly nameFolded: string
  readonly id: string
}

function foldProjectName(value: string): string {
  return value.toLocaleLowerCase('en-US')
}

function encodeProjectCursor(project: typeof Domain.Project.Type): typeof Domain.ProjectListCursor.Type {
  return Buffer.from(JSON.stringify({
    updatedAt: Number(project.updatedAt),
    nameFolded: foldProjectName(project.name),
    id: project.id,
  } satisfies ProjectCursorEnvelope)).toString('base64url') as typeof Domain.ProjectListCursor.Type
}

function decodeProjectCursor(cursor: typeof Domain.ProjectListCursor.Type): ProjectCursorEnvelope {
  const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  if (
    typeof decoded !== 'object'
    || decoded === null
    || typeof decoded['updatedAt'] !== 'number'
    || !Number.isFinite(decoded['updatedAt'])
    || typeof decoded['nameFolded'] !== 'string'
    || typeof decoded['id'] !== 'string'
  ) {
    throw new Error('Invalid project cursor')
  }
  return {
    updatedAt: decoded['updatedAt'],
    nameFolded: decoded['nameFolded'],
    id: decoded['id'],
  }
}

function uniqueViolationConstraint(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = error as Record<string, unknown>
  for (const field of ['constraint', 'constraint_name']) {
    if (typeof candidate[field] === 'string' && candidate[field].length > 0) {
      return candidate[field] as string
    }
  }
  return null
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as Record<string, unknown>
  return String(candidate['code']) === '23505'
}

function isUniqueViolationOn(error: unknown, constraintName: string): boolean {
  if (!isUniqueViolation(error)) return false
  const matchedConstraint = uniqueViolationConstraint(error)
  if (matchedConstraint !== null) return matchedConstraint === constraintName
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(constraintName)
}

function makeProjectRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): ProjectRepository {
  type ProjectType = typeof Domain.Project.Type
  type RepoError = PersistenceError

  return {
    create: (project: ProjectType) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO projects (id, workspace_id, name, created_at, updated_at)
             VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
             RETURNING *`,
            [project.id, project.workspaceId, project.name, Number(project.createdAt), Number(project.updatedAt)],
          ),
        catch: (err) => new QueryError({ operation: 'create', entity: 'Project', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeProjectRow(rows[0] as unknown as ProjectRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'create', entity: 'Project', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ProjectType, RepoError, never>,
        ),
      ),

    createWithIdempotency: ({ project, idempotencyKey }: { readonly project: ProjectType, readonly idempotencyKey: string }) =>
      Effect.tryPromise({
        try: async () => {
          try {
            return await sql.transaction(async (transaction) => {
              const existingRows = await transaction.unsafe(
                `SELECT project_id
                 FROM project_idempotency_keys
                 WHERE workspace_id = $1 AND idempotency_key = $2
                 FOR UPDATE`,
                [project.workspaceId, idempotencyKey],
              )
              const existingProjectId = existingRows[0]?.['project_id']
              if (typeof existingProjectId === 'string') {
                const rows = await transaction.unsafe(
                  'SELECT * FROM projects WHERE id = $1 FOR SHARE',
                  [existingProjectId],
                )
                return rows[0]
              }

              const createdRows = await transaction.unsafe(
                `INSERT INTO projects (id, workspace_id, name, created_at, updated_at)
                 VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
                 RETURNING *`,
                [project.id, project.workspaceId, project.name, Number(project.createdAt), Number(project.updatedAt)],
              )
              await transaction.unsafe(
                `INSERT INTO project_idempotency_keys (workspace_id, idempotency_key, project_id, created_at)
                 VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))`,
                [project.workspaceId, idempotencyKey, project.id, Number(project.createdAt)],
              )
              return createdRows[0]
            })
          } catch (error) {
            if (isUniqueViolation(error)) {
              const rows = await sql.unsafe(
                `SELECT p.*
                 FROM project_idempotency_keys AS k
                 JOIN projects AS p ON p.id = k.project_id
                 WHERE k.workspace_id = $1 AND k.idempotency_key = $2`,
                [project.workspaceId, idempotencyKey],
              )
              if (rows[0] !== undefined) return rows[0]
            }
            if (isUniqueViolationOn(error, PROJECT_NAME_UNIQUE_INDEX)) {
              throw new ProjectConflictError({
                workspaceId: project.workspaceId,
                projectName: project.name,
                message: 'Project name already exists in this workspace',
              })
            }
            throw error
          }
        },
        catch: (err) => err instanceof ProjectConflictError
          ? err
          : new QueryError({ operation: 'createWithIdempotency', entity: 'Project', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeProjectRow(rows as unknown as ProjectRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'createWithIdempotency', entity: 'Project', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ProjectType, PersistenceError | ProjectConflictError, never>,
        ),
      ),

    findById: (id: typeof Domain.ProjectId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM projects WHERE id = $1`, [id]),
        catch: (err) => new QueryError({ operation: 'findById', entity: 'Project', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'Project', id, message: `Project ${id} not found` }))
          }
          return decodeProjectRow(rows[0] as unknown as ProjectRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'findById', entity: 'Project', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ProjectType, RepoError, never>
        }),
      ),

    findByWorkspaceId: (workspaceId: typeof Domain.WorkspaceId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM projects WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]),
        catch: (err) => new QueryError({ operation: 'findByWorkspaceId', entity: 'Project', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeProjectRow(row as unknown as ProjectRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'findByWorkspaceId', entity: 'Project', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<ProjectType, RepoError, never>,
          ),
        ),
      ),

    listByWorkspaceId: (workspaceId: typeof Domain.WorkspaceId.Type, options: ProjectListOptions) =>
      Effect.tryPromise({
        try: async () => {
          const limit = Math.max(1, Math.min(options.limit, Domain.MAX_PROJECT_PAGE_SIZE))
          const cursor = options.cursor == null ? null : decodeProjectCursor(options.cursor)
          const params: Array<string | number> = [workspaceId]
          let where = 'workspace_id = $1'
          if (cursor !== null) {
            where += ` AND (
              updated_at < to_timestamp($2 / 1000.0)
              OR (
                updated_at = to_timestamp($2 / 1000.0)
                AND (
                  lower(name) > $3
                  OR (lower(name) = $3 AND id > $4)
                )
              )
            )`
            params.push(cursor.updatedAt, cursor.nameFolded, cursor.id)
          }
          params.push(limit + 1)
          return sql.unsafe(
            `SELECT * FROM projects
             WHERE ${where}
             ORDER BY updated_at DESC, lower(name) ASC, id ASC
             LIMIT $${params.length}`,
            params,
          )
        },
        catch: (err) => new QueryError({ operation: 'listByWorkspaceId', entity: 'Project', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeProjectRow(row as unknown as ProjectRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'listByWorkspaceId', entity: 'Project', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<ProjectType, PersistenceError, never>,
          ),
        ),
        Effect.map((projects) => ({
          items: projects.slice(0, Math.max(1, Math.min(options.limit, Domain.MAX_PROJECT_PAGE_SIZE))),
          nextCursor: projects.length > Math.max(1, Math.min(options.limit, Domain.MAX_PROJECT_PAGE_SIZE))
            ? encodeProjectCursor(projects[Math.max(1, Math.min(options.limit, Domain.MAX_PROJECT_PAGE_SIZE)) - 1]!)
            : null,
        } satisfies ProjectListPageResult)),
      ),
  }
}

// =============================================================================
// Source Repository
// =============================================================================

export interface SourceRepository {
  readonly create: (source: typeof Domain.Source.Type) => Effect.Effect<typeof Domain.Source.Type, PersistenceError, never>
  readonly findById: (id: typeof Domain.SourceId.Type) => Effect.Effect<typeof Domain.Source.Type, PersistenceError, never>
  readonly findByProjectId: (projectId: typeof Domain.ProjectId.Type) => Effect.Effect<ReadonlyArray<typeof Domain.Source.Type>, PersistenceError, never>
}

export class SourceRepo extends Effect.Service<SourceRepo>()('SourceRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeSourceRepositoryImpl(sql)
  }),
}) {}

function makeSourceRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): SourceRepository {
  type SourceType = typeof Domain.Source.Type
  type RepoError = PersistenceError

  return {
    create: (source: SourceType) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO sources (id, project_id, name, kind, created_at, updated_at)
             VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0))
             RETURNING *`,
            [source.id, source.projectId, source.name, source.kind, Number(source.createdAt), Number(source.updatedAt)],
          ),
        catch: (err) => new QueryError({ operation: 'create', entity: 'Source', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeSourceRow(rows[0] as unknown as SourceRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'create', entity: 'Source', message: err.message })
                : err,
            ),
          ) as Effect.Effect<SourceType, RepoError, never>,
        ),
      ),

    findById: (id: typeof Domain.SourceId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM sources WHERE id = $1`, [id]),
        catch: (err) => new QueryError({ operation: 'findById', entity: 'Source', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'Source', id, message: `Source ${id} not found` }))
          }
          return decodeSourceRow(rows[0] as unknown as SourceRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'findById', entity: 'Source', message: err.message })
                : err,
            ),
          ) as Effect.Effect<SourceType, RepoError, never>
        }),
      ),

    findByProjectId: (projectId: typeof Domain.ProjectId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM sources WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]),
        catch: (err) => new QueryError({ operation: 'findByProjectId', entity: 'Source', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeSourceRow(row as unknown as SourceRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'findByProjectId', entity: 'Source', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<SourceType, RepoError, never>,
          ),
        ),
      ),
  }
}

// =============================================================================
// SourceVersion Repository
// =============================================================================

export interface SourceVersionRepository {
  readonly create: (version: typeof Domain.SourceVersion.Type) => Effect.Effect<typeof Domain.SourceVersion.Type, PersistenceError, never>
  readonly createForIngestionAttempt: (
    job: typeof Domain.JobQueue.Type,
    version: typeof Domain.SourceVersion.Type,
  ) => Effect.Effect<typeof Domain.SourceVersion.Type, PersistenceError, never>
  readonly findById: (id: typeof Domain.SourceVersionId.Type) => Effect.Effect<typeof Domain.SourceVersion.Type, PersistenceError, never>
  readonly findBySourceId: (sourceId: typeof Domain.SourceId.Type) => Effect.Effect<ReadonlyArray<typeof Domain.SourceVersion.Type>, PersistenceError, never>
}

export class SourceVersionRepo extends Effect.Service<SourceVersionRepo>()('SourceVersionRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeSourceVersionRepositoryImpl(sql)
  }),
}) {}

function makeSourceVersionRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): SourceVersionRepository {
  type SourceVersionType = typeof Domain.SourceVersion.Type
  type RepoError = PersistenceError

  return {
    create: (version: SourceVersionType) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash, created_at)
             VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
             RETURNING *`,
            [version.id, version.sourceId, version.version, version.artifactRef, version.contentHash, Number(version.createdAt)],
          ),
        catch: (err) => new QueryError({ operation: 'create', entity: 'SourceVersion', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeSourceVersionRow(rows[0] as unknown as SourceVersionRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'create', entity: 'SourceVersion', message: err.message })
                : err,
            ),
          ) as Effect.Effect<SourceVersionType, RepoError, never>,
        ),
      ),

    createForIngestionAttempt: (job, version) =>
      Effect.tryPromise({
        try: () => {
          if (
            job.entityType !== 'ingestion'
            || job.status !== 'in-progress'
            || job.entityId !== version.sourceId
          ) {
            throw new IngestionJobOwnershipLostError({
              jobId: job.id,
              attempt: job.attempts,
              transition: 'create-version',
              message: 'Ingestion job aggregate does not match the source version',
            })
          }
          return sql.transaction(async (transaction) => {
            const ownership = await transaction.unsafe(
              `UPDATE job_queue AS job
               SET updated_at = NOW()
               FROM sources AS source
               JOIN projects AS project ON project.id = source.project_id
               WHERE job.id = $1
                 AND job.entity_type = 'ingestion'
                 AND job.entity_id = $2
                 AND job.workspace_id = $3
                 AND job.status = 'in-progress'
                 AND job.attempts = $4
                 AND source.id = $2
                 AND project.workspace_id = $3
               RETURNING job.id`,
              [job.id, job.entityId, job.workspaceId, job.attempts],
            )
            if (ownership.length !== 1) return []
            return transaction.unsafe(
              `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash, created_at)
               VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
               RETURNING *`,
              [version.id, version.sourceId, version.version, version.artifactRef, version.contentHash, Number(version.createdAt)],
            )
          })
        },
        catch: (err) =>
          err instanceof IngestionJobOwnershipLostError
            ? err
            : new QueryError({
                operation: 'createForIngestionAttempt',
                entity: 'SourceVersion',
                message: String(err),
              }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length !== 1) {
            return Effect.fail(new IngestionJobOwnershipLostError({
              jobId: job.id,
              attempt: job.attempts,
              transition: 'create-version',
              message: 'Ingestion job attempt no longer owns the in-progress lease',
            }))
          }
          return decodeSourceVersionRow(rows[0] as unknown as SourceVersionRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({
                    operation: 'createForIngestionAttempt',
                    entity: 'SourceVersion',
                    message: err.message,
                  })
                : err,
            ),
          ) as Effect.Effect<SourceVersionType, RepoError, never>
        }),
      ),

    findById: (id: typeof Domain.SourceVersionId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM source_versions WHERE id = $1`, [id]),
        catch: (err) => new QueryError({ operation: 'findById', entity: 'SourceVersion', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'SourceVersion', id, message: `SourceVersion ${id} not found` }))
          }
          return decodeSourceVersionRow(rows[0] as unknown as SourceVersionRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'findById', entity: 'SourceVersion', message: err.message })
                : err,
            ),
          ) as Effect.Effect<SourceVersionType, RepoError, never>
        }),
      ),

    findBySourceId: (sourceId: typeof Domain.SourceId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM source_versions WHERE source_id = $1 ORDER BY version ASC`, [sourceId]),
        catch: (err) => new QueryError({ operation: 'findBySourceId', entity: 'SourceVersion', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeSourceVersionRow(row as unknown as SourceVersionRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'findBySourceId', entity: 'SourceVersion', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<SourceVersionType, RepoError, never>,
          ),
        ),
      ),
  }
}

// =============================================================================
// ResearchThread Repository
// =============================================================================

export interface ResearchThreadRepository {
  readonly create: (thread: typeof Domain.ResearchThread.Type) => Effect.Effect<typeof Domain.ResearchThread.Type, PersistenceError, never>
  readonly findById: (id: typeof Domain.ResearchThreadId.Type) => Effect.Effect<typeof Domain.ResearchThread.Type, PersistenceError, never>
  readonly findByProjectId: (projectId: typeof Domain.ProjectId.Type) => Effect.Effect<ReadonlyArray<typeof Domain.ResearchThread.Type>, PersistenceError, never>
}

export class ResearchThreadRepo extends Effect.Service<ResearchThreadRepo>()('ResearchThreadRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeResearchThreadRepositoryImpl(sql)
  }),
}) {}

function makeResearchThreadRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): ResearchThreadRepository {
  type ResearchThreadType = typeof Domain.ResearchThread.Type
  type RepoError = PersistenceError

  return {
    create: (thread: ResearchThreadType) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO research_threads (id, project_id, title, created_at, updated_at)
             VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
             RETURNING *`,
            [thread.id, thread.projectId, thread.title, Number(thread.createdAt), Number(thread.updatedAt)],
          ),
        catch: (err) => new QueryError({ operation: 'create', entity: 'ResearchThread', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeResearchThreadRow(rows[0] as unknown as ResearchThreadRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'create', entity: 'ResearchThread', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ResearchThreadType, RepoError, never>,
        ),
      ),

    findById: (id: typeof Domain.ResearchThreadId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM research_threads WHERE id = $1`, [id]),
        catch: (err) => new QueryError({ operation: 'findById', entity: 'ResearchThread', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'ResearchThread', id, message: `ResearchThread ${id} not found` }))
          }
          return decodeResearchThreadRow(rows[0] as unknown as ResearchThreadRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'findById', entity: 'ResearchThread', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ResearchThreadType, RepoError, never>
        }),
      ),

    findByProjectId: (projectId: typeof Domain.ProjectId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM research_threads WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]),
        catch: (err) => new QueryError({ operation: 'findByProjectId', entity: 'ResearchThread', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeResearchThreadRow(row as unknown as ResearchThreadRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'findByProjectId', entity: 'ResearchThread', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<ResearchThreadType, RepoError, never>,
          ),
        ),
      ),
  }
}

// =============================================================================
// ResearchRun Repository
// =============================================================================

export interface ResearchRunRepository {
  readonly create: (run: typeof Domain.ResearchRun.Type) => Effect.Effect<typeof Domain.ResearchRun.Type, PersistenceError, never>
  readonly findById: (id: typeof Domain.ResearchRunId.Type) => Effect.Effect<typeof Domain.ResearchRun.Type, PersistenceError, never>
  readonly findByThreadId: (threadId: typeof Domain.ResearchThreadId.Type) => Effect.Effect<ReadonlyArray<typeof Domain.ResearchRun.Type>, PersistenceError, never>
  readonly updateStatus: (id: typeof Domain.ResearchRunId.Type, status: typeof Domain.ResearchStatus.Type) => Effect.Effect<typeof Domain.ResearchRun.Type, PersistenceError, never>
}

export class ResearchRunRepo extends Effect.Service<ResearchRunRepo>()('ResearchRunRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeResearchRunRepositoryImpl(sql)
  }),
}) {}

function makeResearchRunRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): ResearchRunRepository {
  type ResearchRunType = typeof Domain.ResearchRun.Type
  type RepoError = PersistenceError

  return {
    create: (run: ResearchRunType) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO research_runs (id, thread_id, question, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0))
             RETURNING *`,
            [run.id, run.threadId, run.question, run.status, Number(run.createdAt), Number(run.updatedAt)],
          ),
        catch: (err) => new QueryError({ operation: 'create', entity: 'ResearchRun', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeResearchRunRow(rows[0] as unknown as ResearchRunRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'create', entity: 'ResearchRun', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ResearchRunType, RepoError, never>,
        ),
      ),

    findById: (id: typeof Domain.ResearchRunId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM research_runs WHERE id = $1`, [id]),
        catch: (err) => new QueryError({ operation: 'findById', entity: 'ResearchRun', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'ResearchRun', id, message: `ResearchRun ${id} not found` }))
          }
          return decodeResearchRunRow(rows[0] as unknown as ResearchRunRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'findById', entity: 'ResearchRun', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ResearchRunType, RepoError, never>
        }),
      ),

    findByThreadId: (threadId: typeof Domain.ResearchThreadId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM research_runs WHERE thread_id = $1 ORDER BY created_at DESC`, [threadId]),
        catch: (err) => new QueryError({ operation: 'findByThreadId', entity: 'ResearchRun', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeResearchRunRow(row as unknown as ResearchRunRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'findByThreadId', entity: 'ResearchRun', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<ResearchRunType, RepoError, never>,
          ),
        ),
      ),

    updateStatus: (id: typeof Domain.ResearchRunId.Type, status: typeof Domain.ResearchStatus.Type) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `UPDATE research_runs SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, status],
          ),
        catch: (err) => new QueryError({ operation: 'updateStatus', entity: 'ResearchRun', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'ResearchRun', id, message: `ResearchRun ${id} not found` }))
          }
          return decodeResearchRunRow(rows[0] as unknown as ResearchRunRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'updateStatus', entity: 'ResearchRun', message: err.message })
                : err,
            ),
          ) as Effect.Effect<ResearchRunType, RepoError, never>
        }),
      ),
  }
}

// =============================================================================
// Citation Repository
// =============================================================================

export interface CitationRepository {
  readonly create: (citation: typeof Domain.Citation.Type) => Effect.Effect<typeof Domain.Citation.Type, PersistenceError, never>
  readonly findById: (id: typeof Domain.CitationId.Type) => Effect.Effect<typeof Domain.Citation.Type, PersistenceError, never>
  readonly findByRunId: (runId: typeof Domain.ResearchRunId.Type) => Effect.Effect<ReadonlyArray<typeof Domain.Citation.Type>, PersistenceError, never>
  readonly updateStatus: (id: typeof Domain.CitationId.Type, status: typeof Domain.CitationStatus.Type) => Effect.Effect<typeof Domain.Citation.Type, PersistenceError, never>
}

export class CitationRepo extends Effect.Service<CitationRepo>()('CitationRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeCitationRepositoryImpl(sql)
  }),
}) {}

function makeCitationRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): CitationRepository {
  type CitationType = typeof Domain.Citation.Type
  type RepoError = PersistenceError

  return {
    create: (citation: CitationType) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO citations (id, run_id, source_version_id, locator, status, created_at)
             VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
             RETURNING *`,
            [citation.id, citation.runId, citation.sourceVersionId, citation.locator, citation.status, Number(citation.createdAt)],
          ),
        catch: (err) => new QueryError({ operation: 'create', entity: 'Citation', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          decodeCitationRow(rows[0] as unknown as CitationRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'create', entity: 'Citation', message: err.message })
                : err,
            ),
          ) as Effect.Effect<CitationType, RepoError, never>,
        ),
      ),

    findById: (id: typeof Domain.CitationId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM citations WHERE id = $1`, [id]),
        catch: (err) => new QueryError({ operation: 'findById', entity: 'Citation', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'Citation', id, message: `Citation ${id} not found` }))
          }
          return decodeCitationRow(rows[0] as unknown as CitationRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'findById', entity: 'Citation', message: err.message })
                : err,
            ),
          ) as Effect.Effect<CitationType, RepoError, never>
        }),
      ),

    findByRunId: (runId: typeof Domain.ResearchRunId.Type) =>
      Effect.tryPromise({
        try: () => sql.unsafe(`SELECT * FROM citations WHERE run_id = $1 ORDER BY created_at ASC`, [runId]),
        catch: (err) => new QueryError({ operation: 'findByRunId', entity: 'Citation', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) =>
          Effect.forEach(rows, (row) =>
            decodeCitationRow(row as unknown as CitationRow).pipe(
              Effect.mapError((err) =>
                err instanceof DecodeError
                  ? new QueryError({ operation: 'findByRunId', entity: 'Citation', message: err.message })
                  : err,
              ),
            ) as Effect.Effect<CitationType, RepoError, never>,
          ),
        ),
      ),

    updateStatus: (id: typeof Domain.CitationId.Type, status: typeof Domain.CitationStatus.Type) =>
      Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `UPDATE citations SET status = $2 WHERE id = $1 RETURNING *`,
            [id, status],
          ),
        catch: (err) => new QueryError({ operation: 'updateStatus', entity: 'Citation', message: String(err) }),
      }).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'Citation', id, message: `Citation ${id} not found` }))
          }
          return decodeCitationRow(rows[0] as unknown as CitationRow).pipe(
            Effect.mapError((err) =>
              err instanceof DecodeError
                ? new QueryError({ operation: 'updateStatus', entity: 'Citation', message: err.message })
                : err,
            ),
          ) as Effect.Effect<CitationType, RepoError, never>
        }),
      ),
  }
}

// =============================================================================
// Job Queue Repository
// =============================================================================

export interface JobQueueRepository {
  readonly enqueue: (job: typeof Domain.JobQueue.Type) => Effect.Effect<typeof Domain.JobQueue.Type, PersistenceError, never>
  readonly claimNextIngestionJob: () => Effect.Effect<Option.Option<typeof Domain.JobQueue.Type>, PersistenceError, never>
  readonly recoverStaleIngestionJobs: (staleAfterMs: number) => Effect.Effect<{ readonly requeued: ReadonlyArray<typeof Domain.JobQueue.Type>; readonly failed: ReadonlyArray<typeof Domain.JobQueue.Type> }, PersistenceError, never>
  readonly renewLease: (job: typeof Domain.JobQueue.Type) => Effect.Effect<void, PersistenceError, never>
  readonly appendInProgressEvent: (job: typeof Domain.JobQueue.Type, event: typeof Domain.EventJournal.Type) => Effect.Effect<void, PersistenceError, never>
  readonly markCompleted: (job: typeof Domain.JobQueue.Type, event: typeof Domain.EventJournal.Type) => Effect.Effect<void, PersistenceError, never>
  readonly markPending: (job: typeof Domain.JobQueue.Type, event: typeof Domain.EventJournal.Type) => Effect.Effect<void, PersistenceError, never>
  readonly markFailed: (job: typeof Domain.JobQueue.Type, event: typeof Domain.EventJournal.Type) => Effect.Effect<void, PersistenceError, never>
  readonly findById: (id: typeof Domain.JobQueue.Type['id']) => Effect.Effect<typeof Domain.JobQueue.Type, PersistenceError, never>
}

export class JobQueueRepo extends Effect.Service<JobQueueRepo>()('JobQueueRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeJobQueueRepositoryImpl(sql)
  }),
}) {}

function decodeJobRows(rows: readonly Record<string, unknown>[], operation: string): Effect.Effect<ReadonlyArray<typeof Domain.JobQueue.Type>, PersistenceError, never> {
  return Effect.forEach(rows, (row) =>
    decodeJobQueueRow(row as unknown as JobQueueRow).pipe(
      Effect.mapError((err) =>
        err instanceof DecodeError
          ? new QueryError({ operation, entity: 'JobQueue', message: err.message })
          : err,
      ),
    ) as Effect.Effect<typeof Domain.JobQueue.Type, PersistenceError, never>,
  )
}

function makeJobQueueRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): JobQueueRepository {
  type IngestionTransition = 'append-event' | 'complete' | 'pending' | 'fail'
  type ValidatedIngestionPayload =
    | {
        readonly kind: 'file-processed'
        readonly sourceVersionId: string
        readonly manifestRef: string
        readonly contentHash: string
        readonly byteLength: number
      }
    | {
        readonly kind: 'ingestion-completed'
        readonly sourceVersionId: string
        readonly manifestRef: string
        readonly contentHash: string
      }
    | {
        readonly kind: 'ingestion-failed'
        readonly errorTag: string
        readonly retryable: boolean
      }

  const eventKeys = [
    'createdAt',
    'cursor',
    'entityId',
    'entityType',
    'eventType',
    'id',
    'payload',
    'workspaceId',
  ] as const
  const artifactRefPattern = /^artifact:\/\/sha256\/[a-f0-9]{64}$/
  const contentHashPattern = /^sha256:[a-f0-9]{64}$/
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  const failureTagPattern = /^[A-Za-z][A-Za-z0-9]{0,99}$/

  const executeRows = (operation: string, query: string, params?: readonly unknown[]) =>
    Effect.tryPromise({
      try: () => sql.unsafe(query, params),
      catch: (err) => new QueryError({ operation, entity: 'JobQueue', message: String(err) }),
    })

  const ingestionOwnershipLost = (
    job: typeof Domain.JobQueue.Type,
    transition: IngestionTransition,
  ): IngestionJobOwnershipLostError =>
    new IngestionJobOwnershipLostError({
      jobId: job.id,
      attempt: job.attempts,
      transition,
      message: 'Ingestion job attempt no longer owns the in-progress lease',
    })

  const invalidIngestionEvent = (
    transition: IngestionTransition,
    field: string,
  ): IngestionEventValidationError =>
    new IngestionEventValidationError({
      transition,
      field,
      message: `Ingestion ${transition} event has an invalid ${field}`,
    })

  const hasExactKeys = (
    value: unknown,
    expected: ReadonlyArray<string>,
  ): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const actual = Object.keys(value).sort()
    const sortedExpected = [...expected].sort()
    return actual.length === sortedExpected.length
      && actual.every((key, index) => key === sortedExpected[index])
  }

  const parseJsonObject = (value: unknown): Record<string, unknown> | undefined => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    if (typeof value !== 'string') return undefined
    try {
      const parsed: unknown = JSON.parse(value)
      return typeof parsed === 'object'
        && parsed !== null
        && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : undefined
    } catch {
      return undefined
    }
  }

  const validateOwnedTransitionEvent = (
    transition: IngestionTransition,
    job: typeof Domain.JobQueue.Type,
    event: typeof Domain.EventJournal.Type,
  ): ValidatedIngestionPayload => {
    if (!hasExactKeys(event, eventKeys)) {
      throw invalidIngestionEvent(transition, 'fields')
    }
    if (
      job.entityType !== 'ingestion'
      || job.status !== 'in-progress'
      || event.workspaceId !== job.workspaceId
      || event.entityType !== 'ingestion'
      || event.entityId !== job.entityId
    ) {
      throw ingestionOwnershipLost(job, transition)
    }
    if (
      typeof event.id !== 'string'
      || !uuidPattern.test(event.id)
    ) {
      throw invalidIngestionEvent(transition, 'id')
    }
    if (event.cursor !== 0n) {
      throw invalidIngestionEvent(transition, 'cursor')
    }
    if (
      typeof event.createdAt !== 'bigint'
      || event.createdAt < 0n
      || event.createdAt > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      throw invalidIngestionEvent(transition, 'createdAt')
    }
    const payload = event.payload
    if (
      typeof payload !== 'object'
      || payload === null
      || Array.isArray(payload)
      || typeof payload['jobId'] !== 'string'
      || !uuidPattern.test(payload['jobId'])
      || payload['jobId'] !== job.id
      || typeof payload['attempt'] !== 'number'
      || !Number.isSafeInteger(payload['attempt'])
      || payload['attempt'] < 0
      || payload['attempt'] !== job.attempts
    ) {
      throw invalidIngestionEvent(transition, 'payload.ownership')
    }

    if (transition === 'append-event') {
      if (event.eventType !== 'file-processed') {
        throw invalidIngestionEvent(transition, 'eventType')
      }
      if (!hasExactKeys(payload, [
        'attempt',
        'jobId',
        'sourceVersionId',
        'manifestRef',
        'contentHash',
        'byteLength',
      ])) {
        throw invalidIngestionEvent(transition, 'payload.fields')
      }
      if (
        typeof payload['sourceVersionId'] !== 'string'
        || !uuidPattern.test(payload['sourceVersionId'])
      ) {
        throw invalidIngestionEvent(transition, 'payload.sourceVersionId')
      }
      if (
        typeof payload['manifestRef'] !== 'string'
        || !artifactRefPattern.test(payload['manifestRef'])
      ) {
        throw invalidIngestionEvent(transition, 'payload.manifestRef')
      }
      if (
        typeof payload['contentHash'] !== 'string'
        || !contentHashPattern.test(payload['contentHash'])
      ) {
        throw invalidIngestionEvent(transition, 'payload.contentHash')
      }
      if (
        typeof payload['byteLength'] !== 'number'
        || !Number.isSafeInteger(payload['byteLength'])
        || payload['byteLength'] < 0
      ) {
        throw invalidIngestionEvent(transition, 'payload.byteLength')
      }
      return {
        kind: 'file-processed',
        sourceVersionId: payload['sourceVersionId'],
        manifestRef: payload['manifestRef'],
        contentHash: payload['contentHash'],
        byteLength: payload['byteLength'],
      }
    }

    if (transition === 'complete') {
      if (event.eventType !== 'ingestion-completed') {
        throw invalidIngestionEvent(transition, 'eventType')
      }
      if (!hasExactKeys(payload, [
        'attempt',
        'jobId',
        'sourceVersionId',
        'manifestRef',
        'contentHash',
      ])) {
        throw invalidIngestionEvent(transition, 'payload.fields')
      }
      if (
        typeof payload['sourceVersionId'] !== 'string'
        || !uuidPattern.test(payload['sourceVersionId'])
      ) {
        throw invalidIngestionEvent(transition, 'payload.sourceVersionId')
      }
      if (
        typeof payload['manifestRef'] !== 'string'
        || !artifactRefPattern.test(payload['manifestRef'])
      ) {
        throw invalidIngestionEvent(transition, 'payload.manifestRef')
      }
      if (
        typeof payload['contentHash'] !== 'string'
        || !contentHashPattern.test(payload['contentHash'])
      ) {
        throw invalidIngestionEvent(transition, 'payload.contentHash')
      }
      return {
        kind: 'ingestion-completed',
        sourceVersionId: payload['sourceVersionId'],
        manifestRef: payload['manifestRef'],
        contentHash: payload['contentHash'],
      }
    }

    if (event.eventType !== 'ingestion-failed') {
      throw invalidIngestionEvent(transition, 'eventType')
    }
    if (!hasExactKeys(payload, [
      'attempt',
      'errorTag',
      'jobId',
      'message',
      'retryable',
    ])) {
      throw invalidIngestionEvent(transition, 'payload.fields')
    }
    if (
      typeof payload['errorTag'] !== 'string'
      || !failureTagPattern.test(payload['errorTag'])
    ) {
      throw invalidIngestionEvent(transition, 'payload.errorTag')
    }
    if (payload['message'] !== 'Ingestion failed') {
      throw invalidIngestionEvent(transition, 'payload.message')
    }
    if (typeof payload['retryable'] !== 'boolean') {
      throw invalidIngestionEvent(transition, 'payload.retryable')
    }
    if (
      (
        transition === 'pending'
        && (!payload['retryable'] || job.attempts >= job.maxAttempts)
      )
      || (
        transition === 'fail'
        && payload['retryable']
        && job.attempts < job.maxAttempts
      )
    ) {
      throw invalidIngestionEvent(transition, 'payload.retryable')
    }
    return {
      kind: 'ingestion-failed',
      errorTag: payload['errorTag'],
      retryable: payload['retryable'],
    }
  }

  const ownedTransition = (
    operation: string,
    transition: IngestionTransition,
    job: typeof Domain.JobQueue.Type,
    event: typeof Domain.EventJournal.Type,
    nextStatus?: 'completed' | 'pending' | 'failed',
  ): Effect.Effect<void, PersistenceError, never> =>
    Effect.tryPromise({
      try: () => {
        const validated = validateOwnedTransitionEvent(transition, job, event)
        return sql.transaction(async (transaction) => {
          const ownership = await transaction.unsafe(
            `SELECT job.id, job.workspace_id, job.entity_type, job.entity_id,
                    job.attempts, job.max_attempts, job.payload
             FROM job_queue job
             JOIN sources source ON source.id = job.entity_id
             JOIN projects project ON project.id = source.project_id
             WHERE job.id = $1
               AND job.entity_type = 'ingestion'
               AND job.entity_id = $2
               AND job.workspace_id = $3
               AND project.workspace_id = $3
               AND job.status = 'in-progress'
               AND job.attempts = $4
             FOR UPDATE`,
            [job.id, job.entityId, job.workspaceId, job.attempts],
          )
          if (ownership.length !== 1) return false
          const ownedJob = ownership[0]!
          if (
            validated.kind === 'ingestion-failed'
            && (
              (
                transition === 'pending'
                && (
                  !validated.retryable
                  || Number(ownedJob['attempts'])
                    >= Number(ownedJob['max_attempts'])
                )
              )
              || (
                transition === 'fail'
                && validated.retryable
                && Number(ownedJob['attempts'])
                  < Number(ownedJob['max_attempts'])
              )
            )
          ) {
            throw invalidIngestionEvent(transition, 'payload.retryable')
          }

          let authoritativePayload: Record<string, unknown>
          if (validated.kind === 'ingestion-failed') {
            authoritativePayload = {
              jobId: String(ownedJob['id']),
              attempt: Number(ownedJob['attempts']),
              errorTag: validated.errorTag,
              message: 'Ingestion failed',
              retryable: validated.retryable,
            }
          } else {
            const versions = await transaction.unsafe(
              `SELECT version.id, version.artifact_ref, version.content_hash
               FROM source_versions version
               WHERE version.id = $1
                 AND version.source_id = $2`,
              [validated.sourceVersionId, job.entityId],
            )
            if (versions.length !== 1) {
              throw invalidIngestionEvent(
                transition,
                'payload.sourceVersionId',
              )
            }
            const version = versions[0]!
            if (validated.contentHash !== version['content_hash']) {
              throw invalidIngestionEvent(transition, 'payload.contentHash')
            }
            if (validated.kind === 'ingestion-completed') {
              if (validated.manifestRef !== version['artifact_ref']) {
                throw invalidIngestionEvent(transition, 'payload.manifestRef')
              }
              authoritativePayload = {
                jobId: String(ownedJob['id']),
                attempt: Number(ownedJob['attempts']),
                sourceVersionId: String(version['id']),
                manifestRef: String(version['artifact_ref']),
                contentHash: String(version['content_hash']),
              }
            } else {
              if (validated.manifestRef !== version['artifact_ref']) {
                throw invalidIngestionEvent(
                  transition,
                  'payload.manifestRef',
                )
              }
              const jobPayload = parseJsonObject(ownedJob['payload'])
              if (
                jobPayload === undefined
                || typeof jobPayload['byteLength'] !== 'number'
                || !Number.isSafeInteger(
                  jobPayload['byteLength'],
                )
                || Number(jobPayload['byteLength']) < 0
                || validated.byteLength !== jobPayload['byteLength']
              ) {
                throw invalidIngestionEvent(
                  transition,
                  'payload.byteLength',
                )
              }
              authoritativePayload = {
                jobId: String(ownedJob['id']),
                attempt: Number(ownedJob['attempts']),
                sourceVersionId: String(version['id']),
                manifestRef: String(version['artifact_ref']),
                normalizedRef: String(version['content_hash']).replace(
                  'sha256:',
                  'artifact://sha256/',
                ),
                contentHash: String(version['content_hash']),
                byteLength: jobPayload['byteLength'],
              }
            }
          }

          const transitioned = nextStatus === undefined
            ? await transaction.unsafe(
                `UPDATE job_queue
                 SET updated_at = NOW()
                 WHERE id = $1
                   AND entity_type = 'ingestion'
                   AND entity_id = $2
                   AND workspace_id = $3
                   AND status = 'in-progress'
                   AND attempts = $4
                 RETURNING id`,
                [job.id, job.entityId, job.workspaceId, job.attempts],
              )
            : await transaction.unsafe(
                `UPDATE job_queue
                 SET status = $5, updated_at = NOW()
                 WHERE id = $1
                   AND entity_type = 'ingestion'
                   AND entity_id = $2
                   AND workspace_id = $3
                   AND status = 'in-progress'
                   AND attempts = $4
                 RETURNING id`,
                [
                  job.id,
                  job.entityId,
                  job.workspaceId,
                  job.attempts,
                  nextStatus,
                ],
              )
          if (transitioned.length !== 1) return false
          await transaction.unsafe(
            `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, to_timestamp($7 / 1000.0))`,
            [
              event.id,
              ownedJob['workspace_id'],
              ownedJob['entity_type'],
              ownedJob['entity_id'],
              validated.kind,
              JSON.stringify(authoritativePayload),
              Number(event.createdAt),
            ],
          )
          return true
        })
      },
      catch: (err) =>
        err instanceof IngestionJobOwnershipLostError
          || err instanceof IngestionEventValidationError
          ? err
          : new QueryError({
              operation,
              entity: 'JobQueue',
              message: 'Ingestion job transition could not be persisted',
              cause: String(err),
            }),
    }).pipe(
      Effect.flatMap((owned) =>
        owned
          ? Effect.void
          : Effect.fail(ingestionOwnershipLost(job, transition))),
    )

  return {
    enqueue: (job) =>
      executeRows(
        'enqueue',
        `INSERT INTO job_queue (id, workspace_id, entity_type, entity_id, status, payload, attempts, max_attempts, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, to_timestamp($9 / 1000.0), to_timestamp($10 / 1000.0))
         RETURNING *`,
        [job.id, job.workspaceId, job.entityType, job.entityId, job.status, JSON.stringify(job.payload), job.attempts, job.maxAttempts, Number(job.createdAt), Number(job.updatedAt)],
      ).pipe(
        Effect.flatMap((rows) => decodeJobRows(rows, 'enqueue')),
        Effect.map((rows) => rows[0]),
      ),

    claimNextIngestionJob: () =>
      executeRows(
        'claimNextIngestionJob',
        `WITH next_job AS (
           SELECT id FROM job_queue
           WHERE entity_type = 'ingestion' AND status = 'pending'
           ORDER BY created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE job_queue
         SET status = 'in-progress', attempts = attempts + 1, updated_at = NOW()
         WHERE id IN (SELECT id FROM next_job)
         RETURNING *`,
      ).pipe(
        Effect.flatMap((rows) => decodeJobRows(rows, 'claimNextIngestionJob')),
        Effect.map((rows) => rows.length === 0 ? Option.none() : Option.some(rows[0])),
      ),

    recoverStaleIngestionJobs: (staleAfterMs) =>
      Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const requeuedRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'pending', updated_at = NOW()
               WHERE entity_type = 'ingestion'
                 AND status = 'in-progress'
                 AND updated_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
                 AND attempts < max_attempts
               RETURNING *`,
              [staleAfterMs],
            )
            const failedRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'failed', updated_at = NOW()
               WHERE entity_type = 'ingestion'
                 AND status = 'in-progress'
                 AND updated_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
                 AND attempts >= max_attempts
               RETURNING *`,
              [staleAfterMs],
            )
            if (failedRows.length > 0) {
              const terminalEvents = await transaction.unsafe(
                `INSERT INTO event_journal (
                   id, workspace_id, entity_type, entity_id,
                   event_type, payload, created_at
                 )
                 SELECT
                   md5(
                     job.id::text
                     || ':ingestion-stale-exhausted:'
                     || job.attempts::text
                   )::uuid,
                   job.workspace_id,
                   'ingestion',
                   job.entity_id,
                   'ingestion-failed',
                   jsonb_build_object(
                     'jobId', job.id::text,
                     'attempt', job.attempts,
                     'errorTag', 'StaleIngestionJobExhausted',
                     'message', 'Ingestion failed',
                     'retryable', true
                   ),
                   NOW()
                 FROM job_queue job
                 WHERE job.id = ANY($1::uuid[])
                   AND job.entity_type = 'ingestion'
                   AND job.status = 'failed'
                 ON CONFLICT (id) DO NOTHING
                 RETURNING id`,
                [failedRows.map((row) => row['id'])],
              )
              if (terminalEvents.length !== failedRows.length) {
                throw new Error('stale-ingestion-terminal-event-conflict')
              }
            }
            return { requeuedRows, failedRows }
          }),
        catch: (err) =>
          new QueryError({
            operation: 'recoverStaleIngestionJobs',
            entity: 'JobQueue',
            message: 'Stale ingestion recovery could not be persisted atomically',
            cause: String(err),
          }),
      }).pipe(
        Effect.flatMap(({ requeuedRows, failedRows }) =>
          Effect.gen(function* () {
            const requeued = yield* decodeJobRows(
              requeuedRows,
              'recoverStaleIngestionJobs.requeue',
            )
            const failed = yield* decodeJobRows(
              failedRows,
              'recoverStaleIngestionJobs.fail',
            )
            return { requeued, failed }
          })),
      ),

    renewLease: (job) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await sql.unsafe(
            `UPDATE job_queue
             SET updated_at = NOW()
             WHERE id = $1
               AND entity_type = 'ingestion'
               AND entity_id = $2
               AND workspace_id = $3
               AND status = 'in-progress'
               AND attempts = $4
             RETURNING id`,
            [job.id, job.entityId, job.workspaceId, job.attempts],
          )
          if (rows.length !== 1) {
            throw new IngestionJobOwnershipLostError({
              jobId: job.id,
              attempt: job.attempts,
              transition: 'renew-lease',
              message: 'Ingestion job attempt no longer owns the in-progress lease',
            })
          }
        },
        catch: (err) =>
          err instanceof IngestionJobOwnershipLostError
            ? err
            : new QueryError({
                operation: 'renewIngestionLease',
                entity: 'JobQueue',
                message: 'Ingestion job lease could not be renewed',
                cause: String(err),
              }),
      }),

    appendInProgressEvent: (job, event) =>
      ownedTransition('appendInProgressEvent', 'append-event', job, event),

    markCompleted: (job, event) =>
      ownedTransition('markCompleted', 'complete', job, event, 'completed'),

    markPending: (job, event) =>
      ownedTransition('markPending', 'pending', job, event, 'pending'),

    markFailed: (job, event) =>
      ownedTransition('markFailed', 'fail', job, event, 'failed'),

    findById: (id) =>
      executeRows('findById', `SELECT * FROM job_queue WHERE id = $1`, [id]).pipe(
        Effect.flatMap((rows) => {
          if (rows.length === 0) {
            return Effect.fail(new EntityNotFoundError({ entity: 'JobQueue', id, message: `JobQueue ${id} not found` }))
          }
          return decodeJobQueueRow(rows[0] as unknown as JobQueueRow).pipe(
            Effect.mapError((err) => err instanceof DecodeError ? new QueryError({ operation: 'findById', entity: 'JobQueue', message: err.message }) : err),
          ) as Effect.Effect<typeof Domain.JobQueue.Type, PersistenceError, never>
        }),
      ),
  }
}

// =============================================================================
// Event Journal Reader
// =============================================================================

export interface EventJournalReadRepository {
  readonly findByEntity: (entityType: string, entityId: typeof Domain.EventJournal.Type['entityId']) => Effect.Effect<ReadonlyArray<typeof Domain.EventJournal.Type>, PersistenceError, never>
}

export class EventJournalReader extends Effect.Service<EventJournalReader>()('EventJournalReader', {
  accessors: false,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeEventJournalReadRepositoryImpl(sql)
  }),
}) {}

function decodeEventRows(rows: readonly Record<string, unknown>[], operation: string): Effect.Effect<ReadonlyArray<typeof Domain.EventJournal.Type>, PersistenceError, never> {
  return Effect.forEach(rows, (row) =>
    decodeEventJournalRow(row as unknown as EventJournalRow).pipe(
      Effect.mapError((err) =>
        err instanceof DecodeError
          ? new QueryError({ operation, entity: 'EventJournal', message: err.message })
          : err,
      ),
    ) as Effect.Effect<typeof Domain.EventJournal.Type, PersistenceError, never>,
  )
}

function makeEventJournalReadRepositoryImpl(sql: import('../sql-client.js').SqlClientShape): EventJournalReadRepository {
  const executeRows = (operation: string, query: string, params?: readonly unknown[]) =>
    Effect.tryPromise({
      try: () => sql.unsafe(query, params),
      catch: (err) => new QueryError({ operation, entity: 'EventJournal', message: String(err) }),
    })

  return {
    findByEntity: (entityType, entityId) =>
      executeRows(
        'findByEntity',
        `SELECT * FROM event_journal WHERE entity_type = $1 AND entity_id = $2 ORDER BY cursor ASC`,
        [entityType, entityId],
      ).pipe(Effect.flatMap((rows) => decodeEventRows(rows, 'findByEntity'))),
  }
}
