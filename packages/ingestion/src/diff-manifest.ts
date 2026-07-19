import {
  compareDirectoryRelativePaths,
} from '@struct/domain'
import type * as Domain from '@struct/domain'
import { Option } from 'effect'

export type ManifestDiffDisposition =
  | 'added'
  | 'modified'
  | 'unchanged'
  | 'removed'
  | 'unsupported'

export interface ManifestDiffItem {
  readonly relativePath: Domain.DirectoryManifestEntry['relativePath']
  readonly disposition: ManifestDiffDisposition
  readonly previous: Option.Option<Domain.DirectoryManifestEntry>
  readonly current: Option.Option<Domain.DirectoryManifestEntry>
}

function disposition(
  previous: Domain.DirectoryManifestEntry | undefined,
  current: Domain.DirectoryManifestEntry | undefined,
): ManifestDiffDisposition {
  if (current === undefined) return 'removed'
  if (current.status === 'unsupported') return 'unsupported'
  if (previous === undefined) return 'added'
  return previous.status === 'included'
    && previous.contentHash === current.contentHash
    ? 'unchanged'
    : 'modified'
}

/**
 * Produces a deterministic path-based diff. A rename is deliberately not
 * inferred from equal content hashes because a digest is not stable identity.
 */
export function diffManifest(
  previous: Domain.DirectoryManifest | null,
  current: Domain.DirectoryManifest,
): ReadonlyArray<ManifestDiffItem> {
  const previousByPath = new Map(
    (previous?.entries ?? []).map((entry) => [entry.relativePath, entry]),
  )
  const currentByPath = new Map(
    current.entries.map((entry) => [entry.relativePath, entry]),
  )
  const paths = Array.from(new Set([
    ...previousByPath.keys(),
    ...currentByPath.keys(),
  ])).sort(compareDirectoryRelativePaths)

  return paths.map((relativePath) => {
    const previousEntry = previousByPath.get(relativePath)
    const currentEntry = currentByPath.get(relativePath)
    return {
      relativePath,
      disposition: disposition(previousEntry, currentEntry),
      previous: Option.fromNullable(previousEntry),
      current: Option.fromNullable(currentEntry),
    }
  })
}
