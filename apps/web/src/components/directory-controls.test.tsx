/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel's parser does not mark Solid JSX component and type imports as used. */
import { describe, expect, it } from 'bun:test'
import { createRoot } from 'solid-js'
import { renderToString } from 'solid-js/web'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  EventJournalId,
  JobQueueId,
  ManifestEntryId,
  ProjectId,
  SourceId,
  WorkspaceId,
  type DirectoryProgressEvent,
  type DirectoryStatusProjection,
} from '@struct/domain'
import { DirectoryRelativePath } from '@struct/domain'
import {
  createDirectoryProgressState,
} from './DirectoryControlPanel'
import { DirectoryBrowser } from './DirectoryBrowser'
import {
  IngestionJobStatus,
  directoryViewState,
  type DirectoryViewState,
} from './IngestionJobStatus'
import {
  SourceControls,
  availableDirectoryControls,
} from './SourceControls'

function status(
  value: DirectoryStatusProjection['status'] = 'running',
  overrides: Partial<DirectoryStatusProjection> = {},
): DirectoryStatusProjection {
  return {
    jobId: JobQueueId.make('e20e8400-e29b-41d4-a716-446655440001'),
    workspaceId: WorkspaceId.make('e20e8400-e29b-41d4-a716-446655440002'),
    projectId: ProjectId.make('e20e8400-e29b-41d4-a716-446655440003'),
    sourceId: SourceId.make('e20e8400-e29b-41d4-a716-446655440004'),
    directoryRootId: DirectoryRootId.make('e20e8400-e29b-41d4-a716-446655440005'),
    snapshotId: DirectorySnapshotId.make('e20e8400-e29b-41d4-a716-446655440006'),
    name: 'Research notes',
    status: value,
    attempts: 1,
    maxAttempts: 3,
    counts: {
      total: 4,
      processed: 2,
      succeeded: 1,
      failed: 1,
      unsupported: 1,
      pending: 1,
    },
    failures: [{
      entryId: ManifestEntryId.make('e20e8400-e29b-41d4-a716-446655440007'),
      relativePath: DirectoryRelativePath.make('private/locked.md'),
      errorTag: 'DirectoryPermissionError',
    }],
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('directory status Solid components', () => {
  it('renders all required states through the persisted-state mapping', () => {
    const cases: ReadonlyArray<{
      readonly expected: DirectoryViewState
      readonly input: Parameters<typeof directoryViewState>[0]
    }> = [
      { expected: 'registering', input: { status: null, registering: true, reconnecting: false } },
      { expected: 'scanning', input: { status: status('ready', { attempts: 0, counts: { total: 0, processed: 0, succeeded: 0, failed: 0, unsupported: 0, pending: 0 }, failures: [] }), registering: false, reconnecting: false } },
      { expected: 'processing', input: { status: status('running', { counts: { total: 4, processed: 1, succeeded: 1, failed: 0, unsupported: 1, pending: 2 }, failures: [] }), registering: false, reconnecting: false } },
      { expected: 'paused', input: { status: status('paused'), registering: false, reconnecting: false } },
      { expected: 'partial-failure', input: { status: status('running'), registering: false, reconnecting: false } },
      { expected: 'retrying', input: { status: status('ready', { counts: { total: 4, processed: 1, succeeded: 1, failed: 0, unsupported: 1, pending: 2 }, failures: [] }), registering: false, reconnecting: false, lastEventType: 'directory-retried' } },
      { expected: 'cancelled', input: { status: status('cancelled'), registering: false, reconnecting: false } },
      { expected: 'completed', input: { status: status('completed'), registering: false, reconnecting: false } },
      { expected: 'reconnect-replay', input: { status: status(), registering: false, reconnecting: true } },
    ]
    for (const testCase of cases) {
      expect(directoryViewState(testCase.input)).toBe(testCase.expected)
      expect(renderToString(() => (
        <IngestionJobStatus {...testCase.input} />
      ))).toContain(`data-state="${testCase.expected}"`)
    }
  })

  it('renders honest aggregate and per-entry failure details', () => {
    const html = renderToString(() => <DirectoryBrowser status={status()} />)
    expect(html).toContain('Total')
    expect(html).toContain('Processed')
    expect(html).toContain('private/locked.md')
    expect(html).toContain('DirectoryPermissionError')
  })

  it('enables controls only for valid persisted transitions', () => {
    expect([...availableDirectoryControls(status('running'))]).toEqual([
      'pause',
      'cancel',
    ])
    expect([...availableDirectoryControls(status('paused'))]).toEqual([
      'resume',
      'cancel',
    ])
    expect([...availableDirectoryControls(status('cancelled'))]).toEqual([
      'retry',
    ])
    expect([...availableDirectoryControls(status('completed'))]).toEqual([])
    const html = renderToString(() => (
      <SourceControls
        status={status('completed')}
        onCommand={() => undefined}
      />
    ))
    expect(html.match(/disabled/g)).toHaveLength(4)
  })

  it('deduplicates reconnect replay by cursor without losing terminal state', () => {
    createRoot((dispose) => {
      const progress = createDirectoryProgressState(status('running'))
      const completed = status('completed', {
        counts: {
          total: 4,
          processed: 3,
          succeeded: 3,
          failed: 0,
          unsupported: 1,
          pending: 0,
        },
        failures: [],
      })
      const event: DirectoryProgressEvent = {
        id: EventJournalId.make('e20e8400-e29b-41d4-a716-446655440008'),
        cursor: '42',
        type: 'directory-completed',
        jobId: completed.jobId,
        createdAt: completed.updatedAt,
        status: completed,
      }
      progress.apply(event)
      progress.apply({ ...event, status: status('running') })
      expect(progress.status().status).toBe('completed')
      expect(progress.lastEventType()).toBe('directory-completed')
      dispose()
    })
  })
})
