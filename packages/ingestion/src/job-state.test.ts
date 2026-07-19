import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { applyDirectoryIngestionTransition } from './job-state.js'

describe('directory ingestion job state', () => {
  it('preserves the attempt budget across a valid pause', async () => {
    expect(await Effect.runPromise(applyDirectoryIngestionTransition({
      status: 'running',
      attempts: 2,
      maxAttempts: 3,
    }, 'pause'))).toEqual({
      status: 'paused',
      attempts: 2,
      maxAttempts: 3,
    })
  })

  it('rejects retry once the attempt budget is exhausted', async () => {
    const exit = await Effect.runPromiseExit(applyDirectoryIngestionTransition({
      status: 'exhausted',
      attempts: 3,
      maxAttempts: 3,
    }, 'retry'))
    expect(exit._tag).toBe('Failure')
  })
})
