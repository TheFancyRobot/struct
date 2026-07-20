// eslint-disable-next-line no-unused-vars -- Type-only import is consumed by TypeScript.
import type { RecursiveRunProgress } from '@struct/domain'

export function mergeRecursiveRead(
  current: RecursiveRunProgress | null,
  loaded: RecursiveRunProgress | null,
): RecursiveRunProgress | null {
  if (loaded === null) return current
  if (current === null) return loaded
  if (
    current.workspaceId !== loaded.workspaceId
    || current.requestId !== loaded.requestId
    || current.planId !== loaded.planId
  ) return current
  return loaded.updatedAt >= current.updatedAt ? loaded : current
}
