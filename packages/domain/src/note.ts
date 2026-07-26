import { Schema } from 'effect'
import {
  CitationId,
  DatasetCitationId,
  DatasetSnapshotId,
  EventJournalId,
  NoteId,
  ProjectId,
  QueryResultSnapshotId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'

const SafeText = Schema.String.pipe(Schema.filter((value) =>
  ![...value].some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code <= 8 || code === 11 || code === 12
      || (code >= 14 && code <= 31) || code === 127
  }) || 'note text contains unsupported control characters'))
const Title = SafeText.pipe(Schema.minLength(1), Schema.maxLength(200))
const Body = SafeText.pipe(
  Schema.minLength(1),
  Schema.filter((value) =>
    new TextEncoder().encode(value).byteLength <= 262_144
      || 'note body exceeds 262144 UTF-8 bytes'),
)
const Digest = Schema.String.pipe(Schema.pattern(/^sha256:[0-9a-f]{64}$/))
export const DEFAULT_NOTE_PAGE_SIZE = 25
export const MAX_NOTE_PAGE_SIZE = 50

export const NoteCitation = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('document'),
    id: CitationId,
    sourceVersionId: SourceVersionId,
    locator: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(8_192)),
  }),
  Schema.Struct({
    kind: Schema.Literal('dataset'),
    id: DatasetCitationId,
    queryResultSnapshotId: QueryResultSnapshotId,
    datasetSnapshotId: DatasetSnapshotId,
  }),
)
export type NoteCitation = Schema.Schema.Type<typeof NoteCitation>

export const NoteOrigin = Schema.Struct({
  threadId: ResearchThreadId,
  runId: ResearchRunId,
  answerId: EventJournalId,
  citations: Schema.Array(NoteCitation).pipe(Schema.minItems(1), Schema.maxItems(80)),
})
export type NoteOrigin = Schema.Schema.Type<typeof NoteOrigin>

export const NoteRevision = Schema.Struct({
  revision: Schema.Number.pipe(Schema.int(), Schema.positive()),
  title: Title,
  body: Body,
  authorId: WorkspaceId,
  contentHash: Digest,
  createdAt: Schema.BigIntFromNumber,
})
export type NoteRevision = Schema.Schema.Type<typeof NoteRevision>

export const Note = Schema.Struct({
  id: NoteId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  authorId: WorkspaceId,
  origin: NoteOrigin,
  current: NoteRevision,
  archived: Schema.Boolean,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})
export type Note = Schema.Schema.Type<typeof Note>

const NoteListCursorEnvelope = Schema.Struct({
  updatedAt: Schema.NumberFromString.pipe(
    Schema.int(),
    Schema.nonNegative(),
  ),
  id: NoteId,
})

function decodeNoteListCursorValue(value: string) {
  const separator = value.indexOf(':')
  return Schema.decodeUnknownSync(NoteListCursorEnvelope)({
    updatedAt: value.slice(0, separator),
    id: value.slice(separator + 1),
  })
}

export const NoteListCursor = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(80),
  Schema.filter((value) => {
    try {
      const decoded = decodeNoteListCursorValue(value)
      return `${decoded.updatedAt}:${decoded.id}` === value
        || 'must be a canonical note list cursor'
    } catch {
      return 'must be a canonical note list cursor'
    }
  }),
)
export type NoteListCursor = Schema.Schema.Type<typeof NoteListCursor>

export function decodeNoteListCursor(value: NoteListCursor) {
  return decodeNoteListCursorValue(value)
}

export function encodeNoteListCursor(note: Note): NoteListCursor {
  return `${note.updatedAt}:${note.id}` as NoteListCursor
}

export const NoteListPage = Schema.Struct({
  items: Schema.Array(Note).pipe(Schema.maxItems(MAX_NOTE_PAGE_SIZE)),
  nextCursor: Schema.NullOr(NoteListCursor),
})
export type NoteListPage = Schema.Schema.Type<typeof NoteListPage>

export const NoteRevisionPage = Schema.Struct({
  items: Schema.Array(NoteRevision).pipe(Schema.maxItems(MAX_NOTE_PAGE_SIZE)),
  nextCursor: Schema.NullOr(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type NoteRevisionPage = Schema.Schema.Type<typeof NoteRevisionPage>

export const CreateNoteRequest = Schema.Struct({
  title: Title,
  body: Body,
  origin: NoteOrigin,
})
export type CreateNoteRequest = Schema.Schema.Type<typeof CreateNoteRequest>

export const UpdateNoteRequest = Schema.Struct({
  title: Title,
  body: Body,
  expectedRevision: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type UpdateNoteRequest = Schema.Schema.Type<typeof UpdateNoteRequest>

export const ArchiveNoteRequest = Schema.Struct({
  archived: Schema.Boolean,
  expectedRevision: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type ArchiveNoteRequest = Schema.Schema.Type<typeof ArchiveNoteRequest>

export function normalizeNoteText(value: string): string {
  return value.normalize('NFC').trim()
}
