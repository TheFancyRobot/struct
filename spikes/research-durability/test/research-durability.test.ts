import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CHECKPOINT_TARGET_BYTES,
  EVENT_PAYLOAD_TARGET_BYTES,
  runDurabilityScenario,
  runRestartPhase,
  type ScenarioId,
} from '../src/research-durability';

function makeStoreDir() {
  return mkdtempSync(join(tmpdir(), 'research-durability-'));
}

function expectCommonInvariants(trace: Awaited<ReturnType<typeof runDurabilityScenario>>) {
  expect(trace.events.length).toBeGreaterThan(0);
  expect(trace.invariants.eventSequenceMonotonic).toBe(true);
  expect(trace.invariants.noEventPayloadExceededLimit).toBe(true);
  expect(trace.invariants.noCheckpointExceededLimit).toBe(true);

  const terminalEvents = trace.events.filter((event) =>
    ['research-completed', 'research-failed', 'research-cancelled'].includes(event.type),
  );
  expect(terminalEvents).toHaveLength(1);

  for (const event of trace.events) {
    expect(event.identity.runId).toBe(trace.runId);
    expect(event.serializedBytes).toBeLessThanOrEqual(EVENT_PAYLOAD_TARGET_BYTES);
  }

  expect(trace.checkpoint.runId).toBe(trace.runId);
  expect(trace.checkpoint.serializedBytes).toBeLessThanOrEqual(CHECKPOINT_TARGET_BYTES);
}

describe('runDurabilityScenario', () => {
  test('keeps work alive across disconnect and lets an authorized client reconnect from the journal', async () => {
    const trace = await runDurabilityScenario('disconnect-reconnect', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.invariants.disconnectDoesNotCancel).toBe(true);
    expect(trace.projections.authorizedReconnect?.kind).toBe('events');
    if (trace.projections.authorizedReconnect?.kind !== 'events') {
      throw new Error('Expected an event replay projection for authorized reconnect.');
    }
    expect(trace.projections.authorizedReconnect.events.at(-1)?.type).toBe('research-completed');
    expect(trace.invariants.authorizedReconnectReachedTerminal).toBe(true);
  });

  test('persists cancel intent before the next cooperative boundary and emits one terminal cancellation event', async () => {
    const trace = await runDurabilityScenario('explicit-cancel-before-boundary', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('cancelled');
    expect(trace.finalState.terminalEventType).toBe('research-cancelled');
    expect(trace.invariants.cancelObservedWithinMs).toBeLessThanOrEqual(2000);
    expect(trace.auditLog.map((entry) => entry.code)).toContain('cancel-intent-recorded');
  });

  test('treats duplicate cancel requests as audited no-ops after the first durable intent wins', async () => {
    const trace = await runDurabilityScenario('duplicate-cancel', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('cancelled');
    expect(trace.auditLog.filter((entry) => entry.code === 'duplicate-cancel-noop')).toHaveLength(1);
    expect(trace.events.filter((event) => event.type === 'research-cancelled')).toHaveLength(1);
  });

  test('resumes from a persisted checkpoint after a crash before client delivery without duplicating committed work', async () => {
    const trace = await runDurabilityScenario('restart-after-checkpoint', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.attemptCount).toBe(2);
    expect(trace.recovery?.resumedFromCheckpoint).toBe(true);
    expect(trace.recovery?.reconciliation).toBe('resume-from-checkpoint');
    expect(trace.invariants.duplicateSideEffectRate).toBe(0);
  });

  test('reconciles a crash after a domain side effect but before journal/checkpoint sync without replaying the effect', async () => {
    const trace = await runDurabilityScenario('restart-after-domain-effect', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.attemptCount).toBe(2);
    expect(trace.recovery?.reconciliation).toBe('replay-domain-effect');
    expect(trace.finalState.sideEffects.collectEvidenceExecutions).toBe(1);
    expect(trace.invariants.duplicateSideEffectRate).toBe(0);
  });

  test('stores oversized tool results by artifact reference while keeping events and checkpoints under budget', async () => {
    const trace = await runDurabilityScenario('large-artifact-reference', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.checkpoint.artifactRefs).toHaveLength(1);
    expect(trace.checkpoint.artifactRefs[0]?.bytes).toBeGreaterThan(CHECKPOINT_TARGET_BYTES);
    expect(JSON.stringify(trace.checkpoint)).not.toContain('large-payload-inline');
    expect(trace.events.find((event) => event.type === 'step-completed')?.payload).not.toHaveProperty(
      'largePayloadInline',
    );
  });

  test('records late cancel after terminal completion as an audited no-op instead of changing final state', async () => {
    const trace = await runDurabilityScenario('late-cancel-after-terminal', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.finalState.terminalEventType).toBe('research-completed');
    expect(trace.auditLog.filter((entry) => entry.code === 'late-cancel-noop')).toHaveLength(1);
    expect(trace.events.filter((event) => event.type === 'research-cancelled')).toHaveLength(0);
  });

  test('returns an explicit resync response when a reconnect cursor has fallen behind retention', async () => {
    const trace = await runDurabilityScenario('expired-cursor-gap', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.projections.authorizedReconnect?.kind).toBe('resync-required');
    expect(trace.projections.authorizedReconnect).toMatchObject({
      retentionFloor: expect.stringMatching(/^cursor:/),
      resumeFromCursor: expect.stringMatching(/^cursor:/),
    });
  });

  test('re-checks authorization before reconnect and withholds event data after access changes', async () => {
    const trace = await runDurabilityScenario('authorization-changed-before-reconnect', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.projections.unauthorizedReconnect?.kind).toBe('forbidden');
    expect(trace.invariants.unauthorizedReconnectDenied).toBe(true);
  });

  test('lets a durable cancel beat terminal completion when the request lands during checkpoint persistence', async () => {
    const trace = await runDurabilityScenario('cancel-during-checkpoint-persistence', {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('cancelled');
    expect(trace.finalState.terminalEventType).toBe('research-cancelled');
    expect(trace.checkpoint.cancelRequested).toBe(true);
    expect(trace.auditLog.map((entry) => entry.code)).toContain('cancel-won-before-terminal-commit');
  });

  test('reconciles a crash after appending research-completed so resume does not emit a duplicate terminal event', async () => {
    const trace = await runDurabilityScenario('restart-after-completion-terminal-append' as ScenarioId, {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('completed');
    expect(trace.finalState.terminalEventType).toBe('research-completed');
    expect(trace.events.filter((event) => event.type === 'research-completed')).toHaveLength(1);
    expect(trace.attemptCount).toBe(1);
    expect(trace.recovery?.reconciliation).toBe('reconcile-terminal');
  });

  test('reconciles a crash after appending research-cancelled so resume does not emit a duplicate terminal event', async () => {
    const trace = await runDurabilityScenario('restart-after-cancellation-terminal-append' as ScenarioId, {
      storeDir: makeStoreDir(),
    });

    expectCommonInvariants(trace);
    expect(trace.finalState.status).toBe('cancelled');
    expect(trace.finalState.terminalEventType).toBe('research-cancelled');
    expect(trace.events.filter((event) => event.type === 'research-cancelled')).toHaveLength(1);
    expect(trace.attemptCount).toBe(1);
    expect(trace.recovery?.reconciliation).toBe('reconcile-terminal');
  });

  test('repeated resume after terminal reconciliation keeps the completion case idempotently terminal', async () => {
    const storeDir = makeStoreDir();
    await runDurabilityScenario('restart-after-completion-terminal-append' as ScenarioId, {
      storeDir,
    });

    const resumed = await runRestartPhase('resume', { storeDir });

    expect(resumed.exitCode).toBe(0);
    expect(resumed.trace?.attemptCount).toBe(1);
    expect(resumed.trace?.finalState.status).toBe('completed');
    expect(resumed.trace?.events.filter((event) => event.type === 'research-completed')).toHaveLength(1);
  });

  test('repeated resume after terminal reconciliation keeps the cancellation case idempotently terminal', async () => {
    const storeDir = makeStoreDir();
    await runDurabilityScenario('restart-after-cancellation-terminal-append' as ScenarioId, {
      storeDir,
    });

    const resumed = await runRestartPhase('resume', { storeDir });

    expect(resumed.exitCode).toBe(0);
    expect(resumed.trace?.attemptCount).toBe(1);
    expect(resumed.trace?.finalState.status).toBe('cancelled');
    expect(resumed.trace?.events.filter((event) => event.type === 'research-cancelled')).toHaveLength(1);
  });

  test('rejects unknown scenarios so the proving harness stays explicit and reviewable', async () => {
    await expect(
      runDurabilityScenario('not-a-real-scenario' as ScenarioId, {
        storeDir: makeStoreDir(),
      }),
    ).rejects.toThrow(/Unknown durability scenario/);
  });
});
