import { describe, expect, it } from 'bun:test'
import { campaignGates } from './v1-evaluation-campaign'

describe('v1 evaluation campaign inventory', () => {
  it('composes each authoritative capability and hardening gate once', () => {
    const ids = campaignGates.map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'environment-storage-readiness',
      'dependency-stack-readiness',
      'phase-02-document-retrieval-security',
      'phase-03-directory-ingestion-recovery',
      'phase-04-structured-data-full-corpus',
      'phase-05-bounded-planning-research',
      'phase-06-recursive-analysis',
      'phase-07-hybrid-research',
      'phase-08-report-provenance',
      'unit-resilience-matrix',
      'real-interruption-restart-replacement',
      'canonical-report',
      'unit-regression-suite',
      'postgresql-data-engine-integration',
      'deployment-recovery-proof',
      'production-build',
      'playwright-browser-readiness',
      'playwright-accessibility-responsive-ui',
      'typecheck',
      'lint',
      'import-boundaries',
      'documentation',
      'secret-scan',
    ])
    expect(campaignGates.every(({ maximumMilliseconds }) =>
      Number.isSafeInteger(maximumMilliseconds) && maximumMilliseconds > 0)).toBe(true)
  })

  it('runs the full Phase 04 corpus and the recursive evaluator exactly once', () => {
    const commands = campaignGates.map(({ command }) => command.join(' '))
    expect(commands.filter((command) => command.includes('corpus-eval.ts'))).toHaveLength(1)
    expect(commands.filter((command) =>
      command.includes('run-phase-06-recursive-evaluation.ts'))).toHaveLength(1)
    expect(commands.some((command) => command.includes('corpus-eval.ts --profile smoke'))).toBe(false)
  })

  it('partitions performance evidence out of the broad unit and integration suites', () => {
    const unit = campaignGates.find(({ id }) => id === 'unit-regression-suite')
    const integration = campaignGates.find(({ id }) => id === 'postgresql-data-engine-integration')
    expect(unit?.command.join(' ')).toContain('research-run.test.ts')
    expect(unit?.command.join(' ')).toContain('useSSE.test.ts')
    expect(integration?.command.join(' ')).toContain('research-replay.integration.test.ts')
    expect(integration?.command.join(' ')).toContain('sidecar.integration.test.ts')
    expect(campaignGates.find(({ id }) => id === 'lint')?.command)
      .toEqual(['bun', '--bun', 'eslint', '.', '--max-warnings', '0'])
  })
})
