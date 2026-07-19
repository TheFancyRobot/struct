import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { ProjectId, WorkspaceId } from '@struct/domain'
import { decodeDirectoryRegistrationScope, registerDirectory } from './directories'

describe('directory registration route', () => {
  it('rejects invalid scope and path-like display names before persistence', async () => {
    expect((await Effect.runPromiseExit(
      decodeDirectoryRegistrationScope({
        workspaceId: 'not-a-uuid',
        projectId: 'not-a-uuid',
        name: 'notes',
      }),
    ))._tag).toBe('Failure')

    let persisted = false
    const exit = await Effect.runPromiseExit(registerDirectory({
      workspaceId: WorkspaceId.make('e30e8400-e29b-41d4-a716-446655440001'),
      projectId: ProjectId.make('e30e8400-e29b-41d4-a716-446655440002'),
      name: '../private',
    }, {
      randomSourceId: () => {
        throw new Error('not called')
      },
      randomDirectoryRootId: () => {
        throw new Error('not called')
      },
      randomSnapshotId: () => {
        throw new Error('not called')
      },
      randomJobId: () => {
        throw new Error('not called')
      },
      randomEventId: () => {
        throw new Error('not called')
      },
      register: () => {
        persisted = true
        return Effect.die('not called')
      },
    }))
    expect(exit._tag).toBe('Failure')
    expect(persisted).toBe(false)
  })
})
