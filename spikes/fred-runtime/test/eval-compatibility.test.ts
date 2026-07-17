import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGoldenTrace, runTestCases, type TestCase } from '@fancyrobot/fred/eval';
import { Schema } from 'effect';
import {
  ResearchRunInputSchema,
  ResearchRunTerminalSchema,
} from '../src/contracts';

describe('fred eval compatibility', () => {
  test('runs golden trace assertions against a typed runtime-boundary fixture', async () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const tracesDirectory = join(currentDir, 'golden-traces');

    const cases: TestCase[] = [
      {
        name: 'Runtime boundary output stays product-owned',
        traceFile: 'research-run.golden.json',
        assertions: [
          {
            type: 'routing',
            expected: {
              method: 'default.agent',
              agentId: 'research-run-spike',
              intentId: 'runtime.boundary',
            },
          },
          {
            type: 'response',
            pathEquals: {
              'output.status': 'completed',
              'output.toolResult.strategy': 'hybrid-retrieval',
              'output.recommendation.step02Handoff.checkpointOwner': 'product-journal',
            },
          },
        ],
      },
    ];

    const results = await runTestCases(cases, tracesDirectory);
    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.results.every((result) => result.passed)).toBe(true);
  });

  test('decodes the golden input and output with the same Effect Schemas as the harness', async () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const trace = await loadGoldenTrace(join(currentDir, 'golden-traces', 'research-run.golden.json'));

    const input = Schema.decodeUnknownSync(Schema.parseJson(ResearchRunInputSchema))(trace.trace.message);
    const output = Schema.decodeUnknownSync(ResearchRunTerminalSchema)(trace.trace.response.output);

    expect(input.runId).toBe('research-run-001');
    expect(output.toolResult.artifactRef.bytes).toBe(131072);
    expect(output.recommendation.productOwns).toContain('checkpoint records and artifact references');
  });
});
