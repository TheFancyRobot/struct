import { normalizeProjectName } from '@struct/domain'

const PENDING_PROJECT_CREATE_STORAGE_KEY = 'struct:pending-project-create'

export interface PendingProjectCreateState {
  readonly name: string
  readonly idempotencyKey: string
}

function isPendingProjectCreateState(value: unknown): value is PendingProjectCreateState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate['name'] === 'string'
    && typeof candidate['idempotencyKey'] === 'string'
    && candidate['name'].length > 0
    && candidate['idempotencyKey'].length > 0
}

export function readPendingProjectCreateState(storage: Pick<Storage, 'getItem'>): PendingProjectCreateState | null {
  const raw = storage.getItem(PENDING_PROJECT_CREATE_STORAGE_KEY)
  if (raw === null) return null

  try {
    const parsed = JSON.parse(raw)
    if (!isPendingProjectCreateState(parsed)) return null
    return {
      name: normalizeProjectName(parsed.name),
      idempotencyKey: parsed.idempotencyKey,
    }
  } catch {
    return null
  }
}

export function rememberPendingProjectCreate(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  name: string,
  createIdempotencyKey: () => string,
): string {
  const normalized = normalizeProjectName(name)
  const existing = readPendingProjectCreateState(storage)
  if (existing?.name === normalized) return existing.idempotencyKey

  const next = {
    name: normalized,
    idempotencyKey: createIdempotencyKey(),
  } satisfies PendingProjectCreateState
  storage.setItem(PENDING_PROJECT_CREATE_STORAGE_KEY, JSON.stringify(next))
  return next.idempotencyKey
}

export function clearPendingProjectCreate(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(PENDING_PROJECT_CREATE_STORAGE_KEY)
}
