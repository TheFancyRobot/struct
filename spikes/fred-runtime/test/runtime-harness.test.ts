import { describe, expect, test } from 'bun:test';
import {
  CHECKPOINT_INLINE_BUDGET_BYTES,
  WORKFLOW_ID,
  makeResearchRunInput,
  runRuntimeSpike,
} from '../src/runtime-harness';

describe('runRuntimeSpike', () => {
  test('runs one typed deterministic tool through Fred and produces compact checkpoint metadata', async () => {
    const result = await runRuntimeSpike(makeResearchRunInput());

    expect(result.execution.success).toBe(true);
    expect(result.execution.status).toBe('completed');
    expect(result.execution.executedNodes).toEqual([
      'prepareBoundary',
      'runDeterministicTool',
      'materializeCheckpoint',
      'emitRecommendation',
    ]);

    expect(result.finalOutput.status).toBe('completed');
    expect(result.finalOutput.runCorrelation.productRunId).toBe('research-run-001');
    expect(result.finalOutput.runCorrelation.fredWorkflowId).toBe(WORKFLOW_ID);
    expect(result.finalOutput.toolResult.strategy).toBe('hybrid-retrieval');
    expect(result.finalOutput.toolResult.evidenceKeys).toEqual([
      'compatibility-matrix',
      'boundary-table',
      'step-02-handoff',
    ]);
    expect(result.finalOutput.checkpoint.inlineBytes).toBeLessThan(
      CHECKPOINT_INLINE_BUDGET_BYTES,
    );
    expect(result.finalOutput.checkpoint.artifactRef.artifactId).toBe('artifact-2026-07-17');
    expect(result.finalOutput.recommendation.step02Handoff.checkpointOwner).toBe(
      'product-journal',
    );
    expect(result.finalOutput.recommendation.step02Handoff.eventHooks).toEqual([
      'beforePipeline',
      'beforeStep',
      'afterStep',
      'afterPipeline',
      'onStepError',
    ]);

    expect(result.hookTrace[0]?.hook).toBe('beforePipeline');
    expect(result.hookTrace.filter((entry) => entry.hook === 'beforeStep')).toHaveLength(4);
    expect(result.hookTrace.filter((entry) => entry.hook === 'afterStep')).toHaveLength(4);
    expect(result.hookTrace.at(-1)?.hook).toBe('afterPipeline');

    const serializedCheckpoint = JSON.stringify(result.finalOutput.checkpoint);
    expect(Buffer.byteLength(serializedCheckpoint, 'utf8')).toBe(
      result.finalOutput.checkpoint.inlineBytes,
    );
    expect(serializedCheckpoint).not.toContain('raw source body');
  });

  test('fails invalid typed input before workflow execution', async () => {
    await expect(
      runRuntimeSpike({ ...makeResearchRunInput(), question: '' }),
    ).rejects.toThrow(/Input validation failed/);
  });

  test('surfaces deterministic tool failures distinctly from provider or workflow failures', async () => {
    await expect(
      runRuntimeSpike({
        ...makeResearchRunInput(),
        retrievalQuery: 'tool-error: missing deterministic adapter',
      }),
    ).rejects.toThrow(/DeterministicToolFailure/);
  });

  test('fails with a typed validation error when a deterministic tool emits malformed output', async () => {
    await expect(
      runRuntimeSpike({
        ...makeResearchRunInput(),
        retrievalQuery: 'tool-invalid-output: malformed result',
      }),
    ).rejects.toThrow(/DeterministicToolValidationFailure/);
  });

  test('fails with a typed validation error when the terminal workflow output is malformed', async () => {
    await expect(
      runRuntimeSpike({
        ...makeResearchRunInput(),
        retrievalQuery: 'workflow-invalid-output: malformed terminal result',
      }),
    ).rejects.toThrow(/WorkflowOutputValidationError/);
  });
});
