export const MAX_STAGED_ARTIFACT_NAME_LENGTH = 255

const canonicalStagedArtifactRef =
  /^staged:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([a-z0-9._-]+)$/

/**
 * Recognizes the logical reference shape emitted by the staged artifact store.
 *
 * Staged names are lowercase ASCII after storage canonicalization and bounded
 * to the portable per-segment filesystem limit. Lowercasing prevents logical
 * aliases on case-insensitive filesystems. Dot traversal is rejected before a
 * logical reference can cross a persistence or worker boundary.
 */
export function isCanonicalStagedArtifactRef(
  value: unknown,
): value is `staged://${string}/${string}` {
  if (typeof value !== 'string') return false
  const match = canonicalStagedArtifactRef.exec(value)
  if (match === null || match[0] !== value) return false
  const name = match[2] ?? ''
  return name.length > 0
    && name.length <= MAX_STAGED_ARTIFACT_NAME_LENGTH
    && name !== '.'
    && name !== '..'
    && !name.includes('..')
}
