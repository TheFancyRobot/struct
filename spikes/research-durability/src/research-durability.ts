import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Schema } from 'effect';
import {
  type ArtifactReference,
  ArtifactReferenceSchema,
  type AuditEntry,
  AuditEntrySchema,
  type CheckpointRecord,
  CheckpointRecordSchema,
  CHECKPOINT_TARGET_BYTES,
  type ProjectionResult,
  ProjectionResultSchema,
  type ResearchEvent,
  ResearchEventSchema,
  EVENT_PAYLOAD_TARGET_BYTES,
  HEARTBEAT_TARGET_SECONDS,
  type TerminalResearchEventType,
} from './contracts';

export {
  CHECKPOINT_TARGET_BYTES,
  EVENT_PAYLOAD_TARGET_BYTES,
  HEARTBEAT_TARGET_SECONDS,
} from './contracts';

export type ScenarioId =
  | 'disconnect-reconnect'
  | 'explicit-cancel-before-boundary'
  | 'duplicate-cancel'
  | 'restart-after-checkpoint'
  | 'restart-after-domain-effect'
  | 'restart-after-completion-terminal-append'
  | 'restart-after-cancellation-terminal-append'
  | 'large-artifact-reference'
  | 'late-cancel-after-terminal'
  | 'expired-cursor-gap'
  | 'authorization-changed-before-reconnect'
  | 'cancel-during-checkpoint-persistence';

export type RestartPhase = 'crash' | 'resume';

type RunStatus = 'running' | 'completed' | 'cancelled' | 'failed';
type RecoveryMode = 'none' | 'resume-from-checkpoint' | 'replay-domain-effect' | 'reconcile-terminal';
type PendingRecovery = 'none' | 'after-checkpoint' | 'after-domain-effect';
type CrashPoint = PendingRecovery | 'after-completed-terminal-append' | 'after-cancelled-terminal-append';

type DurableState = {
  runId: string;
  question: string;
  sourceVersionId: string;
  attempt: number;
  nextSequence: number;
  status: RunStatus;
  currentStep: string;
  completedStepRefs: string[];
  cancelRequested: boolean;
  cancelReason: string | null;
  cancelRequestedAtMs: number | null;
  clockMs: number;
  authorizationVersion: number;
  retentionFloor: string;
  sideEffects: {
    collectEvidenceCommitted: boolean;
    collectEvidenceExecutions: number;
  };
  pendingRecovery: PendingRecovery;
  terminalEventType: TerminalResearchEventType | null;
  checkpointCursor: string;
};

export type ScenarioTrace = {
  scenarioId: ScenarioId;
  storeDir: string;
  runId: string;
  attemptCount: number;
  finalState: {
    status: RunStatus;
    terminalEventType: TerminalResearchEventType | null;
    sideEffects: { collectEvidenceExecutions: number };
  };
  checkpoint: CheckpointRecord;
  events: ResearchEvent[];
  auditLog: AuditEntry[];
  invariants: {
    eventSequenceMonotonic: boolean;
    duplicateSideEffectRate: number;
    disconnectDoesNotCancel: boolean;
    authorizedReconnectReachedTerminal: boolean;
    unauthorizedReconnectDenied: boolean;
    cancelObservedWithinMs: number;
    noEventPayloadExceededLimit: boolean;
    noCheckpointExceededLimit: boolean;
  };
  projections: {
    authorizedReconnect?: ProjectionResult;
    unauthorizedReconnect?: ProjectionResult;
  };
  recovery?: {
    resumedFromCheckpoint: boolean;
    freshProcessRequired: boolean;
    reconciliation: RecoveryMode;
  };
};

type RunOptions = {
  storeDir: string;
};

type AttemptOptions = {
  crashPoint?: CrashPoint;
  resumedFromAttempt?: number;
  recoveryMode?: RecoveryMode;
  requestCancelBeforeBoundary?: boolean;
  requestDuplicateCancel?: boolean;
  requestCancelDuringCheckpoint?: boolean;
};

type RestartCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  tracePath: string;
};

type TerminalResearchEvent = Extract<ResearchEvent, { type: TerminalResearchEventType }>;

function isTerminalStatus(status: RunStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed';
}

const RUN_ID = 'research-run-001';
const STEP_ID = 'collect-evidence';
const WORKFLOW_ID = 'research-durability-spike';
const QUESTION =
  'How should live events, cancellation, and checkpoint recovery behave for one durable research run?';
const SOURCE_VERSION_ID = 'source-version-001';
const TERMINAL_SUMMARY = 'Checkpoint-backed replay keeps public progress durable and restart-safe.';
const CANCELLATION_REASON = 'user-requested';
const ARTIFACT_REFERENCE = Schema.decodeUnknownSync(ArtifactReferenceSchema)({
  artifactId: 'artifact-2026-07-17',
  sha256: 'b'.repeat(64),
  bytes: 131072,
  mediaType: 'application/json',
});
const SCENARIOS = new Set<ScenarioId>([
  'disconnect-reconnect',
  'explicit-cancel-before-boundary',
  'duplicate-cancel',
  'restart-after-checkpoint',
  'restart-after-domain-effect',
  'restart-after-completion-terminal-append',
  'restart-after-cancellation-terminal-append',
  'large-artifact-reference',
  'late-cancel-after-terminal',
  'expired-cursor-gap',
  'authorization-changed-before-reconnect',
  'cancel-during-checkpoint-persistence',
]);
const INTENTIONAL_CRASH_EXIT_CODE = 86;

const decodeResearchEvent = Schema.decodeUnknownSync(ResearchEventSchema);
const decodeCheckpointRecord = Schema.decodeUnknownSync(CheckpointRecordSchema);
const decodeProjectionResult = Schema.decodeUnknownSync(ProjectionResultSchema);
const decodeAuditEntry = Schema.decodeUnknownSync(AuditEntrySchema);

class IntentionalCrashError extends Error {
  readonly exitCode = INTENTIONAL_CRASH_EXIT_CODE;

  constructor(readonly crashPoint: CrashPoint) {
    super(`Intentional crash at ${crashPoint}`);
  }
}

function ensureScenario(scenarioId: ScenarioId): void {
  if (!SCENARIOS.has(scenarioId)) {
    throw new Error(`Unknown durability scenario: ${scenarioId}`);
  }
}

function stabilizeSerializedBytes<T extends { serializedBytes: number }>(value: T): T {
  let next = value;

  while (true) {
    const serializedBytes = Buffer.byteLength(JSON.stringify(next), 'utf8');
    if (serializedBytes === next.serializedBytes) {
      return next;
    }
    next = {
      ...next,
      serializedBytes,
    };
  }
}

function cursorFor(attempt: number, sequence: number): string {
  return `cursor:${attempt}:${sequence}`;
}

function parseCursor(cursor: string): { attempt: number; sequence: number } {
  const [prefix, attempt, sequence] = cursor.split(':');
  if (prefix !== 'cursor' || !attempt || !sequence) {
    throw new Error(`Invalid cursor: ${cursor}`);
  }
  return {
    attempt: Number(attempt),
    sequence: Number(sequence),
  };
}

function compareCursor(left: string, right: string): number {
  const a = parseCursor(left);
  const b = parseCursor(right);
  if (a.attempt !== b.attempt) {
    return a.attempt - b.attempt;
  }
  return a.sequence - b.sequence;
}

function statePath(storeDir: string): string {
  return join(storeDir, 'state.json');
}

function checkpointPath(storeDir: string): string {
  return join(storeDir, 'checkpoint.json');
}

function eventsPath(storeDir: string): string {
  return join(storeDir, 'events.jsonl');
}

function auditPath(storeDir: string): string {
  return join(storeDir, 'audit.jsonl');
}

function internalRestartTracePath(storeDir: string): string {
  return join(storeDir, 'restart-scenario.internal.json');
}

function packageRootFromModule(): string {
  return fileURLToPath(new URL('..', import.meta.url));
}

function ensureStoreDir(storeDir: string): void {
  mkdirSync(storeDir, { recursive: true });
}

function createInitialState(): DurableState {
  return {
    runId: RUN_ID,
    question: QUESTION,
    sourceVersionId: SOURCE_VERSION_ID,
    attempt: 1,
    nextSequence: 1,
    status: 'running',
    currentStep: STEP_ID,
    completedStepRefs: [],
    cancelRequested: false,
    cancelReason: null,
    cancelRequestedAtMs: null,
    clockMs: 0,
    authorizationVersion: 1,
    retentionFloor: cursorFor(1, 1),
    sideEffects: {
      collectEvidenceCommitted: false,
      collectEvidenceExecutions: 0,
    },
    pendingRecovery: 'none',
    terminalEventType: null,
    checkpointCursor: cursorFor(0, 0),
  };
}

function writeState(storeDir: string, state: DurableState): void {
  writeFileSync(statePath(storeDir), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function readState(storeDir: string): DurableState {
  if (!existsSync(statePath(storeDir))) {
    const state = createInitialState();
    writeState(storeDir, state);
    return state;
  }
  return JSON.parse(readFileSync(statePath(storeDir), 'utf8')) as DurableState;
}

function resetStore(storeDir: string): void {
  ensureStoreDir(storeDir);
  for (const file of [statePath(storeDir), checkpointPath(storeDir), eventsPath(storeDir), auditPath(storeDir), internalRestartTracePath(storeDir)]) {
    if (existsSync(file)) {
      rmSync(file);
    }
  }
}

function appendJsonLine(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`, 'utf8');
}

function readJsonLines<T>(path: string): T[] {
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function readEvents(storeDir: string): ResearchEvent[] {
  return readJsonLines<ResearchEvent>(eventsPath(storeDir)).map((event) => decodeResearchEvent(event));
}

function readAuditLog(storeDir: string): AuditEntry[] {
  return readJsonLines<AuditEntry>(auditPath(storeDir)).map((entry) => decodeAuditEntry(entry));
}

function readCheckpoint(storeDir: string): CheckpointRecord {
  if (!existsSync(checkpointPath(storeDir))) {
    return writeCheckpoint(storeDir, readState(storeDir), []);
  }
  return decodeCheckpointRecord(JSON.parse(readFileSync(checkpointPath(storeDir), 'utf8')));
}

function currentBudget(state: DurableState) {
  return {
    modelCalls: 1,
    toolCalls: state.sideEffects.collectEvidenceCommitted ? 1 : 0,
    elapsedMs: state.clockMs,
  };
}

function appendEvent(
  storeDir: string,
  state: DurableState,
  type: ResearchEvent['type'],
  payload: ResearchEvent['payload'],
): ResearchEvent {
  const event = decodeResearchEvent(
    stabilizeSerializedBytes({
      type,
      identity: {
        runId: state.runId,
        attempt: state.attempt,
        sequence: state.nextSequence,
        cursor: cursorFor(state.attempt, state.nextSequence),
      },
      serializedBytes: 0,
      payload,
    }),
  );

  if (event.serializedBytes > EVENT_PAYLOAD_TARGET_BYTES) {
    throw new Error(`Event payload exceeded target size: ${event.type}`);
  }

  appendJsonLine(eventsPath(storeDir), event);
  state.nextSequence += 1;
  state.checkpointCursor = event.identity.cursor;
  writeState(storeDir, state);
  return event;
}

function appendAudit(storeDir: string, code: string, detail: string): AuditEntry {
  const entry = decodeAuditEntry({ code, detail });
  appendJsonLine(auditPath(storeDir), entry);
  return entry;
}

function writeCheckpoint(
  storeDir: string,
  state: DurableState,
  artifactRefs: ArtifactReference[],
): CheckpointRecord {
  const checkpoint = decodeCheckpointRecord(
    stabilizeSerializedBytes({
      runId: state.runId,
      attempt: state.attempt,
      currentStep: state.currentStep,
      completedStepRefs: [...state.completedStepRefs],
      budgetSnapshot: currentBudget(state),
      cancelRequested: state.cancelRequested,
      fredCorrelation: {
        workflowId: WORKFLOW_ID,
        runCorrelationId: `${state.runId}::fred::attempt-${state.attempt}`,
      },
      artifactRefs,
      lastEventSequence: Math.max(0, state.nextSequence - 1),
      serializedBytes: 0,
    }),
  );

  writeFileSync(checkpointPath(storeDir), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  return checkpoint;
}

function advanceClock(state: DurableState, byMs = 250): void {
  state.clockMs += byMs;
}

function emitAttemptStartEvents(
  storeDir: string,
  state: DurableState,
  resumedFromAttempt?: number,
): void {
  const existingEvents = readEvents(storeDir);
  if (existingEvents.length === 0) {
    appendEvent(storeDir, state, 'research-started', {
      question: state.question,
      sourceVersionId: state.sourceVersionId,
      heartbeatSeconds: HEARTBEAT_TARGET_SECONDS,
    });
    advanceClock(state);
    appendEvent(storeDir, state, 'plan-created', {
      stepIds: [STEP_ID],
      budgetPolicy: 'bounded-single-step',
    });
    advanceClock(state);
  }

  appendEvent(storeDir, state, 'step-started', {
    stepId: STEP_ID,
    ...(resumedFromAttempt ? { resumedFromAttempt } : {}),
  });
  advanceClock(state);
}

function requestCancellation(storeDir: string, reason: string): 'accepted' | 'duplicate' | 'late' {
  const state = readState(storeDir);

  if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
    appendAudit(storeDir, 'late-cancel-noop', 'Cancellation arrived after a terminal state committed.');
    return 'late';
  }

  if (state.cancelRequested) {
    appendAudit(storeDir, 'duplicate-cancel-noop', 'Cancellation was already recorded for this run.');
    return 'duplicate';
  }

  state.cancelRequested = true;
  state.cancelReason = reason;
  state.cancelRequestedAtMs = state.clockMs;
  writeState(storeDir, state);
  appendAudit(storeDir, 'cancel-intent-recorded', 'Durable cancellation intent recorded in the run state.');
  return 'accepted';
}

function commitDomainSideEffect(storeDir: string): ArtifactReference {
  const state = readState(storeDir);
  if (!state.sideEffects.collectEvidenceCommitted) {
    state.sideEffects.collectEvidenceCommitted = true;
    state.sideEffects.collectEvidenceExecutions += 1;
    writeState(storeDir, state);
  }
  return ARTIFACT_REFERENCE;
}

function latestTerminalEvent(storeDir: string): TerminalResearchEvent | undefined {
  const events = readEvents(storeDir);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event?.type === 'research-completed'
      || event?.type === 'research-cancelled'
      || event?.type === 'research-failed'
    ) {
      return event;
    }
  }
  return undefined;
}

function reconcileTerminalStateFromJournal(storeDir: string): RecoveryMode {
  const state = readState(storeDir);
  const terminalEvent = latestTerminalEvent(storeDir);

  if (!terminalEvent) {
    return 'none';
  }

  const expectedStatus: RunStatus = terminalEvent.type === 'research-completed'
    ? 'completed'
    : terminalEvent.type === 'research-cancelled'
      ? 'cancelled'
      : 'failed';

  if (state.status === expectedStatus && state.terminalEventType === terminalEvent.type) {
    return 'none';
  }

  state.status = expectedStatus;
  state.terminalEventType = terminalEvent.type;
  state.currentStep = 'terminal';
  state.pendingRecovery = 'none';
  if (terminalEvent.type === 'research-completed') {
    state.completedStepRefs = [STEP_ID];
  }
  writeState(storeDir, state);

  const existingCheckpoint = readCheckpoint(storeDir);
  writeCheckpoint(storeDir, state, [...existingCheckpoint.artifactRefs]);
  appendAudit(
    storeDir,
    'terminal-state-reconciled',
    `Recovered ${terminalEvent.type} from the durable journal without emitting a duplicate terminal event.`,
  );
  return 'reconcile-terminal';
}

function finalizeCancelledRun(storeDir: string, crashPoint?: CrashPoint): void {
  const state = readState(storeDir);
  appendEvent(storeDir, state, 'research-cancelled', {
    reason: state.cancelReason ?? CANCELLATION_REASON,
    winner: 'cancel-intent',
  });
  if (crashPoint === 'after-cancelled-terminal-append') {
    appendAudit(
      storeDir,
      'crash-after-cancelled-terminal-append',
      'Simulated crash after appending research-cancelled but before terminal state persistence.',
    );
    throw new IntentionalCrashError('after-cancelled-terminal-append');
  }
  advanceClock(state);
  state.status = 'cancelled';
  state.terminalEventType = 'research-cancelled';
  state.currentStep = 'terminal';
  writeState(storeDir, state);
}

function finalizeCompletedRun(
  storeDir: string,
  artifactRef: ArtifactReference,
  crashPoint?: CrashPoint,
): void {
  const state = readState(storeDir);
  appendEvent(storeDir, state, 'step-completed', {
    stepId: STEP_ID,
    artifactRef,
    checkpointCursor: state.checkpointCursor,
  });
  advanceClock(state);
  appendEvent(storeDir, state, 'answer-streaming', {
    delta: TERMINAL_SUMMARY,
    done: true,
  });
  advanceClock(state);
  state.completedStepRefs = [STEP_ID];
  state.currentStep = 'terminal';
  writeState(storeDir, state);
  appendEvent(storeDir, state, 'research-completed', {
    reportArtifactId: 'report-artifact-001',
  });
  if (crashPoint === 'after-completed-terminal-append') {
    appendAudit(
      storeDir,
      'crash-after-completed-terminal-append',
      'Simulated crash after appending research-completed but before terminal state persistence.',
    );
    throw new IntentionalCrashError('after-completed-terminal-append');
  }
  advanceClock(state);
  state.status = 'completed';
  state.terminalEventType = 'research-completed';
  writeState(storeDir, state);
}

function performAttempt(storeDir: string, options: AttemptOptions): RecoveryMode {
  let state = readState(storeDir);
  emitAttemptStartEvents(storeDir, state, options.resumedFromAttempt);

  if (options.requestCancelBeforeBoundary) {
    requestCancellation(storeDir, CANCELLATION_REASON);
    if (options.requestDuplicateCancel) {
      requestCancellation(storeDir, CANCELLATION_REASON);
    }
  }

  state = readState(storeDir);
  let artifactRefs: ArtifactReference[] = [];
  let recoveryMode = options.recoveryMode ?? 'none';

  if (!state.cancelRequested) {
    const artifactRef = commitDomainSideEffect(storeDir);
    artifactRefs = [artifactRef];
    state = readState(storeDir);
    advanceClock(state, 400);
    writeState(storeDir, state);

    if (options.crashPoint === 'after-domain-effect') {
      state.pendingRecovery = 'after-domain-effect';
      writeState(storeDir, state);
      appendAudit(storeDir, 'crash-after-domain-effect', 'Simulated crash after the durable side effect committed.');
      throw new IntentionalCrashError('after-domain-effect');
    }
  }

  state = readState(storeDir);
  if (options.requestCancelDuringCheckpoint) {
    requestCancellation(storeDir, CANCELLATION_REASON);
    state = readState(storeDir);
    appendAudit(
      storeDir,
      'cancel-won-before-terminal-commit',
      'Cancellation was recorded while checkpoint persistence was in flight and therefore wins.',
    );
  }

  writeCheckpoint(storeDir, state, artifactRefs);
  state = readState(storeDir);
  state.pendingRecovery = 'none';
  writeState(storeDir, state);

  if (options.crashPoint === 'after-checkpoint') {
    state.pendingRecovery = 'after-checkpoint';
    writeState(storeDir, state);
    appendAudit(storeDir, 'crash-after-checkpoint', 'Simulated crash after checkpoint persistence but before terminal delivery.');
    throw new IntentionalCrashError('after-checkpoint');
  }

  if (state.cancelRequested) {
    finalizeCancelledRun(storeDir, options.crashPoint);
    return recoveryMode;
  }

  finalizeCompletedRun(storeDir, artifactRefs[0] ?? ARTIFACT_REFERENCE, options.crashPoint);
  return recoveryMode;
}

function beginNextAttempt(storeDir: string): RecoveryMode {
  const state = readState(storeDir);
  const recoveryMode: RecoveryMode = state.pendingRecovery === 'after-checkpoint'
    ? 'resume-from-checkpoint'
    : state.pendingRecovery === 'after-domain-effect'
      ? 'replay-domain-effect'
      : 'none';

  state.attempt += 1;
  state.nextSequence = 1;
  state.status = 'running';
  writeState(storeDir, state);
  return recoveryMode;
}

function resumeAfterCrash(storeDir: string): {
  recoveredTerminal: boolean;
  recoveryMode: RecoveryMode;
} {
  const state = readState(storeDir);
  if (isTerminalStatus(state.status)) {
    const reconciliation = reconcileTerminalStateFromJournal(storeDir);
    return {
      recoveredTerminal: true,
      recoveryMode: reconciliation,
    };
  }

  const reconciliation = reconcileTerminalStateFromJournal(storeDir);
  if (reconciliation === 'reconcile-terminal') {
    return {
      recoveredTerminal: true,
      recoveryMode: reconciliation,
    };
  }

  return {
    recoveredTerminal: false,
    recoveryMode: beginNextAttempt(storeDir),
  };
}

function projectResearchEvents(
  storeDir: string,
  options: { fromCursor: string; authorizationVersion: number },
): ProjectionResult {
  const state = readState(storeDir);
  if (options.authorizationVersion !== state.authorizationVersion) {
    return decodeProjectionResult({
      kind: 'forbidden',
      reason: 'authorization-changed',
    });
  }

  if (compareCursor(options.fromCursor, state.retentionFloor) < 0) {
    return decodeProjectionResult({
      kind: 'resync-required',
      retentionFloor: state.retentionFloor,
      resumeFromCursor: state.retentionFloor,
    });
  }

  const events = readEvents(storeDir).filter((event) => compareCursor(event.identity.cursor, options.fromCursor) > 0);
  return decodeProjectionResult({
    kind: 'events',
    events,
    lastCursor: events.at(-1)?.identity.cursor ?? options.fromCursor,
  });
}

function computeInvariants(
  storeDir: string,
  projections: ScenarioTrace['projections'],
): ScenarioTrace['invariants'] {
  const events = readEvents(storeDir);
  const checkpoint = readCheckpoint(storeDir);
  const state = readState(storeDir);

  const byAttempt = new Map<number, number[]>();
  for (const event of events) {
    const sequences = byAttempt.get(event.identity.attempt) ?? [];
    sequences.push(event.identity.sequence);
    byAttempt.set(event.identity.attempt, sequences);
  }

  const eventSequenceMonotonic = [...byAttempt.values()].every((sequences) =>
    sequences.every((sequence, index) => index === 0 || sequences[index - 1]! < sequence),
  );

  const authorizedReconnectReachedTerminal = projections.authorizedReconnect?.kind === 'events'
    ? projections.authorizedReconnect.events.some((event) =>
      event.type === 'research-completed' || event.type === 'research-cancelled' || event.type === 'research-failed',
    )
    : false;

  return {
    eventSequenceMonotonic,
    duplicateSideEffectRate: state.sideEffects.collectEvidenceCommitted
      ? Math.max(0, state.sideEffects.collectEvidenceExecutions - 1)
      : 0,
    disconnectDoesNotCancel: state.status !== 'cancelled',
    authorizedReconnectReachedTerminal,
    unauthorizedReconnectDenied: projections.unauthorizedReconnect?.kind === 'forbidden',
    cancelObservedWithinMs: state.cancelRequestedAtMs === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, state.clockMs - state.cancelRequestedAtMs),
    noEventPayloadExceededLimit: events.every((event) => event.serializedBytes <= EVENT_PAYLOAD_TARGET_BYTES),
    noCheckpointExceededLimit: checkpoint.serializedBytes <= CHECKPOINT_TARGET_BYTES,
  };
}

function collectScenarioTrace(
  scenarioId: ScenarioId,
  storeDir: string,
  options: {
    projections?: ScenarioTrace['projections'];
    recovery?: ScenarioTrace['recovery'];
  } = {},
): ScenarioTrace {
  const state = readState(storeDir);
  const checkpoint = readCheckpoint(storeDir);
  const events = readEvents(storeDir);
  const auditLog = readAuditLog(storeDir);
  const projections = options.projections ?? {};

  return {
    scenarioId,
    storeDir,
    runId: state.runId,
    attemptCount: state.attempt,
    finalState: {
      status: state.status,
      terminalEventType: state.terminalEventType,
      sideEffects: {
        collectEvidenceExecutions: state.sideEffects.collectEvidenceExecutions,
      },
    },
    checkpoint,
    events,
    auditLog,
    invariants: computeInvariants(storeDir, projections),
    projections,
    ...(options.recovery ? { recovery: options.recovery } : {}),
  };
}

export async function runDurabilityScenario(
  scenarioId: ScenarioId,
  options: RunOptions,
): Promise<ScenarioTrace> {
  ensureScenario(scenarioId);
  resetStore(options.storeDir);
  ensureStoreDir(options.storeDir);
  readState(options.storeDir);

  switch (scenarioId) {
    case 'disconnect-reconnect': {
      performAttempt(options.storeDir, {});
      const events = readEvents(options.storeDir);
      const reconnectFrom = events[1]?.identity.cursor ?? cursorFor(1, 1);
      const projections = {
        authorizedReconnect: projectResearchEvents(options.storeDir, {
          fromCursor: reconnectFrom,
          authorizationVersion: 1,
        }),
      };
      return collectScenarioTrace(scenarioId, options.storeDir, { projections });
    }

    case 'explicit-cancel-before-boundary': {
      performAttempt(options.storeDir, {
        requestCancelBeforeBoundary: true,
      });
      return collectScenarioTrace(scenarioId, options.storeDir);
    }

    case 'duplicate-cancel': {
      performAttempt(options.storeDir, {
        requestCancelBeforeBoundary: true,
        requestDuplicateCancel: true,
      });
      return collectScenarioTrace(scenarioId, options.storeDir);
    }

    case 'restart-after-checkpoint': {
      try {
        performAttempt(options.storeDir, {
          crashPoint: 'after-checkpoint',
        });
      } catch (error) {
        if (!(error instanceof IntentionalCrashError)) {
          throw error;
        }
      }
      const recovery = resumeAfterCrash(options.storeDir);
      if (!recovery.recoveredTerminal) {
        performAttempt(options.storeDir, {
          resumedFromAttempt: 1,
          recoveryMode: recovery.recoveryMode,
        });
      }
      return collectScenarioTrace(scenarioId, options.storeDir, {
        recovery: {
          resumedFromCheckpoint: true,
          freshProcessRequired: false,
          reconciliation: recovery.recoveryMode,
        },
      });
    }

    case 'restart-after-domain-effect': {
      try {
        performAttempt(options.storeDir, {
          crashPoint: 'after-domain-effect',
        });
      } catch (error) {
        if (!(error instanceof IntentionalCrashError)) {
          throw error;
        }
      }
      const recovery = resumeAfterCrash(options.storeDir);
      if (!recovery.recoveredTerminal) {
        performAttempt(options.storeDir, {
          resumedFromAttempt: 1,
          recoveryMode: recovery.recoveryMode,
        });
      }
      return collectScenarioTrace(scenarioId, options.storeDir, {
        recovery: {
          resumedFromCheckpoint: true,
          freshProcessRequired: false,
          reconciliation: recovery.recoveryMode,
        },
      });
    }

    case 'restart-after-completion-terminal-append': {
      try {
        performAttempt(options.storeDir, {
          crashPoint: 'after-completed-terminal-append',
        });
      } catch (error) {
        if (!(error instanceof IntentionalCrashError)) {
          throw error;
        }
      }
      const recovery = resumeAfterCrash(options.storeDir);
      return collectScenarioTrace(scenarioId, options.storeDir, {
        recovery: {
          resumedFromCheckpoint: true,
          freshProcessRequired: false,
          reconciliation: recovery.recoveryMode,
        },
      });
    }

    case 'restart-after-cancellation-terminal-append': {
      try {
        performAttempt(options.storeDir, {
          requestCancelBeforeBoundary: true,
          crashPoint: 'after-cancelled-terminal-append',
        });
      } catch (error) {
        if (!(error instanceof IntentionalCrashError)) {
          throw error;
        }
      }
      const recovery = resumeAfterCrash(options.storeDir);
      return collectScenarioTrace(scenarioId, options.storeDir, {
        recovery: {
          resumedFromCheckpoint: true,
          freshProcessRequired: false,
          reconciliation: recovery.recoveryMode,
        },
      });
    }

    case 'large-artifact-reference': {
      performAttempt(options.storeDir, {});
      return collectScenarioTrace(scenarioId, options.storeDir);
    }

    case 'late-cancel-after-terminal': {
      performAttempt(options.storeDir, {});
      requestCancellation(options.storeDir, CANCELLATION_REASON);
      return collectScenarioTrace(scenarioId, options.storeDir);
    }

    case 'expired-cursor-gap': {
      performAttempt(options.storeDir, {});
      const state = readState(options.storeDir);
      const events = readEvents(options.storeDir);
      state.retentionFloor = events[2]?.identity.cursor ?? cursorFor(1, 3);
      writeState(options.storeDir, state);
      const projections = {
        authorizedReconnect: projectResearchEvents(options.storeDir, {
          fromCursor: cursorFor(1, 1),
          authorizationVersion: 1,
        }),
      };
      return collectScenarioTrace(scenarioId, options.storeDir, { projections });
    }

    case 'authorization-changed-before-reconnect': {
      performAttempt(options.storeDir, {});
      const state = readState(options.storeDir);
      state.authorizationVersion = 2;
      writeState(options.storeDir, state);
      const projections = {
        unauthorizedReconnect: projectResearchEvents(options.storeDir, {
          fromCursor: cursorFor(1, 2),
          authorizationVersion: 1,
        }),
      };
      return collectScenarioTrace(scenarioId, options.storeDir, { projections });
    }

    case 'cancel-during-checkpoint-persistence': {
      performAttempt(options.storeDir, {
        requestCancelDuringCheckpoint: true,
      });
      return collectScenarioTrace(scenarioId, options.storeDir);
    }
  }
}

export async function runRestartPhase(
  phase: RestartPhase,
  options: { storeDir: string },
): Promise<{ exitCode: number; trace?: ScenarioTrace }> {
  ensureStoreDir(options.storeDir);
  if (phase === 'crash') {
    if (!existsSync(statePath(options.storeDir))) {
      resetStore(options.storeDir);
      readState(options.storeDir);
    }

    try {
      performAttempt(options.storeDir, {
        crashPoint: 'after-checkpoint',
      });
      return { exitCode: 0 };
    } catch (error) {
      if (error instanceof IntentionalCrashError) {
        return { exitCode: error.exitCode };
      }
      throw error;
    }
  }

  const recovery = resumeAfterCrash(options.storeDir);
  if (!recovery.recoveredTerminal) {
    performAttempt(options.storeDir, {
      resumedFromAttempt: 1,
      recoveryMode: recovery.recoveryMode,
    });
  }
  const trace = collectScenarioTrace('restart-after-checkpoint', options.storeDir, {
    recovery: {
      resumedFromCheckpoint: true,
      freshProcessRequired: true,
      reconciliation: recovery.recoveryMode,
    },
  });
  writeFileSync(internalRestartTracePath(options.storeDir), `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
  return { exitCode: 0, trace };
}

export async function runRestartScenarioCli(options: {
  cwd: string | URL;
  storeDir: string;
  tracePath: string;
}): Promise<RestartCliResult> {
  const cwd = typeof options.cwd === 'string' ? options.cwd : fileURLToPath(options.cwd);
  const child = Bun.spawn(
    ['bun', 'run', 'src/restart-driver.ts', '--store-dir', options.storeDir, '--trace-file', options.tracePath],
    {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return {
    exitCode,
    stdout,
    stderr,
    tracePath: options.tracePath,
  };
}

export function readInternalRestartTrace(storeDir: string): ScenarioTrace {
  return JSON.parse(readFileSync(internalRestartTracePath(storeDir), 'utf8')) as ScenarioTrace;
}

export function defaultPackageRoot(): string {
  return packageRootFromModule();
}
