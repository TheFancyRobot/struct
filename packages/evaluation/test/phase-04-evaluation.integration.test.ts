import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { Effect } from 'effect'
import {
  readEvaluationReport,
  runPhase04Evaluation,
} from '../src/phase-04-evaluation.js'

const enabled = process.env['DATA_ENGINE_INTEGRATION'] === '1'
const suite = enabled ? describe : describe.skip

suite('Phase 04 exact-computation evaluation', () => {
  it('runs the real smoke data plane twice with identical normalized evidence', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'struct-phase-04-eval-'))
    try {
      const options = {
        profile: 'smoke' as const,
        artifactRoot: resolve(
          process.env['ARTIFACT_STORAGE_ROOT'] ?? '.local/artifacts',
        ),
        databaseUrl:
          process.env['DATABASE_URL']
          ?? 'postgres://struct:struct@127.0.0.1:5432/struct',
        dataEngineUrl:
          process.env['DATA_ENGINE_URL'] ?? 'http://127.0.0.1:4300',
        dataEngineToken:
          process.env['DATA_ENGINE_TOKEN'] ?? 'struct-local-data-engine-token',
      }
      const firstPath = resolve(root, 'first-report.json')
      const first = await Effect.runPromise(runPhase04Evaluation({
        ...options,
        outputRoot: resolve(root, 'run-first'),
        reportPath: firstPath,
      }).pipe(Effect.scoped))
      const secondPath = resolve(root, 'second-report.json')
      const second = await Effect.runPromise(runPhase04Evaluation({
        ...options,
        outputRoot: resolve(root, 'run-second'),
        reportPath: secondPath,
      }).pipe(Effect.scoped))

      expect(first.report.status).toBe('passed')
      expect(first.report.reportSha256).toBe(second.report.reportSha256)
      expect(await Bun.file(firstPath).text()).toBe(
        await Bun.file(secondPath).text(),
      )
      expect((await readEvaluationReport(firstPath)).counts).toEqual({
        'exact-answer': 8,
        'schema-family': 4,
        citation: 9,
        'sql-guardrail': 9,
        authentication: 2,
        'sidecar-isolation': 3,
        'corpus-security': 8,
        recovery: 6,
        'negative-control': 2,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
