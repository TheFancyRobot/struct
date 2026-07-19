import {
  DocumentChunk,
  DocumentChunkId,
  DocumentId,
  DocumentLocator,
  SourceVersionId,
  hashDocumentChunkText,
  makeDocumentChunkId,
  type Document,
  type JobQueue,
  type ProjectId,
  type SourceId,
  type WorkspaceId,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import {
  DocumentChunkValidationError,
  IngestionJobOwnershipLostError,
  QueryError,
} from '../errors.js'
import { SqlClient } from '../sql-client.js'

export interface StoreDocumentChunksInput {
  readonly job: typeof JobQueue.Type
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly sourceId: typeof SourceId.Type
  readonly document: Document
  readonly chunks: ReadonlyArray<DocumentChunk>
}

export interface FindDocumentChunksInput {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly chunkingVersion: string
}

const DocumentChunkRow = Schema.Struct({
  id: DocumentChunkId,
  document_id: DocumentId,
  source_version_id: SourceVersionId,
  chunking_version: Schema.String.pipe(Schema.minLength(1)),
  ordinal: Schema.Union(Schema.Number, Schema.NumberFromString),
  text: Schema.String.pipe(Schema.minLength(1)),
  text_hash: Schema.String.pipe(Schema.minLength(1)),
  page: Schema.NullOr(Schema.Union(Schema.Number, Schema.NumberFromString)),
  section: Schema.NullOr(Schema.String),
  paragraph: Schema.NullOr(
    Schema.Union(Schema.Number, Schema.NumberFromString),
  ),
  char_start: Schema.Union(Schema.Number, Schema.NumberFromString),
  char_end: Schema.Union(Schema.Number, Schema.NumberFromString),
  byte_start: Schema.Union(Schema.Number, Schema.NumberFromString),
  byte_end: Schema.Union(Schema.Number, Schema.NumberFromString),
  created_at: Schema.DateFromSelf,
})

const encoder = new TextEncoder()

function invalid(
  field: string,
  reason: 'aggregate-mismatch' | 'immutable-conflict',
  message: string,
): DocumentChunkValidationError {
  return new DocumentChunkValidationError({ field, reason, message })
}

function validateAggregate(
  input: StoreDocumentChunksInput,
): DocumentChunkValidationError | undefined {
  if (
    input.job.entityType !== 'ingestion'
    || input.job.status !== 'in-progress'
    || input.job.workspaceId !== input.workspaceId
    || input.job.entityId !== input.sourceId
  ) {
    return invalid(
      'job',
      'aggregate-mismatch',
      'The ingestion lease does not match the document tenant and source',
    )
  }
  if (input.chunks.length === 0) {
    return invalid(
      'chunks',
      'aggregate-mismatch',
      'A normalized document must have at least one chunk',
    )
  }
  const chunkingVersion = input.chunks[0]?.chunkingVersion
  let previousChunk: DocumentChunk | undefined
  for (const [ordinal, chunk] of input.chunks.entries()) {
    const sourceSlice = input.document.normalizedText.slice(
      chunk.locator.charStart,
      chunk.locator.charEnd,
    )
    if (
      chunk.documentId !== input.document.id
      || chunk.sourceVersionId !== input.document.sourceVersionId
      || chunk.chunkingVersion !== chunkingVersion
      || chunk.ordinal !== ordinal
      || chunk.id !== makeDocumentChunkId(
        input.document.id,
        chunk.chunkingVersion,
        chunk.ordinal,
      )
      || chunk.textHash !== hashDocumentChunkText(chunk.text)
      || !Number.isSafeInteger(chunk.locator.charStart)
      || !Number.isSafeInteger(chunk.locator.charEnd)
      || !Number.isSafeInteger(chunk.locator.byteStart)
      || !Number.isSafeInteger(chunk.locator.byteEnd)
      || (
        chunk.locator.page !== null
        && (
          !Number.isSafeInteger(chunk.locator.page)
          || chunk.locator.page <= 0
        )
      )
      || (
        chunk.locator.paragraph !== null
        && (
          !Number.isSafeInteger(chunk.locator.paragraph)
          || chunk.locator.paragraph <= 0
        )
      )
      || (
        chunk.locator.section !== null
        && chunk.locator.section.length === 0
      )
      || chunk.locator.charStart < 0
      || chunk.locator.charEnd <= chunk.locator.charStart
      || chunk.locator.charEnd > input.document.normalizedText.length
      || chunk.locator.byteStart < 0
      || chunk.locator.byteEnd <= chunk.locator.byteStart
      || (
        previousChunk !== undefined
        && chunk.locator.charStart < previousChunk.locator.charEnd
      )
      || chunk.text !== sourceSlice
    ) {
      return invalid(
        `chunks[${ordinal}]`,
        'aggregate-mismatch',
        'Chunks must be contiguous in ordinal identity and round-trip their document locators',
      )
    }
    const byteStart = previousChunk === undefined
      ? encoder.encode(
        input.document.normalizedText.slice(0, chunk.locator.charStart),
      ).byteLength
      : previousChunk.locator.byteEnd + encoder.encode(
        input.document.normalizedText.slice(
          previousChunk.locator.charEnd,
          chunk.locator.charStart,
        ),
      ).byteLength
    const byteEnd = byteStart + encoder.encode(sourceSlice).byteLength
    if (
      chunk.locator.byteStart !== byteStart
      || chunk.locator.byteEnd !== byteEnd
    ) {
      return invalid(
        `chunks[${ordinal}]`,
        'aggregate-mismatch',
        'Chunks must be contiguous in ordinal identity and round-trip their document locators',
      )
    }
    previousChunk = chunk
  }
  return undefined
}

function sameDocument(
  row: Readonly<Record<string, unknown>>,
  input: StoreDocumentChunksInput,
): boolean {
  return (
    row['id'] === input.document.id
    && row['workspace_id'] === input.workspaceId
    && row['project_id'] === input.projectId
    && row['source_id'] === input.sourceId
    && row['source_version_id'] === input.document.sourceVersionId
    && row['format'] === input.document.format
    && row['normalized_text'] === input.document.normalizedText
    && row['content_hash'] === input.document.contentHash
    && row['parser_version'] === input.document.parserVersion
    && row['created_at'] instanceof Date
    && row['created_at'].getTime() === Number(input.document.createdAt)
  )
}

function sameChunk(
  row: Readonly<Record<string, unknown>>,
  chunk: DocumentChunk,
): boolean {
  return (
    row['id'] === chunk.id
    && row['document_id'] === chunk.documentId
    && row['source_version_id'] === chunk.sourceVersionId
    && row['chunking_version'] === chunk.chunkingVersion
    && Number(row['ordinal']) === chunk.ordinal
    && row['text'] === chunk.text
    && row['text_hash'] === chunk.textHash
    && (row['page'] === null ? null : Number(row['page'])) === chunk.locator.page
    && row['section'] === chunk.locator.section
    && (row['paragraph'] === null ? null : Number(row['paragraph']))
      === chunk.locator.paragraph
    && Number(row['char_start']) === chunk.locator.charStart
    && Number(row['char_end']) === chunk.locator.charEnd
    && Number(row['byte_start']) === chunk.locator.byteStart
    && Number(row['byte_end']) === chunk.locator.byteEnd
    && row['created_at'] instanceof Date
    && row['created_at'].getTime() === Number(chunk.createdAt)
  )
}

function decodeChunk(
  row: unknown,
): Effect.Effect<DocumentChunk, QueryError> {
  return Schema.decodeUnknown(DocumentChunkRow)(row).pipe(
    Effect.map((decoded) => ({
      id: decoded.id,
      documentId: decoded.document_id,
      sourceVersionId: decoded.source_version_id,
      chunkingVersion: decoded.chunking_version,
      ordinal: decoded.ordinal,
      text: decoded.text,
      textHash: decoded.text_hash,
      locator: {
        page: decoded.page,
        section: decoded.section,
        paragraph: decoded.paragraph,
        charStart: decoded.char_start,
        charEnd: decoded.char_end,
        byteStart: decoded.byte_start,
        byteEnd: decoded.byte_end,
      },
      createdAt: BigInt(decoded.created_at.getTime()),
    })),
    Effect.flatMap((chunk) =>
      Schema.decodeUnknown(Schema.typeSchema(DocumentChunk))(chunk)
    ),
    Effect.mapError(() =>
      new QueryError({
        operation: 'decodeDocumentChunk',
        entity: 'DocumentChunk',
        message: 'Document chunk row could not be decoded',
      }),
    ),
  )
}

export class DocumentChunkRepo extends Effect.Service<DocumentChunkRepo>()(
  'DocumentChunkRepo',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const storeForIngestionAttempt = Effect.fn(
        'DocumentChunkRepo.storeForIngestionAttempt',
      )(function* (input: StoreDocumentChunksInput) {
        const aggregateError = validateAggregate(input)
        if (aggregateError !== undefined) return yield* aggregateError

        yield* Effect.tryPromise({
          try: () =>
            sql.transaction(async (transaction) => {
              const ownership = await transaction.unsafe(
                `UPDATE job_queue AS job
                 SET updated_at = NOW()
                 FROM source_versions AS version
                 JOIN sources AS source ON source.id = version.source_id
                 JOIN projects AS project ON project.id = source.project_id
                 WHERE job.id = $1
                   AND job.entity_type = 'ingestion'
                   AND job.entity_id = $2
                   AND job.workspace_id = $3
                   AND job.status = 'in-progress'
                   AND job.attempts = $4
                   AND version.id = $5
                   AND source.id = $2
                   AND project.id = $6
                   AND project.workspace_id = $3
                 RETURNING job.id`,
                [
                  input.job.id,
                  input.sourceId,
                  input.workspaceId,
                  input.job.attempts,
                  input.document.sourceVersionId,
                  input.projectId,
                ],
              )
              if (ownership.length !== 1) {
                throw new IngestionJobOwnershipLostError({
                  jobId: input.job.id,
                  attempt: input.job.attempts,
                  transition: 'store-document-chunks',
                  message: 'Ingestion attempt no longer owns the document chunk write',
                })
              }

              await transaction.unsafe(
                `INSERT INTO documents (
                   id, workspace_id, project_id, source_id, source_version_id,
                   format, normalized_text, content_hash, parser_version, created_at
                 )
                 VALUES (
                   $1, $2, $3, $4, $5, $6, $7, $8, $9,
                   to_timestamp($10 / 1000.0)
                 )
                 ON CONFLICT (source_version_id) DO NOTHING`,
                [
                  input.document.id,
                  input.workspaceId,
                  input.projectId,
                  input.sourceId,
                  input.document.sourceVersionId,
                  input.document.format,
                  input.document.normalizedText,
                  input.document.contentHash,
                  input.document.parserVersion,
                  Number(input.document.createdAt),
                ],
              )
              const documents = await transaction.unsafe(
                `SELECT id, workspace_id, project_id, source_id,
                        source_version_id, format, normalized_text,
                        content_hash, parser_version, created_at
                 FROM documents
                 WHERE source_version_id = $1
                 FOR SHARE`,
                [input.document.sourceVersionId],
              )
              if (
                documents.length !== 1
                || !sameDocument(documents[0] ?? {}, input)
              ) {
                throw invalid(
                  'document',
                  'immutable-conflict',
                  'The source version already has different normalized document content',
                )
              }

              for (const chunk of input.chunks) {
                await transaction.unsafe(
                  `INSERT INTO document_chunks (
                     id, document_id, workspace_id, project_id, source_id,
                     source_version_id, chunking_version, ordinal, text,
                     text_hash, page, section, paragraph, char_start, char_end,
                     byte_start, byte_end, created_at
                   )
                   VALUES (
                     $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                     $13, $14, $15, $16, $17, to_timestamp($18 / 1000.0)
                   )
                   ON CONFLICT (document_id, chunking_version, ordinal)
                   DO NOTHING`,
                  [
                    chunk.id,
                    chunk.documentId,
                    input.workspaceId,
                    input.projectId,
                    input.sourceId,
                    chunk.sourceVersionId,
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
              const stored = await transaction.unsafe(
                `SELECT id, document_id, source_version_id, chunking_version,
                        ordinal, text, text_hash, page, section, paragraph,
                        char_start, char_end, byte_start, byte_end, created_at
                 FROM document_chunks
                 WHERE document_id = $1 AND chunking_version = $2
                 ORDER BY ordinal ASC`,
                [input.document.id, input.chunks[0]?.chunkingVersion],
              )
              if (
                stored.length !== input.chunks.length
                || stored.some((row, index) =>
                  !sameChunk(row, input.chunks[index] as DocumentChunk)
                )
              ) {
                throw invalid(
                  'chunks',
                  'immutable-conflict',
                  'The chunking version already has different immutable chunks',
                )
              }
            }),
          catch: (cause) =>
            cause instanceof IngestionJobOwnershipLostError
            || cause instanceof DocumentChunkValidationError
              ? cause
              : new QueryError({
                  operation: 'storeForIngestionAttempt',
                  entity: 'DocumentChunk',
                  message: 'Atomic document chunk storage failed',
                  cause: String(cause),
                }),
        })
        return input.chunks
      })

      const findBySourceVersion = Effect.fn(
        'DocumentChunkRepo.findBySourceVersion',
      )(function* (input: FindDocumentChunksInput) {
        const rows = yield* Effect.tryPromise({
          try: () =>
            sql.unsafe(
              `SELECT chunk.id, chunk.document_id, chunk.source_version_id,
                      chunk.chunking_version, chunk.ordinal, chunk.text,
                      chunk.text_hash, chunk.page, chunk.section,
                      chunk.paragraph, chunk.char_start, chunk.char_end,
                      chunk.byte_start, chunk.byte_end, chunk.created_at
               FROM document_chunks AS chunk
               JOIN documents AS document ON document.id = chunk.document_id
               WHERE document.workspace_id = $1
                 AND chunk.source_version_id = $2
                 AND chunk.chunking_version = $3
               ORDER BY chunk.ordinal ASC`,
              [
                input.workspaceId,
                input.sourceVersionId,
                input.chunkingVersion,
              ],
            ),
          catch: (cause) =>
            new QueryError({
              operation: 'findBySourceVersion',
              entity: 'DocumentChunk',
              message: 'Document chunks could not be loaded',
              cause: String(cause),
            }),
        })
        return yield* Effect.forEach(rows, decodeChunk)
      })

      return { storeForIngestionAttempt, findBySourceVersion }
    }),
  },
) {}

export type DocumentChunkRepoError =
  | QueryError
  | IngestionJobOwnershipLostError
  | DocumentChunkValidationError

export { DocumentLocator }
