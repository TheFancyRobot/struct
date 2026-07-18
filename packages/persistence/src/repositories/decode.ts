/**
 * Row decode functions — convert PostgreSQL rows to typed domain records
 * using Effect Schema decode. Decoders fail loudly on drift (invalid UUIDs,
 * bad enum values, wrong types) instead of silently passing through.
 *
 * Timestamp conversion pattern (design debt):
 * PostgreSQL TIMESTAMPTZ columns return JavaScript `Date` objects.
 * Domain schemas use `Schema.BigIntFromNumber` for millisecond-precision timestamps.
 * Each decoder converts: `Date.getTime() → number` before Schema decode,
 * so the Schema's BigIntFromNumber transform handles the final conversion.
 *
 * Design debt note: Using BigInt for timestamps is unconventional (most apps use
 * Date or number). This choice avoids Date mutation issues and aligns with Effect's
 * immutable-by-default philosophy. If this becomes a friction point in later phases,
 * consider a custom `Schema.DateTimeMillis` transform. For now, the pattern is
 * documented clearly and accepted as debt.
 */

import { Effect, Schema, ParseResult } from 'effect'
import * as Domain from '@struct/domain'

// --- DecodeError ---

/**
 * Typed error for row decode failures.
 * Emitted when a database row does not match the expected domain schema.
 */
export class DecodeError extends Schema.TaggedError<DecodeError>()('DecodeError', {
  entity: Schema.String,
  field: Schema.String,
  reason: Schema.String,
  message: Schema.String,
}) {}

// --- Row Schemas (wire format from PostgreSQL) ---

/**
 * These schemas define the expected shape of PostgreSQL rows.
 * They convert snake_case DB columns → camelCase domain fields,
 * and Date → number (milliseconds) for BigIntFromNumber.
 */

const DateToNumber = Schema.transformOrFail(Schema.DateFromSelf, Schema.Number, {
  decode: (date) => ParseResult.succeed(date.getTime()),
  encode: (n) => ParseResult.succeed(new Date(n)),
})

const WorkspaceRowSchema = Schema.Struct({
  id: Schema.UUID,
  name: Schema.String,
  created_at: DateToNumber,
  updated_at: DateToNumber,
})

const ProjectRowSchema = Schema.Struct({
  id: Schema.UUID,
  workspace_id: Schema.UUID,
  name: Schema.String,
  created_at: DateToNumber,
  updated_at: DateToNumber,
})

const SourceRowSchema = Schema.Struct({
  id: Schema.UUID,
  project_id: Schema.UUID,
  name: Schema.String,
  kind: Schema.Union(
    Schema.Literal('document'),
    Schema.Literal('dataset'),
    Schema.Literal('directory'),
    Schema.Literal('file'),
  ),
  created_at: DateToNumber,
  updated_at: DateToNumber,
})

const SourceVersionRowSchema = Schema.Struct({
  id: Schema.UUID,
  source_id: Schema.UUID,
  version: Schema.Number,
  artifact_ref: Schema.String,
  content_hash: Schema.String,
  created_at: DateToNumber,
})

const ResearchThreadRowSchema = Schema.Struct({
  id: Schema.UUID,
  project_id: Schema.UUID,
  title: Schema.String,
  created_at: DateToNumber,
  updated_at: DateToNumber,
})

const ResearchRunRowSchema = Schema.Struct({
  id: Schema.UUID,
  thread_id: Schema.UUID,
  question: Schema.String,
  status: Schema.Union(
    Schema.Literal('pending'),
    Schema.Literal('in-progress'),
    Schema.Literal('completed'),
    Schema.Literal('failed'),
    Schema.Literal('cancelled'),
    Schema.Literal('partial'),
  ),
  created_at: DateToNumber,
  updated_at: DateToNumber,
})

const CitationRowSchema = Schema.Struct({
  id: Schema.UUID,
  run_id: Schema.UUID,
  source_version_id: Schema.UUID,
  locator: Schema.String,
  status: Schema.Union(
    Schema.Literal('validated'),
    Schema.Literal('invalid'),
    Schema.Literal('stale'),
  ),
  created_at: DateToNumber,
})

const JsonPayloadSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })

const CursorSchema = Schema.Union(Schema.String, Schema.Number, Schema.BigIntFromSelf)

const JobQueueRowSchema = Schema.Struct({
  id: Schema.UUID,
  workspace_id: Schema.UUID,
  entity_type: Schema.String,
  entity_id: Schema.UUID,
  status: Schema.Union(
    Schema.Literal('pending'),
    Schema.Literal('in-progress'),
    Schema.Literal('completed'),
    Schema.Literal('failed'),
    Schema.Literal('cancelled'),
  ),
  payload: JsonPayloadSchema,
  attempts: Schema.Number,
  max_attempts: Schema.Number,
  created_at: DateToNumber,
  updated_at: DateToNumber,
})

const EventJournalRowSchema = Schema.Struct({
  id: Schema.UUID,
  workspace_id: Schema.UUID,
  entity_type: Schema.String,
  entity_id: Schema.UUID,
  event_type: Schema.String,
  payload: JsonPayloadSchema,
  cursor: CursorSchema,
  created_at: DateToNumber,
})

// --- Decode helpers ---

function makeDecodeError(entity: string, cause: unknown): DecodeError {
  const reason = cause instanceof Error ? cause.message : String(cause)
  // Extract field name from ParseError if possible
  const fieldMatch = reason.match(/\["(\w+)"\]/)
  const field = fieldMatch ? fieldMatch[1] : 'unknown'
  return new DecodeError({ entity, field, reason, message: `Failed to decode ${entity}: ${reason}` })
}

/**
 * Decode a row through a wire schema, then map to the domain type.
 */
function decodeRow<RowSchema extends Schema.Schema.Any, DomainType>(
  row: unknown,
  wireSchema: RowSchema,
  entity: string,
  mapToDomain: (decoded: Schema.Schema.Type<RowSchema>) => DomainType,
): Effect.Effect<DomainType, DecodeError, never> {
  return Schema.decodeUnknown(wireSchema)(row).pipe(
    Effect.mapError((cause) => makeDecodeError(entity, cause)),
    Effect.map(mapToDomain),
  ) as Effect.Effect<DomainType, DecodeError, never>
}

// --- Public decode functions ---

/**
 * PostgreSQL row shape for workspaces (for type reference).
 */
export interface WorkspaceRow {
  id: string
  name: string
  created_at: Date
  updated_at: Date
}

/**
 * Decode a workspace row.
 *
 * Timestamp conversion: PostgreSQL TIMESTAMPTZ → Date.getTime() → BigInt
 * Domain schemas use Schema.BigIntFromNumber for millisecond-precision timestamps.
 */
export function decodeWorkspaceRow(row: WorkspaceRow): Effect.Effect<typeof Domain.Workspace.Type, DecodeError, never> {
  return decodeRow(
    row,
    WorkspaceRowSchema,
    'Workspace',
    (decoded) => ({
      id: decoded.id as typeof Domain.Workspace.Type['id'],
      name: decoded.name,
      createdAt: BigInt(decoded.created_at),
      updatedAt: BigInt(decoded.updated_at),
    }),
  )
}

/**
 * PostgreSQL row shape for projects.
 */
export interface ProjectRow {
  id: string
  workspace_id: string
  name: string
  created_at: Date
  updated_at: Date
}

export function decodeProjectRow(row: ProjectRow): Effect.Effect<typeof Domain.Project.Type, DecodeError, never> {
  return decodeRow(
    row,
    ProjectRowSchema,
    'Project',
    (decoded) => ({
      id: decoded.id as typeof Domain.Project.Type['id'],
      workspaceId: decoded.workspace_id as typeof Domain.Project.Type['workspaceId'],
      name: decoded.name,
      createdAt: BigInt(decoded.created_at),
      updatedAt: BigInt(decoded.updated_at),
    }),
  )
}

/**
 * PostgreSQL row shape for sources.
 */
export interface SourceRow {
  id: string
  project_id: string
  name: string
  kind: string
  created_at: Date
  updated_at: Date
}

export function decodeSourceRow(row: SourceRow): Effect.Effect<typeof Domain.Source.Type, DecodeError, never> {
  return decodeRow(
    row,
    SourceRowSchema,
    'Source',
    (decoded) => ({
      id: decoded.id as typeof Domain.Source.Type['id'],
      projectId: decoded.project_id as typeof Domain.Source.Type['projectId'],
      name: decoded.name,
      kind: decoded.kind,
      createdAt: BigInt(decoded.created_at),
      updatedAt: BigInt(decoded.updated_at),
    }),
  )
}

/**
 * PostgreSQL row shape for source versions.
 * Source versions are immutable per DEC-0006 — no updated_at.
 */
export interface SourceVersionRow {
  id: string
  source_id: string
  version: number
  artifact_ref: string
  content_hash: string
  created_at: Date
}

export function decodeSourceVersionRow(row: SourceVersionRow): Effect.Effect<typeof Domain.SourceVersion.Type, DecodeError, never> {
  return decodeRow(
    row,
    SourceVersionRowSchema,
    'SourceVersion',
    (decoded) => ({
      id: decoded.id as typeof Domain.SourceVersion.Type['id'],
      sourceId: decoded.source_id as typeof Domain.SourceVersion.Type['sourceId'],
      version: decoded.version,
      artifactRef: decoded.artifact_ref,
      contentHash: decoded.content_hash,
      createdAt: BigInt(decoded.created_at),
    }),
  )
}

/**
 * PostgreSQL row shape for research threads.
 */
export interface ResearchThreadRow {
  id: string
  project_id: string
  title: string
  created_at: Date
  updated_at: Date
}

export function decodeResearchThreadRow(row: ResearchThreadRow): Effect.Effect<typeof Domain.ResearchThread.Type, DecodeError, never> {
  return decodeRow(
    row,
    ResearchThreadRowSchema,
    'ResearchThread',
    (decoded) => ({
      id: decoded.id as typeof Domain.ResearchThread.Type['id'],
      projectId: decoded.project_id as typeof Domain.ResearchThread.Type['projectId'],
      title: decoded.title,
      createdAt: BigInt(decoded.created_at),
      updatedAt: BigInt(decoded.updated_at),
    }),
  )
}

/**
 * PostgreSQL row shape for research runs.
 */
export interface ResearchRunRow {
  id: string
  thread_id: string
  question: string
  status: string
  created_at: Date
  updated_at: Date
}

export function decodeResearchRunRow(row: ResearchRunRow): Effect.Effect<typeof Domain.ResearchRun.Type, DecodeError, never> {
  return decodeRow(
    row,
    ResearchRunRowSchema,
    'ResearchRun',
    (decoded) => ({
      id: decoded.id as typeof Domain.ResearchRun.Type['id'],
      threadId: decoded.thread_id as typeof Domain.ResearchRun.Type['threadId'],
      question: decoded.question,
      status: decoded.status,
      createdAt: BigInt(decoded.created_at),
      updatedAt: BigInt(decoded.updated_at),
    }),
  )
}

/**
 * PostgreSQL row shape for citations.
 * Citations reference immutable source versions (DEC-0006).
 */
export interface CitationRow {
  id: string
  run_id: string
  source_version_id: string
  locator: string
  status: string
  created_at: Date
}

export function decodeCitationRow(row: CitationRow): Effect.Effect<typeof Domain.Citation.Type, DecodeError, never> {
  return decodeRow(
    row,
    CitationRowSchema,
    'Citation',
    (decoded) => ({
      id: decoded.id as typeof Domain.Citation.Type['id'],
      runId: decoded.run_id as typeof Domain.Citation.Type['runId'],
      sourceVersionId: decoded.source_version_id as typeof Domain.Citation.Type['sourceVersionId'],
      locator: decoded.locator,
      status: decoded.status,
      createdAt: BigInt(decoded.created_at),
    }),
  )
}

export interface JobQueueRow {
  id: string
  workspace_id: string
  entity_type: string
  entity_id: string
  status: string
  payload: unknown
  attempts: number
  max_attempts: number
  created_at: Date
  updated_at: Date
}

function normalizePayload(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload
  try {
    return JSON.parse(payload)
  } catch {
    return payload
  }
}

export function decodeJobQueueRow(row: JobQueueRow): Effect.Effect<typeof Domain.JobQueue.Type, DecodeError, never> {
  return decodeRow(
    { ...row, payload: normalizePayload(row.payload) },
    JobQueueRowSchema,
    'JobQueue',
    (decoded) => ({
      id: decoded.id as typeof Domain.JobQueue.Type['id'],
      workspaceId: decoded.workspace_id as typeof Domain.JobQueue.Type['workspaceId'],
      entityType: decoded.entity_type,
      entityId: decoded.entity_id as typeof Domain.JobQueue.Type['entityId'],
      status: decoded.status,
      payload: decoded.payload,
      attempts: decoded.attempts,
      maxAttempts: decoded.max_attempts,
      createdAt: BigInt(decoded.created_at),
      updatedAt: BigInt(decoded.updated_at),
    }),
  )
}

export interface EventJournalRow {
  id: string
  workspace_id: string
  entity_type: string
  entity_id: string
  event_type: string
  payload: unknown
  cursor: string | number | bigint
  created_at: Date
}

function cursorToBigInt(cursor: string | number | bigint): bigint {
  return typeof cursor === 'bigint' ? cursor : BigInt(cursor)
}

export function decodeEventJournalRow(row: EventJournalRow): Effect.Effect<typeof Domain.EventJournal.Type, DecodeError, never> {
  return decodeRow(
    { ...row, payload: normalizePayload(row.payload) },
    EventJournalRowSchema,
    'EventJournal',
    (decoded) => ({
      id: decoded.id as typeof Domain.EventJournal.Type['id'],
      workspaceId: decoded.workspace_id as typeof Domain.EventJournal.Type['workspaceId'],
      entityType: decoded.entity_type,
      entityId: decoded.entity_id as typeof Domain.EventJournal.Type['entityId'],
      eventType: decoded.event_type,
      payload: decoded.payload,
      cursor: cursorToBigInt(decoded.cursor),
      createdAt: BigInt(decoded.created_at),
    }),
  )
}
