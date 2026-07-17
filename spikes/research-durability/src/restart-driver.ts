import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readInternalRestartTrace } from './research-durability';

function readArg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) {
    throw new Error(`Missing argument: ${name}`);
  }
  return value;
}

async function runPhase(
  phase: 'crash' | 'resume',
  cwd: string,
  storeDir: string,
): Promise<{ phase: 'crash' | 'resume'; pid: number; exitCode: number }> {
  return await new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', 'src/restart-child.ts', '--phase', phase, '--store-dir', storeDir], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', () => undefined);
    child.stderr.on('data', () => undefined);
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        phase,
        pid: child.pid ?? -1,
        exitCode: code ?? 1,
      });
    });
  });
}

const cwd = fileURLToPath(new URL('..', import.meta.url));
const storeDir = readArg('--store-dir', join(cwd, 'artifacts', 'restart-store'));
const tracePath = readArg('--trace-file', join(cwd, 'artifacts', 'restart-scenario.trace.json'));
rmSync(storeDir, { recursive: true, force: true });
mkdirSync(storeDir, { recursive: true });
mkdirSync(fileURLToPath(new URL('../artifacts', import.meta.url)), { recursive: true });

const crashPhase = await runPhase('crash', cwd, storeDir);
const resumePhase = await runPhase('resume', cwd, storeDir);
const trace = readInternalRestartTrace(storeDir) as ReturnType<typeof readInternalRestartTrace> & {
  processPhases?: Array<{ phase: string; pid: number; exitCode: number }>;
};
trace.processPhases = [crashPhase, resumePhase];
if (trace.recovery) {
  trace.recovery.freshProcessRequired = true;
}
writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8');

process.stdout.write(readFileSync(tracePath, 'utf8'));
process.exit(resumePhase.exitCode);
