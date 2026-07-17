import { runRestartPhase } from './research-durability';

function readArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error(`Missing argument: ${name}`);
  }
  return value;
}

const phase = readArg('--phase');
const storeDir = readArg('--store-dir');

const result = await runRestartPhase(phase === 'crash' ? 'crash' : 'resume', {
  storeDir,
});

process.exit(result.exitCode);
