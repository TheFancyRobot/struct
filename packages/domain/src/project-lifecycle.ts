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

function isCanonicalProjectName(value: string): boolean {
  return value.length > 0
    && value.length <= MAX_PROJECT_NAME_CHARACTERS
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

export const ProjectListCursor = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(512),
)
export type ProjectListCursor = Schema.Schema.Type<typeof ProjectListCursor>

export const ProjectListPage = Schema.Struct({
  items: Schema.Array(ProjectSummary).pipe(Schema.maxItems(MAX_PROJECT_PAGE_SIZE)),
  nextCursor: Schema.NullOr(ProjectListCursor),
})
export type ProjectListPage = Schema.Schema.Type<typeof ProjectListPage>

export const CreateProjectRequest = Schema.Struct({
  name: ProjectNameInput,
})
export type CreateProjectRequest = Schema.Schema.Type<typeof CreateProjectRequest>
