import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  DIRECTORY_REFRESH_FILE_COUNT,
  buildDirectoryRefreshFixture,
  directoryRefreshFailureBoundaries,
  evaluateDirectoryRefreshRecovery,
} from '../src/directory-refresh.js'

describe('Phase 03 directory refresh evaluation', () => {
  it('reproduces the fixed 1,000-file manifests and passes every recovery gate', async () => {
    const report = await Effect.runPromise(evaluateDirectoryRefreshRecovery())
    const expected = await Bun.file(
      new URL(
        '../results/phase-03-directory-refresh-evaluation.json',
        import.meta.url,
      ),
    ).json()

    expect(report).toEqual(expected)
    expect(report.passed).toBe(true)
    expect(report.resources.modelCalls).toBe(0)
    expect(report.recovery.map((result) => result.boundary)).toEqual(
      Array.from(directoryRefreshFailureBoundaries),
    )
  })

  it('keeps both generated snapshots at the fixed cap with stable digests', () => {
    const first = buildDirectoryRefreshFixture()
    const second = buildDirectoryRefreshFixture()

    expect(first.initial.entries).toHaveLength(DIRECTORY_REFRESH_FILE_COUNT)
    expect(first.refreshed.entries).toHaveLength(DIRECTORY_REFRESH_FILE_COUNT)
    expect(second.initial.digest).toBe(first.initial.digest)
    expect(second.refreshed.digest).toBe(first.refreshed.digest)
    expect(second.refreshed.entries).toEqual(first.refreshed.entries)
  })
})
