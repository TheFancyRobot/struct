import { describe, expect, it } from 'bun:test'
import {
  clearPendingProjectCreate,
  readPendingProjectCreateState,
  rememberPendingProjectCreate,
} from './project-create-state'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

describe('pending project create state', () => {
  it('reuses the same key for retries of the same normalized project name', () => {
    const storage = memoryStorage()

    const first = rememberPendingProjectCreate(storage, '  Cafe\u0301 roadmap  ', () => 'project:create:first')
    const second = rememberPendingProjectCreate(storage, 'Café roadmap', () => 'project:create:second')

    expect(first).toBe('project:create:first')
    expect(second).toBe('project:create:first')
    expect(readPendingProjectCreateState(storage)).toEqual({
      name: 'Café roadmap',
      idempotencyKey: 'project:create:first',
    })
  })

  it('rotates the key only after a definitive clear or a different project name', () => {
    const storage = memoryStorage()

    rememberPendingProjectCreate(storage, 'Alpha', () => 'project:create:alpha')
    expect(rememberPendingProjectCreate(storage, 'Beta', () => 'project:create:beta')).toBe(
      'project:create:beta',
    )

    clearPendingProjectCreate(storage)
    expect(rememberPendingProjectCreate(storage, 'Beta', () => 'project:create:beta:next')).toBe(
      'project:create:beta:next',
    )
  })
})
