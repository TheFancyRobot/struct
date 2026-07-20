import { describe, expect, it } from 'bun:test'
import {
  recoveryReturnArtifactRoot,
  runRecoveryCleanupSteps,
  runWithRecoveryCleanup,
} from './recovery-proof'

describe('recovery proof cleanup', () => {
  it('returns Compose to the paired non-test artifact root', () => {
    expect(recoveryReturnArtifactRoot('.local/artifacts_recovery_test'))
      .toBe('.local/artifacts')
    expect(recoveryReturnArtifactRoot('/srv/struct/objects_recovery_test'))
      .toBe('/srv/struct/objects')
  })

  it('rejects an artifact root without the isolated test suffix', () => {
    expect(() => recoveryReturnArtifactRoot('.local/artifacts'))
      .toThrow('must end in _recovery_test')
  })

  it('runs cleanup after a successful proof', async () => {
    const calls: string[] = []
    await runWithRecoveryCleanup(
      async () => { calls.push('proof') },
      async () => { calls.push('cleanup') },
    )
    expect(calls).toEqual(['proof', 'cleanup'])
  })

  it('runs cleanup after a mid-proof failure and preserves that failure', async () => {
    const calls: string[] = []
    const failure = new Error('injected mid-proof failure')
    await expect(runWithRecoveryCleanup(
      async () => {
        calls.push('proof')
        throw failure
      },
      async () => { calls.push('cleanup') },
    )).rejects.toBe(failure)
    expect(calls).toEqual(['proof', 'cleanup'])
  })

  it('reports proof and cleanup failures together', async () => {
    const proofFailure = new Error('proof failure')
    const cleanupFailure = new Error('cleanup failure')
    await expect(runWithRecoveryCleanup(
      async () => { throw proofFailure },
      async () => { throw cleanupFailure },
    )).rejects.toEqual(new AggregateError(
      [proofFailure, cleanupFailure],
      'Recovery proof and recovery cleanup both failed',
    ))
  })

  it('continues later cleanup steps after an earlier cleanup failure', async () => {
    const calls: string[] = []
    const failure = new Error('close failure')
    await expect(runRecoveryCleanupSteps([
      async () => {
        calls.push('close')
        throw failure
      },
      async () => { calls.push('restore-stack') },
    ])).rejects.toBe(failure)
    expect(calls).toEqual(['close', 'restore-stack'])
  })
})
