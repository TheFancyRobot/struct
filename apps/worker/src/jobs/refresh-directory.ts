import { applyDirectoryRefresh } from '@struct/ingestion'

/**
 * Worker boundary for one already-claimed directory job. Lease ownership is
 * checked again by the atomic repository commit, so stale workers can stage a
 * reusable blob but cannot publish lineage or events.
 */
export const refreshClaimedDirectory: typeof applyDirectoryRefresh =
  applyDirectoryRefresh
