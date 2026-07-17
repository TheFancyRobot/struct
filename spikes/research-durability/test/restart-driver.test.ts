import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRestartScenarioCli } from '../src/research-durability';

function makeStoreDir() {
  return mkdtempSync(join(tmpdir(), 'research-durability-cli-'));
}

describe('scenario:restart CLI', () => {
  test('runs the crash and resume phases in separate processes and writes a machine-readable trace artifact', async () => {
    const storeDir = makeStoreDir();
    const tracePath = join(storeDir, 'restart-scenario.trace.json');

    const result = await runRestartScenarioCli({
      cwd: new URL('..', import.meta.url),
      storeDir,
      tracePath,
    });

    expect(result.exitCode).toBe(0);
    expect(result.tracePath).toBe(tracePath);

    const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as {
      scenarioId: string;
      processPhases: Array<{ phase: string; pid: number; exitCode: number }>;
      finalState: { status: string };
      invariants: { duplicateSideEffectRate: number };
      recovery?: { resumedFromCheckpoint?: boolean; freshProcessRequired?: boolean };
      attemptCount: number;
    };

    expect(trace.scenarioId).toBe('restart-after-checkpoint');
    expect(trace.processPhases.map((phase) => phase.phase)).toEqual(['crash', 'resume']);
    expect(new Set(trace.processPhases.map((phase) => phase.pid)).size).toBe(2);
    expect(trace.processPhases.map((phase) => phase.exitCode)).toEqual([86, 0]);
    expect(trace.attemptCount).toBe(2);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.invariants.duplicateSideEffectRate).toBe(0);
    expect(trace.recovery?.resumedFromCheckpoint).toBe(true);
    expect(trace.recovery?.freshProcessRequired).toBe(true);
  });

  test('resets prior restart-store artifacts so repeated runs keep the same bounded two-attempt proof', async () => {
    const storeDir = makeStoreDir();
    const tracePath = join(storeDir, 'restart-scenario.trace.json');

    await runRestartScenarioCli({
      cwd: new URL('..', import.meta.url),
      storeDir,
      tracePath,
    });
    const second = await runRestartScenarioCli({
      cwd: new URL('..', import.meta.url),
      storeDir,
      tracePath,
    });

    expect(second.exitCode).toBe(0);

    const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as {
      attemptCount: number;
      processPhases: Array<{ phase: string; exitCode: number }>;
    };

    expect(trace.attemptCount).toBe(2);
    expect(trace.processPhases.map((phase) => phase.exitCode)).toEqual([86, 0]);
  });
});
