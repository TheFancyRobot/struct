import { Schema } from 'effect'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  ManifestEntryId,
  ProjectId,
  WorkspaceId,
} from './branded-ids.js'

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const Sha256Pattern = /^sha256:[0-9a-f]{64}$/

export const MAX_DIRECTORY_RELATIVE_PATH_BYTES = 4_096
export const MAX_DIRECTORY_PATH_SEGMENT_BYTES = 255

export const Sha256Digest = Schema.String.pipe(
  Schema.pattern(Sha256Pattern),
  Schema.brand('Sha256Digest'),
)
export type Sha256Digest = Schema.Schema.Type<typeof Sha256Digest>

function isCanonicalRelativePath(value: string): boolean {
  const encoder = new TextEncoder()
  const hasControlCharacter = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)
    return codePoint !== undefined
      && (
        codePoint <= 31
        || (codePoint >= 127 && codePoint <= 159)
      )
  })
  if (
    value.length === 0
    || value.normalize('NFC') !== value
    || hasControlCharacter
    || value.includes('\\')
    || value.startsWith('/')
    || value.endsWith('/')
    || /^[A-Za-z]:/.test(value)
    || encoder.encode(value).byteLength > MAX_DIRECTORY_RELATIVE_PATH_BYTES
  ) {
    return false
  }

  const segments = value.split('/')
  return segments.every((segment) =>
    segment.length > 0
    && segment !== '.'
    && segment !== '..'
    && encoder.encode(segment).byteLength <= MAX_DIRECTORY_PATH_SEGMENT_BYTES
  )
}

/**
 * A portable POSIX-style path relative to a registered directory root.
 * Decoding rejects absolute, escaping, non-normalized, and backslash paths.
 */
export const DirectoryRelativePath = Schema.String.pipe(
  Schema.filter((value) =>
    isCanonicalRelativePath(value)
      || 'must be a canonical POSIX path relative to the registered directory root'),
  Schema.brand('DirectoryRelativePath'),
)
export type DirectoryRelativePath = Schema.Schema.Type<typeof DirectoryRelativePath>

export const ManifestEntryStatus = Schema.Literal('included', 'unsupported')
export type ManifestEntryStatus = Schema.Schema.Type<typeof ManifestEntryStatus>

export const DirectoryRoot = Schema.Struct({
  id: DirectoryRootId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  createdAt: Schema.BigIntFromNumber,
})
export type DirectoryRoot = Schema.Schema.Type<typeof DirectoryRoot>

export const DirectorySnapshot = Schema.Struct({
  id: DirectorySnapshotId,
  directoryRootId: DirectoryRootId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  manifestDigest: Sha256Digest,
  createdAt: Schema.BigIntFromNumber,
})
export type DirectorySnapshot = Schema.Schema.Type<typeof DirectorySnapshot>

export const DirectoryManifestEntry = Schema.Struct({
  id: ManifestEntryId,
  snapshotId: DirectorySnapshotId,
  directoryRootId: DirectoryRootId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  relativePath: DirectoryRelativePath,
  status: ManifestEntryStatus,
  byteLength: NonNegativeInteger,
  contentHash: Schema.NullOr(Sha256Digest),
  unsupportedReason: Schema.NullOr(NonEmptyString),
}).pipe(
  Schema.filter((entry) => [
    entry.status === 'included' && entry.contentHash === null
      ? 'included entries require a content hash'
      : undefined,
    entry.status === 'included' && entry.unsupportedReason !== null
      ? 'included entries cannot carry an unsupported reason'
      : undefined,
    entry.status === 'unsupported' && entry.unsupportedReason === null
      ? 'unsupported entries require a reason'
      : undefined,
  ]),
)
export type DirectoryManifestEntry = Schema.Schema.Type<typeof DirectoryManifestEntry>

export function compareDirectoryRelativePaths(
  left: DirectoryRelativePath,
  right: DirectoryRelativePath,
): number {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const sharedLength = Math.min(leftBytes.length, rightBytes.length)

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }

  return leftBytes.length - rightBytes.length
}

export function orderManifestEntries(
  entries: ReadonlyArray<DirectoryManifestEntry>,
): ReadonlyArray<DirectoryManifestEntry> {
  return Array.from(entries).sort((left, right) =>
    compareDirectoryRelativePaths(left.relativePath, right.relativePath))
}

function digestField(value: string): string {
  return `${value.length}:${value}`
}

/**
 * Hashes only stable inventory facts. Entry and snapshot IDs are intentionally
 * excluded so identical directory content yields the same digest on retry.
 */
export function computeManifestDigest(
  entries: ReadonlyArray<DirectoryManifestEntry>,
): Sha256Digest {
  const canonical = orderManifestEntries(entries)
    .map((entry) => [
      digestField(entry.relativePath),
      digestField(entry.status),
      digestField(String(entry.byteLength)),
      digestField(entry.contentHash ?? ''),
      digestField(entry.unsupportedReason ?? ''),
    ].join(''))
    .join('')

  return Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256').update(canonical).digest('hex')}`,
  )
}

export const DirectoryManifest = Schema.Struct({
  snapshotId: DirectorySnapshotId,
  directoryRootId: DirectoryRootId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  digest: Sha256Digest,
  entries: Schema.Array(DirectoryManifestEntry),
}).pipe(
  Schema.filter((manifest) => {
    const ordered = orderManifestEntries(manifest.entries)
    const paths = new Set(ordered.map((entry) => entry.relativePath))
    return [
      paths.size === manifest.entries.length
        ? undefined
        : 'manifest paths must be unique',
      manifest.entries.every((entry, index) => entry === ordered[index])
        ? undefined
        : 'manifest entries must be ordered by canonical relative path',
      manifest.entries.every((entry) =>
        entry.snapshotId === manifest.snapshotId
        && entry.directoryRootId === manifest.directoryRootId
        && entry.workspaceId === manifest.workspaceId
        && entry.projectId === manifest.projectId)
        ? undefined
        : 'manifest entries must match the manifest snapshot and workspace/project scope',
      manifest.digest === computeManifestDigest(manifest.entries)
        ? undefined
        : 'manifest digest does not match its canonical entries',
    ]
  }),
)
export type DirectoryManifest = Schema.Schema.Type<typeof DirectoryManifest>
