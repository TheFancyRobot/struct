/**
 * Repository interfaces and Effect.Services.
 *
 * Defines the contract for each repository using Effect-TS types.
 * Each repository is an Effect.Service that depends on SqlClient.
 * Real implementations are provided via Layer from apps/api.
 */

import { Effect } from 'effect'
import type * as Domain from '@struct/domain'
import type { PersistenceError } from '../errors.js'
import { SqlClient } from '../sql-client.js'
import { QueryError, EntityNotFoundError } from '../errors.js'
import {
  decodeWorkspaceRow,
  decodeProjectRow,
  decodeSourceRow,
  decodeSourceVersionRow,
  decodeResearchThreadRow,
  decodeResearchRunRow,
  decodeCitationRow,
  type WorkspaceRow,
  type ProjectRow,
  type SourceRow,
  type SourceVersionRow,
  type ResearchThreadRow,
  type ResearchRunRow,
  type CitationRow,
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

export interface ProjectRepository {
  readonly create: (project: typeof Domain.Project.Type) => Effect.Effect<typeof Domain.Project.Type, PersistenceError, never>
  readonly findById: (id: typeof Domain.ProjectId.Type) => Effect.Effect<typeof Domain.Project.Type, PersistenceError, never>
  readonly findByWorkspaceId: (workspaceId: typeof Domain.WorkspaceId.Type) => Effect.Effect<ReadonlyArray<typeof Domain.Project.Type>, PersistenceError, never>
}

export class ProjectRepo extends Effect.Service<ProjectRepo>()('ProjectRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient
    return makeProjectRepositoryImpl(sql)
  }),
}) {}

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
