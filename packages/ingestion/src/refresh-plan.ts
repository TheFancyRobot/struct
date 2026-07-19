import {
  type DirectoryRelativePath,
  type ManifestEntryId,
} from '@struct/domain'
import { Option, Schema } from 'effect'

export const RefreshDisposition = Schema.Literal(
  'unchanged',
  'added',
  'modified',
  'removed',
  'unsupported',
)
export type RefreshDisposition = Schema.Schema.Type<typeof RefreshDisposition>

export interface RefreshPlanItem {
  readonly relativePath: DirectoryRelativePath
  readonly disposition: RefreshDisposition
  readonly previousEntryId: Option.Option<ManifestEntryId>
  readonly currentEntryId: Option.Option<ManifestEntryId>
}

export interface RefreshEntry {
  readonly id: ManifestEntryId
  readonly relativePath: DirectoryRelativePath
  readonly status: 'included' | 'unsupported'
  readonly contentHash: string | null
}

function classify(
  previous: RefreshEntry | undefined,
  current: RefreshEntry | undefined,
): RefreshDisposition {
  if (current === undefined) return 'removed'
  if (current.status === 'unsupported') return 'unsupported'
  if (previous === undefined) return 'added'
  if (
    previous.status === 'included'
    && previous.contentHash === current.contentHash
  ) {
    return 'unchanged'
  }
  return 'modified'
}

/**
 * Classifies two already-validated manifests by canonical path. Output order
 * is independent of discovery enumeration order.
 */
export function buildRefreshPlan(
  previousEntries: ReadonlyArray<RefreshEntry>,
  currentEntries: ReadonlyArray<RefreshEntry>,
): ReadonlyArray<RefreshPlanItem> {
  const previousByPath = new Map(
    previousEntries.map((entry) => [entry.relativePath, entry]),
  )
  const currentByPath = new Map(
    currentEntries.map((entry) => [entry.relativePath, entry]),
  )
  const paths = Array.from(new Set([
    ...previousByPath.keys(),
    ...currentByPath.keys(),
  ])).sort()

  return paths.map((relativePath) => {
    const previous = previousByPath.get(relativePath)
    const current = currentByPath.get(relativePath)
    return {
      relativePath,
      disposition: classify(previous, current),
      previousEntryId: Option.fromNullable(previous?.id),
      currentEntryId: Option.fromNullable(current?.id),
    }
  })
}
