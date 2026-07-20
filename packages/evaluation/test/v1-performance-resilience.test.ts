import { describe, expect, it } from 'bun:test'
import {
  buildV1PerformanceResilienceReport,
  checkV1PerformanceResilienceReport,
} from '../src/v1-performance-resilience'

describe('v1 performance and resilience gate', () => {
  it('keeps every reference workload inside its budget', async () => {
    const report = await buildV1PerformanceResilienceReport()
    expect(report.status).toBe('passed')
    expect(report.workloads).toHaveLength(7)
    for (const workload of report.workloads) {
      expect(workload.observedMilliseconds).toBeLessThanOrEqual(
        workload.maximumMilliseconds,
      )
    }
  })

  it('covers every required fault with one bounded terminal disposition', async () => {
    const report = await buildV1PerformanceResilienceReport()
    expect(report.resilience.map(({ id }) => id)).toEqual([
      'postgresql-interruption',
      'data-engine-restart',
      'worker-replacement',
      'provider-timeout',
      'cancellation',
      'retry-exhaustion',
      'checkpoint-resume',
      'sse-reconnect',
      'sse-backpressure',
    ])
    expect(report.resilience.every((item) =>
      item.terminal.length > 0
      && item.duplicateDurableEffects === 0
      && /^[0-9a-f]{64}$/.test(item.evidenceSha256))).toBe(true)
  })

  it('matches the checked-in canonical report and source evidence hashes', async () => {
    await expect(checkV1PerformanceResilienceReport()).resolves.toBeUndefined()
  })
})
