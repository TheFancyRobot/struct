import { Schema } from 'effect'
import { ProjectId } from './branded-ids.js'

export const MAX_PROJECT_NAME_CHARACTERS = 120
export const DEFAULT_PROJECT_PAGE_SIZE = 25
export const MAX_PROJECT_PAGE_SIZE = 50

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined
      && (
        codePoint <= 31
        || (codePoint >= 127 && codePoint <= 159)
      )
  })
}

export function normalizeProjectName(value: string): string {
  return value.trim().normalize('NFC')
}

export function projectNameCharacterCount(value: string): number {
  return Array.from(value).length
}

function isCanonicalProjectName(value: string): boolean {
  return projectNameCharacterCount(value) > 0
    && projectNameCharacterCount(value) <= MAX_PROJECT_NAME_CHARACTERS
    && !hasControlCharacters(value)
}

export const ProjectName = Schema.String.pipe(
  Schema.filter((value) =>
    value === normalizeProjectName(value)
      || 'must be trimmed and Unicode NFC normalized'),
  Schema.filter((value) =>
    isCanonicalProjectName(value)
      || `must contain 1-${MAX_PROJECT_NAME_CHARACTERS} non-control characters`),
)
export type ProjectName = Schema.Schema.Type<typeof ProjectName>

export const ProjectNameInput = Schema.String.pipe(
  Schema.transform(ProjectName, {
    decode: (value) => normalizeProjectName(value),
    encode: (value) => value,
  }),
)
export type ProjectNameInput = Schema.Schema.Type<typeof ProjectNameInput>

export const ProjectSummary = Schema.Struct({
  id: ProjectId,
  name: ProjectName,
  createdAt: Schema.BigIntFromNumber,
  updatedAt: Schema.BigIntFromNumber,
})
export type ProjectSummary = Schema.Schema.Type<typeof ProjectSummary>

export const ProjectListCursorEnvelope = Schema.Struct({
  updatedAt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  nameFolded: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(MAX_PROJECT_NAME_CHARACTERS),
    Schema.filter((value) =>
      value === normalizeProjectName(value).toLocaleLowerCase('en-US')
        || 'must be a normalized lower-cased project name'),
    Schema.filter((value) =>
      !hasControlCharacters(value)
        || 'must not contain control characters'),
  ),
  id: ProjectId,
})
export type ProjectListCursorEnvelope = Schema.Schema.Type<typeof ProjectListCursorEnvelope>

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function encodeBase64UrlUtf8(value: string): string {
  let binary = ''
  for (const byte of utf8Encoder.encode(value)) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')
}

function decodeBase64UrlUtf8(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0
    ? ''
    : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(`${normalized}${padding}`)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return utf8Decoder.decode(bytes)
}

function encodeProjectListCursorValue(value: ProjectListCursorEnvelope): string {
  return encodeBase64UrlUtf8(JSON.stringify({
    updatedAt: value.updatedAt,
    nameFolded: value.nameFolded,
    id: value.id,
  } satisfies ProjectListCursorEnvelope))
}

export function decodeProjectListCursor(cursor: string): ProjectListCursorEnvelope {
  const decoded = JSON.parse(decodeBase64UrlUtf8(cursor))
  return Schema.decodeUnknownSync(ProjectListCursorEnvelope)(decoded)
}

function isCanonicalProjectListCursor(value: string): boolean {
  try {
    return encodeProjectListCursorValue(decodeProjectListCursor(value)) === value
  } catch {
    return false
  }
}

export const ProjectListCursor = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(512),
  Schema.filter((value) =>
    isCanonicalProjectListCursor(value)
      || 'must be a canonical project list cursor'),
)
export type ProjectListCursor = Schema.Schema.Type<typeof ProjectListCursor>

export function encodeProjectListCursor(value: ProjectListCursorEnvelope): ProjectListCursor {
  return encodeProjectListCursorValue(value) as ProjectListCursor
}

export const ProjectListPage = Schema.Struct({
  items: Schema.Array(ProjectSummary).pipe(Schema.maxItems(MAX_PROJECT_PAGE_SIZE)),
  nextCursor: Schema.NullOr(ProjectListCursor),
})
export type ProjectListPage = Schema.Schema.Type<typeof ProjectListPage>

export const CreateProjectRequest = Schema.Struct({
  name: ProjectNameInput,
})
export type CreateProjectRequest = Schema.Schema.Type<typeof CreateProjectRequest>
