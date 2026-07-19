import {
  DirectoryManifest,
  DirectoryIngestionJob,
  DirectorySnapshotId,
  Document,
  DocumentChunk,
  ProjectId,
  SourceId,
  SourceVersionId,
  Sha256Digest,
  compareDirectoryRelativePaths,
  hashDocumentChunkText,
  makeDocumentChunkId,
  type DirectoryManifestEntry,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import { QueryError } from '../errors.js'
import { SqlClient } from '../sql-client.js'

const RefreshResult = Schema.Struct({
  snapshotId: DirectorySnapshotId,
  manifestDigest: Sha256Digest,
  checkpointSequence: Schema.Number.pipe(Schema.int(), Schema.positive()),
  added: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  modified: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  unchanged: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  removed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  unsupported: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type DirectoryRefreshResult = Schema.Schema.Type<typeof RefreshResult>

export class DirectoryRefreshValidationError
  extends Schema.TaggedError<DirectoryRefreshValidationError>()(
    'DirectoryRefreshValidationError',
    {
      field: Schema.String,
      reason: Schema.String,
      message: Schema.String,
    },
  ) {}

export interface PreparedChunkEmbedding {
  readonly chunkId: DocumentChunk['id']
  readonly embeddingModel: string
  readonly values: ReadonlyArray<number>
}

export interface PreparedDirectorySourceVersion {
  readonly entryId: DirectoryManifestEntry['id']
  readonly sourceId: typeof SourceId.Type
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly artifact: {
    readonly ref: `artifact://sha256/${string}`
    readonly contentHash: DirectoryManifestEntry['contentHash']
    readonly byteLength: number
    readonly mediaType: string
  }
  readonly document: Document | null
  readonly chunks: ReadonlyArray<DocumentChunk>
  readonly embeddings: ReadonlyArray<PreparedChunkEmbedding>
}

export interface CommitDirectoryRefreshInput {
  readonly job: DirectoryIngestionJob
  readonly idempotencyKey: string
  readonly projectId: typeof ProjectId.Type
  readonly previousManifest: DirectoryManifest | null
  readonly currentManifest: DirectoryManifest
  readonly prepared: ReadonlyArray<PreparedDirectorySourceVersion>
}

export type CommitDirectoryRefreshResult =
  | { readonly _tag: 'Committed'; readonly result: DirectoryRefreshResult }
  | { readonly _tag: 'Replayed'; readonly result: DirectoryRefreshResult }
  | { readonly _tag: 'StaleWorkerNoOp' }

interface TransactionExecutor {
  readonly unsafe: (
    query: string,
    params?: readonly unknown[],
  ) => Promise<readonly Record<string, unknown>[]>
}

function queryError(operation: string, cause?: unknown): QueryError {
  return new QueryError({
    operation,
    entity: 'DirectoryRefresh',
    message: `Directory refresh ${operation} could not be persisted`,
    ...(cause === undefined ? {} : { cause: String(cause) }),
  })
}

function validation(
  field: string,
  reason: string,
  message: string,
): DirectoryRefreshValidationError {
  return new DirectoryRefreshValidationError({ field, reason, message })
}

function assertInput(input: CommitDirectoryRefreshInput): void {
  if (
    input.job.snapshotId !== input.currentManifest.snapshotId
    || input.job.workspaceId !== input.currentManifest.workspaceId
    || input.projectId !== input.currentManifest.projectId
  ) {
    throw validation(
      'manifest',
      'scope-mismatch',
      'Refresh job, project, and current manifest scope must match',
    )
  }
  if (
    input.previousManifest !== null
    && (
      input.previousManifest.directoryRootId
        !== input.currentManifest.directoryRootId
      || input.previousManifest.workspaceId !== input.currentManifest.workspaceId
      || input.previousManifest.projectId !== input.currentManifest.projectId
    )
  ) {
    throw validation(
      'previousManifest',
      'scope-mismatch',
      'Previous and current manifests must share one registered directory scope',
    )
  }
  if (input.idempotencyKey.length === 0 || input.idempotencyKey.length > 512) {
    throw validation(
      'idempotencyKey',
      'invalid',
      'Refresh idempotency key must contain between 1 and 512 characters',
    )
  }
  const preparedIds = new Set(input.prepared.map((item) => item.entryId))
  if (preparedIds.size !== input.prepared.length) {
    throw validation(
      'prepared',
      'duplicate-entry',
      'Prepared refresh entries must be unique',
    )
  }
  for (const item of input.prepared) {
    const entry = input.currentManifest.entries.find(
      (candidate) => candidate.id === item.entryId,
    )
    if (
      entry === undefined
      || entry.status !== 'included'
      || item.artifact.contentHash !== entry.contentHash
      || item.artifact.byteLength !== entry.byteLength
      || item.artifact.ref !== entry.contentHash?.replace(
        'sha256:',
        'artifact://sha256/',
      )
      || item.artifact.mediaType.length === 0
    ) {
      throw validation(
        `prepared.${item.entryId}`,
        'artifact-mismatch',
        'Prepared artifact metadata must match its included manifest entry',
      )
    }
    if (
      item.document === null
        ? item.chunks.length > 0 || item.embeddings.length > 0
        : (
            item.document.sourceVersionId !== item.sourceVersionId
            || item.chunks.some((chunk) =>
              chunk.documentId !== item.document?.id
              || chunk.sourceVersionId !== item.sourceVersionId)
            || item.embeddings.some((embedding) =>
              !item.chunks.some((chunk) => chunk.id === embedding.chunkId)
              || embedding.embeddingModel.length === 0
              || embedding.values.length === 0
              || embedding.values.some((value) => !Number.isFinite(value))
            )
          )
    ) {
      throw validation(
        `prepared.${item.entryId}.document`,
        'lineage-mismatch',
        'Prepared document, chunks, and embeddings must share one source version',
      )
    }
    if (item.document !== null) {
      const encoder = new TextEncoder()
      for (const [ordinal, chunk] of item.chunks.entries()) {
        const text = item.document.normalizedText.slice(
          chunk.locator.charStart,
          chunk.locator.charEnd,
        )
        if (
          chunk.ordinal !== ordinal
          || chunk.id !== makeDocumentChunkId(
            item.document.id,
            chunk.chunkingVersion,
            ordinal,
          )
          || chunk.text !== text
          || chunk.textHash !== hashDocumentChunkText(chunk.text)
          || chunk.locator.byteStart !== encoder.encode(
            item.document.normalizedText.slice(0, chunk.locator.charStart),
          ).byteLength
          || chunk.locator.byteEnd !== encoder.encode(
            item.document.normalizedText.slice(0, chunk.locator.charEnd),
          ).byteLength
        ) {
          throw validation(
            `prepared.${item.entryId}.chunks.${ordinal}`,
            'invalid-derived-content',
            'Prepared chunks must deterministically round-trip their document',
          )
        }
      }
      if (item.embeddings.some((embedding) =>
        embedding.values.every((value) => value === 0))) {
        throw validation(
          `prepared.${item.entryId}.embeddings`,
          'zero-vector',
          'Prepared embeddings must contain a non-zero value',
        )
      }
    }
  }
}

async function insertManifest(
  transaction: TransactionExecutor,
  input: CommitDirectoryRefreshInput,
): Promise<void> {
  const current = input.currentManifest
  await transaction.unsafe(
    `INSERT INTO directory_snapshots (
       id, directory_root_id, workspace_id, project_id,
       previous_snapshot_id, manifest_digest
     )
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      current.snapshotId,
      current.directoryRootId,
      current.workspaceId,
      current.projectId,
      input.previousManifest?.snapshotId ?? null,
      current.digest,
    ],
  )
  for (const entry of current.entries) {
    await transaction.unsafe(
      `INSERT INTO directory_manifest_entries (
         id, snapshot_id, directory_root_id, workspace_id, project_id,
         relative_path, status, byte_length, content_hash, unsupported_reason
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.id,
        entry.snapshotId,
        entry.directoryRootId,
        entry.workspaceId,
        entry.projectId,
        entry.relativePath,
        entry.status,
        entry.byteLength,
        entry.contentHash,
        entry.unsupportedReason,
      ],
    )
  }
}

function pgVector(values: ReadonlyArray<number>): string {
  return `[${values.join(',')}]`
}

async function insertPreparedDocument(
  transaction: TransactionExecutor,
  input: CommitDirectoryRefreshInput,
  prepared: PreparedDirectorySourceVersion,
): Promise<void> {
  if (prepared.document === null) return
  const document = prepared.document
  await transaction.unsafe(
    `INSERT INTO documents (
       id, workspace_id, project_id, source_id, source_version_id, format,
       normalized_text, content_hash, parser_version, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10 / 1000.0))`,
    [
      document.id,
      input.job.workspaceId,
      input.projectId,
      prepared.sourceId,
      prepared.sourceVersionId,
      document.format,
      document.normalizedText,
      document.contentHash,
      document.parserVersion,
      Number(document.createdAt),
    ],
  )
  for (const chunk of prepared.chunks) {
    await transaction.unsafe(
      `INSERT INTO document_chunks (
         id, document_id, workspace_id, project_id, source_id,
         source_version_id, chunking_version, ordinal, text, text_hash,
         page, section, paragraph, char_start, char_end, byte_start, byte_end,
         created_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17, to_timestamp($18 / 1000.0)
       )`,
      [
        chunk.id,
        chunk.documentId,
        input.job.workspaceId,
        input.projectId,
        prepared.sourceId,
        prepared.sourceVersionId,
        chunk.chunkingVersion,
        chunk.ordinal,
        chunk.text,
        chunk.textHash,
        chunk.locator.page,
        chunk.locator.section,
        chunk.locator.paragraph,
        chunk.locator.charStart,
        chunk.locator.charEnd,
        chunk.locator.byteStart,
        chunk.locator.byteEnd,
        Number(chunk.createdAt),
      ],
    )
  }
  for (const embedding of prepared.embeddings) {
    const chunk = prepared.chunks.find(
      (candidate) => candidate.id === embedding.chunkId,
    )
    if (chunk === undefined) {
      throw validation(
        `prepared.${prepared.entryId}.embeddings`,
        'missing-chunk',
        'Prepared embedding does not reference a prepared chunk',
      )
    }
    await transaction.unsafe(
      `INSERT INTO document_chunk_embeddings (
         chunk_id, document_id, workspace_id, project_id, source_id,
         source_version_id, chunking_version, embedding_model,
         dimensions, embedding
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector)`,
      [
        chunk.id,
        chunk.documentId,
        input.job.workspaceId,
        input.projectId,
        prepared.sourceId,
        prepared.sourceVersionId,
        chunk.chunkingVersion,
        embedding.embeddingModel,
        embedding.values.length,
        pgVector(embedding.values),
      ],
    )
  }
}

export class DirectorySourceVersionRepo
  extends Effect.Service<DirectorySourceVersionRepo>()(
    'DirectorySourceVersionRepo',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const sql = yield* SqlClient

        const commitRefresh = Effect.fn(
          'DirectorySourceVersionRepo.commitRefresh',
        )(function* (input: CommitDirectoryRefreshInput) {
          yield* Schema.decodeUnknown(Schema.typeSchema(DirectoryIngestionJob))(
            input.job,
          ).pipe(Effect.mapError(() =>
            validation('job', 'invalid', 'Directory ingestion job is invalid')))
          yield* Schema.decodeUnknown(DirectoryManifest)(
            input.currentManifest,
          ).pipe(Effect.mapError(() =>
            validation('currentManifest', 'invalid', 'Current manifest is invalid')))
          if (input.previousManifest !== null) {
            yield* Schema.decodeUnknown(DirectoryManifest)(
              input.previousManifest,
            ).pipe(Effect.mapError(() =>
              validation('previousManifest', 'invalid', 'Previous manifest is invalid')))
          }
          for (const item of input.prepared) {
            yield* Schema.decodeUnknown(SourceId)(item.sourceId).pipe(
              Effect.mapError(() =>
                validation(
                  `prepared.${item.entryId}.sourceId`,
                  'invalid',
                  'Prepared source ID is invalid',
                )),
            )
            yield* Schema.decodeUnknown(SourceVersionId)(
              item.sourceVersionId,
            ).pipe(Effect.mapError(() =>
              validation(
                `prepared.${item.entryId}.sourceVersionId`,
                'invalid',
                'Prepared source version ID is invalid',
              )))
            if (item.document !== null) {
              yield* Schema.decodeUnknown(Schema.typeSchema(Document))(
                item.document,
              ).pipe(Effect.mapError(() =>
                validation(
                  `prepared.${item.entryId}.document`,
                  'invalid',
                  'Prepared document is invalid',
                )))
            }
            yield* Effect.forEach(item.chunks, (chunk) =>
              Schema.decodeUnknown(Schema.typeSchema(DocumentChunk))(
                chunk,
              ).pipe(Effect.mapError(() =>
                validation(
                  `prepared.${item.entryId}.chunks`,
                  'invalid',
                  'Prepared document chunk is invalid',
                ))))
            yield* Effect.forEach(item.embeddings, (embedding) =>
              Schema.decodeUnknown(
                Schema.Array(Schema.Number),
              )(embedding.values).pipe(Effect.mapError(() =>
                validation(
                  `prepared.${item.entryId}.embeddings`,
                  'invalid',
                  'Prepared embedding is invalid',
                ))))
          }
          yield* Effect.try({
            try: () => assertInput(input),
            catch: (cause) =>
              cause instanceof DirectoryRefreshValidationError
                ? cause
                : validation('input', 'invalid', 'Refresh input is invalid'),
          })

          return yield* Effect.tryPromise({
            try: () =>
              sql.transaction(async (transaction) => {
                const ownership = await transaction.unsafe(
                  `SELECT 1
                   FROM job_queue job
                   JOIN directory_ingestion_jobs directory
                     ON directory.job_id = job.id
                   WHERE job.id = $1
                     AND job.workspace_id = $2
                     AND job.status = 'in-progress'
                     AND directory.status = 'running'
                     AND directory.snapshot_id = $3
                     AND job.attempts = $4
                     AND job.lease_token = $5
                     AND job.lease_expires_at > NOW()
                   FOR UPDATE OF job`,
                  [
                    input.job.jobId,
                    input.job.workspaceId,
                    input.job.snapshotId,
                    input.job.attempt,
                    input.job.leaseToken,
                  ],
                )
                if (ownership.length !== 1) {
                  return { _tag: 'StaleWorkerNoOp' } as const
                }

                const replay = await transaction.unsafe(
                  `SELECT result
                   FROM directory_refresh_commits
                   WHERE job_id = $1 AND idempotency_key = $2`,
                  [input.job.jobId, input.idempotencyKey],
                )
                if (replay.length === 1) {
                  const stored: unknown =
                    typeof replay[0]?.['result'] === 'string'
                    ? JSON.parse(String(replay[0]?.['result']))
                    : replay[0]?.['result']
                  const result = Schema.decodeUnknownSync(RefreshResult)(
                    stored,
                  )
                  return { _tag: 'Replayed', result } as const
                }

                const root = await transaction.unsafe(
                  `SELECT 1 FROM directory_roots
                   WHERE id = $1 AND workspace_id = $2 AND project_id = $3
                   FOR UPDATE`,
                  [
                    input.currentManifest.directoryRootId,
                    input.job.workspaceId,
                    input.projectId,
                  ],
                )
                if (root.length !== 1) {
                  throw validation(
                    'directoryRootId',
                    'unregistered-or-foreign',
                    'Directory root is not registered in this workspace and project',
                  )
                }
                const latest = await transaction.unsafe(
                  `SELECT snapshot.id
                   FROM directory_snapshots snapshot
                   WHERE snapshot.directory_root_id = $1
                     AND snapshot.workspace_id = $2
                     AND snapshot.project_id = $3
                     AND NOT EXISTS (
                       SELECT 1
                       FROM directory_snapshots child
                       WHERE child.previous_snapshot_id = snapshot.id
                         AND child.directory_root_id =
                           snapshot.directory_root_id
                         AND child.workspace_id = snapshot.workspace_id
                         AND child.project_id = snapshot.project_id
                     )`,
                  [
                    input.currentManifest.directoryRootId,
                    input.job.workspaceId,
                    input.projectId,
                  ],
                )
                if (latest.length > 1) {
                  throw validation(
                    'previousManifest',
                    'ambiguous-head',
                    'Directory snapshot lineage has more than one current head',
                  )
                }
                const expectedPrevious =
                  input.previousManifest?.snapshotId ?? null
                const actualPrevious = latest[0]?.['id'] ?? null
                if (actualPrevious !== expectedPrevious) {
                  throw validation(
                    'previousManifest',
                    'stale-head',
                    'Refresh must extend the latest committed directory snapshot',
                  )
                }
                if (input.previousManifest !== null) {
                  const previous = await transaction.unsafe(
                    `SELECT 1 FROM directory_snapshots
                     WHERE id = $1
                       AND directory_root_id = $2
                       AND workspace_id = $3
                       AND project_id = $4
                       AND manifest_digest = $5`,
                    [
                      input.previousManifest.snapshotId,
                      input.previousManifest.directoryRootId,
                      input.previousManifest.workspaceId,
                      input.previousManifest.projectId,
                      input.previousManifest.digest,
                    ],
                  )
                  if (previous.length !== 1) {
                    throw validation(
                      'previousManifest',
                      'not-committed',
                      'Previous manifest is not the committed snapshot in this scope',
                    )
                  }
                }

                const previousLineage = input.previousManifest === null
                  ? []
                  : await transaction.unsafe(
                      `SELECT relative_path, source_id, source_version_id,
                              previous_source_version_id
                       FROM directory_entry_lineage
                       WHERE snapshot_id = $1
                         AND disposition IN (
                           'added', 'modified', 'unchanged', 'unsupported'
                         )
                         AND source_id IS NOT NULL`,
                      [input.previousManifest.snapshotId],
                    )
                const previousByPath = new Map(previousLineage.map((row) => [
                  String(row['relative_path']),
                  {
                    sourceId: SourceId.make(String(row['source_id'])),
                    sourceVersionId: SourceVersionId.make(
                      String(
                        row['source_version_id']
                          ?? row['previous_source_version_id'],
                      ),
                    ),
                  },
                ]))
                const previousEntries = new Map(
                  (input.previousManifest?.entries ?? []).map((entry) => [
                    entry.relativePath,
                    entry,
                  ]),
                )
                const currentEntries = new Map(
                  input.currentManifest.entries.map((entry) => [
                    entry.relativePath,
                    entry,
                  ]),
                )
                const paths = Array.from(new Set([
                  ...previousEntries.keys(),
                  ...currentEntries.keys(),
                ])).sort(compareDirectoryRelativePaths)
                const preparedByEntry = new Map(
                  input.prepared.map((item) => [item.entryId, item]),
                )
                const counts = {
                  added: 0,
                  modified: 0,
                  unchanged: 0,
                  removed: 0,
                  unsupported: 0,
                }

                await insertManifest(transaction, input)
                for (const path of paths) {
                  const previousEntry = previousEntries.get(path)
                  const currentEntry = currentEntries.get(path)
                  const prior = previousByPath.get(String(path))
                  if (currentEntry === undefined) {
                    if (previousEntry?.status === 'included' && prior === undefined) {
                      throw validation(
                        `previousManifest.${path}`,
                        'missing-lineage',
                        'Removed included content requires committed prior lineage',
                      )
                    }
                    counts.removed += 1
                    await transaction.unsafe(
                      `INSERT INTO directory_entry_lineage (
                         snapshot_id, relative_path, manifest_entry_id,
                         source_id, source_version_id,
                         previous_source_version_id, disposition
                       )
                       VALUES ($1, $2, NULL, $3, NULL, $4, 'removed')`,
                      [
                        input.currentManifest.snapshotId,
                        path,
                        prior?.sourceId ?? null,
                        prior?.sourceVersionId ?? null,
                      ],
                    )
                    continue
                  }
                  if (currentEntry.status === 'unsupported') {
                    counts.unsupported += 1
                    await transaction.unsafe(
                      `INSERT INTO directory_entry_lineage (
                         snapshot_id, relative_path, manifest_entry_id,
                         source_id, source_version_id,
                         previous_source_version_id, disposition
                       )
                       VALUES ($1, $2, $3, $4, NULL, $5, 'unsupported')`,
                      [
                        input.currentManifest.snapshotId,
                        path,
                        currentEntry.id,
                        prior?.sourceId ?? null,
                        prior?.sourceVersionId ?? null,
                      ],
                    )
                    continue
                  }
                  const unchanged = previousEntry?.status === 'included'
                    && previousEntry.contentHash === currentEntry.contentHash
                  if (unchanged) {
                    if (prior === undefined) {
                      throw validation(
                        `previousManifest.${path}`,
                        'missing-lineage',
                        'Unchanged content requires committed prior lineage',
                      )
                    }
                    counts.unchanged += 1
                    await transaction.unsafe(
                      `INSERT INTO directory_entry_lineage (
                         snapshot_id, relative_path, manifest_entry_id,
                         source_id, source_version_id,
                         previous_source_version_id, disposition
                       )
                       VALUES ($1, $2, $3, $4, $5, $5, 'unchanged')`,
                      [
                        input.currentManifest.snapshotId,
                        path,
                        currentEntry.id,
                        prior.sourceId,
                        prior.sourceVersionId,
                      ],
                    )
                    continue
                  }
                  const prepared = preparedByEntry.get(currentEntry.id)
                  if (prepared === undefined) {
                    throw validation(
                      `prepared.${currentEntry.id}`,
                      'missing',
                      'Added and modified entries require a prepared artifact',
                    )
                  }
                  const isModified = prior !== undefined
                  if (isModified && prepared.sourceId !== prior.sourceId) {
                    throw validation(
                      `prepared.${currentEntry.id}.sourceId`,
                      'lineage-mismatch',
                      'Modified content must preserve its logical source identity',
                    )
                  }
                  if (!isModified) {
                    await transaction.unsafe(
                      `INSERT INTO sources (
                         id, project_id, name, kind
                       ) VALUES ($1, $2, $3, 'file')`,
                      [prepared.sourceId, input.projectId, path],
                    )
                  }
                  const versions = await transaction.unsafe(
                    `SELECT COALESCE(MAX(version), 0)::int AS latest
                     FROM source_versions WHERE source_id = $1`,
                    [prepared.sourceId],
                  )
                  const nextVersion = Number(versions[0]?.['latest']) + 1
                  const artifactRows = await transaction.unsafe(
                    `INSERT INTO artifact_objects (
                       ref, content_hash, byte_length, media_type
                     )
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (ref) DO UPDATE
                     SET ref = artifact_objects.ref
                     WHERE artifact_objects.content_hash = EXCLUDED.content_hash
                       AND artifact_objects.byte_length = EXCLUDED.byte_length
                     RETURNING ref`,
                    [
                      prepared.artifact.ref,
                      prepared.artifact.contentHash,
                      prepared.artifact.byteLength,
                      prepared.artifact.mediaType,
                    ],
                  )
                  if (artifactRows.length !== 1) {
                    throw validation(
                      `prepared.${currentEntry.id}.artifact`,
                      'immutable-conflict',
                      'Existing artifact metadata does not match the staged object',
                    )
                  }
                  await transaction.unsafe(
                    `INSERT INTO source_versions (
                       id, source_id, version, artifact_ref, content_hash
                     ) VALUES ($1, $2, $3, $4, $5)`,
                    [
                      prepared.sourceVersionId,
                      prepared.sourceId,
                      nextVersion,
                      prepared.artifact.ref,
                      prepared.artifact.contentHash,
                    ],
                  )
                  await insertPreparedDocument(transaction, input, prepared)
                  const disposition = isModified ? 'modified' : 'added'
                  counts[disposition] += 1
                  await transaction.unsafe(
                    `INSERT INTO directory_entry_lineage (
                       snapshot_id, relative_path, manifest_entry_id,
                       source_id, source_version_id,
                       previous_source_version_id, disposition
                     )
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                      input.currentManifest.snapshotId,
                      path,
                      currentEntry.id,
                      prepared.sourceId,
                      prepared.sourceVersionId,
                      prior?.sourceVersionId ?? null,
                      disposition,
                    ],
                  )
                }
                const unusedPrepared = input.prepared.find((item) =>
                  !input.currentManifest.entries.some((entry) =>
                    entry.id === item.entryId
                    && entry.status === 'included'
                    && !(
                      previousEntries.get(entry.relativePath)?.status === 'included'
                      && previousEntries.get(entry.relativePath)?.contentHash
                        === entry.contentHash
                    )))
                if (unusedPrepared !== undefined) {
                  throw validation(
                    `prepared.${unusedPrepared.entryId}`,
                    'unexpected',
                    'Only added and modified entries may carry prepared artifacts',
                  )
                }

                const checkpointRows = await transaction.unsafe(
                  `UPDATE directory_ingestion_jobs
                   SET next_checkpoint_sequence = next_checkpoint_sequence + 1,
                       updated_at = NOW()
                   WHERE job_id = $1 AND status = 'running'
                   RETURNING next_checkpoint_sequence - 1
                     AS checkpoint_sequence`,
                  [input.job.jobId],
                )
                if (checkpointRows.length !== 1) {
                  return { _tag: 'StaleWorkerNoOp' } as const
                }
                const checkpointSequence = Number(
                  checkpointRows[0]?.['checkpoint_sequence'],
                )
                const result: DirectoryRefreshResult = {
                  snapshotId: input.currentManifest.snapshotId,
                  manifestDigest: input.currentManifest.digest,
                  checkpointSequence,
                  ...counts,
                }
                const eventRows = await transaction.unsafe(
                  `INSERT INTO event_journal (
                     id, workspace_id, entity_type, entity_id, event_type, payload
                   )
                   VALUES (
                     md5($1::uuid::text || ':' || $2::text || ':refresh')::uuid,
                     $3, 'directory-ingestion', $1,
                     'directory-refresh-committed', $4::jsonb
                   )
                   RETURNING id`,
                  [
                    input.job.jobId,
                    input.idempotencyKey,
                    input.job.workspaceId,
                    JSON.stringify(result),
                  ],
                )
                await transaction.unsafe(
                  `INSERT INTO directory_refresh_commits (
                     job_id, idempotency_key, snapshot_id,
                     checkpoint_sequence, result, event_id
                   )
                   VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
                  [
                    input.job.jobId,
                    input.idempotencyKey,
                    input.currentManifest.snapshotId,
                    checkpointSequence,
                    JSON.stringify(result),
                    eventRows[0]?.['id'],
                  ],
                )
                return { _tag: 'Committed', result } as const
              }),
            catch: (cause) => {
              if (cause instanceof DirectoryRefreshValidationError) return cause
              return queryError('commit', cause)
            },
          })
        })

        return { commitRefresh }
      }),
    },
  ) {}
