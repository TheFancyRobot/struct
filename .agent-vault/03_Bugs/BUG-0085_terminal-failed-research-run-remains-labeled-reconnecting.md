---
note_type: bug
template_version: 2
contract_version: 1
title: Terminal failed research run remains labeled Reconnecting
bug_id: BUG-0085
status: fixed
severity: sev-2
category: ux
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: bug_0085
created: '2026-07-28'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0085 - Terminal failed research run remains labeled Reconnecting

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Terminal failed research run remains labeled Reconnecting.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** A real run reaches terminal `Research failed` with an alert, but the Research progress header continues to show `Reconnecting` indefinitely, implying work may resume.
- **Expected:** Terminal failed/cancelled/completed runs stop reconnection UI and display the terminal status.
- **Reproduction:** Submit a source-grounded question that completes with insufficient evidence, wait for the failed event, and inspect the status header.
- **Evidence:** `.local/ui-audit/lead/screenshots/failed-research-still-reconnecting.png`; independently observed in `.local/ui-audit/inventory.md`.

## Observed Behavior

- On the ResearchPage route `/projects/:projectId/research/:threadId/runs/:runId`, once a run reaches the terminal `research-failed` state, the "Research progress" header continues to show an orange/rust `badge-warning` labeled **Reconnecting** next to the title.
- The timeline below renders the full event history ending in a **Research failed** entry with an `alert-warning` banner (e.g. the `EvidenceInsufficientError` guidance: "The selected documents did not contain enough support for an answer…").
- The terminal failure alert and the "Reconnecting" transport badge are displayed simultaneously, implying the run may resume when it has already terminated and will emit no further events.
- Evidence: `.local/ui-audit/lead/screenshots/failed-research-still-reconnecting.png` — the badge reads "Reconnecting" while the timeline's final entry is "Research failed"; independently recorded in `.local/ui-audit/inventory.md` §7 ("ResearchPage SSE 'Reconnecting' status persists").
- Source: `apps/web/src/components/ResearchStream.tsx` — the legacy-progress status badge is `{connection.connected() ? 'Live' : connection.reconnecting() ? 'Reconnecting' : 'Connecting'}`, driven solely by SSE transport state, not by the run's lifecycle state.

## Expected Behavior

- Terminal runs (`research-failed`, `research-cancelled`, `research-completed`) must stop SSE reconnection attempts and the status badge must display the terminal run status (e.g. Failed / Cancelled / Completed) instead of Live / Reconnecting / Connecting.
- A terminal run emits no further events, so continued reconnection is meaningless and misleading; the badge should pin to the terminal status once the terminal event is observed.

## Reproduction Steps

1. Setup: live local dev stack (`apps/api` + `apps/web`), a project with at least one ready source.
2. Submit a source-grounded research question whose retrieval yields zero evidence (`retrieval-completed` with `evidenceCount: 0`) so the workflow emits `research-failed` with `errorTag: 'EvidenceInsufficientError'`.
3. Wait for the failed event and inspect the "Research progress" status header.
4. Observed: the header badge shows "Reconnecting" (SSE transport state) while the timeline's final entry shows "Research failed" with the insufficient-evidence alert (see `.local/ui-audit/lead/screenshots/failed-research-still-reconnecting.png`).

## Scope / Blast Radius

- Affected source: `apps/web/src/components/ResearchStream.tsx` (legacy-progress status badge is transport-driven) and `apps/web/src/hooks/useSSE.ts` (no run-level terminal handling — `terminated` is set only by `stream-error`, decode errors, or `SSE_BACKOFF.maxRetries` exceeded).
- The recursive-analysis path passes the same transport-driven `connected`/`reconnecting` props to `RecursiveRunTimeline`, so it likely shares the symptom; the reported evidence is the legacy (non-recursive) path shown in the screenshot.
- Route affected: `/projects/:projectId/research/:threadId/runs/:runId` (ResearchPage live stream).
- Users affected: anyone viewing a completed/failed/cancelled research run after the SSE transport drops — they see a misleading "Reconnecting" badge on a run that is already terminal.
- Environment: observed on the live local dev stack; e2e specs mock the SSE endpoint (`apps/web/e2e/walking-skeleton.spec.ts`) so they do not surface this transport/run-state mismatch.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- `useSSE` models only SSE *transport* state. Its `terminated` flag is set exclusively by transport-level failures: a named `stream-error` event, a decode/reduce error, or exceeding `SSE_BACKOFF.maxRetries` (10) — see `stopWithError` and the `onerror` handler in `apps/web/src/hooks/useSSE.ts`. The `onEvent` callback receives run-level terminal events (`research-failed`/`research-completed`/`research-cancelled`) but the hook is never told the run is terminal, so it never stops reconnecting.
- The server's event stream (`apps/api/src/routes/research-events.ts` `researchEventsResponse`) is a polling stream that does NOT close after a terminal event: it polls the event journal every `POLL_INTERVAL_MS` (1s) and emits heartbeats every `HEARTBEAT_INTERVAL_MS` (30s) until the client disconnects. The transport therefore gives the client no "run is done" signal.
- `ResearchStream.tsx` renders the status badge purely from transport state: `{connection.connected() ? 'Live' : connection.reconnecting() ? 'Reconnecting' : 'Connecting'}`. When the transport drops after the run is already terminal (network blip, dev-stack restart, proxy idle timeout, etc.), `onerror` fires, `retries` increments, `reconnecting` is set true, and a reconnect is scheduled — pinning the badge to "Reconnecting" on a run that will never emit again. The terminal `research-failed` alert is rendered from the event timeline, independent of the badge, so both appear together.
- Decisive evidence: screenshot shows the "Reconnecting" badge and the "Research failed" alert simultaneously; `useSSE.ts` has no run-terminal code path; `research-events.ts` has no terminal-close path; `ResearchStream.tsx`'s badge is transport-only.

## Workaround

- No in-product workaround. Refreshing the page reloads the persisted timeline, but because the badge is transport-driven (not run-driven) the misleading "Reconnecting" badge can reappear if the SSE transport drops again on the already-terminal run; the root cause is unresolved.

## Permanent Fix Plan

- Introduce run-level terminal state into the SSE consumer. Preferred root-cause fix is in the shared hook (`apps/web/src/hooks/useSSE.ts`): add a clean-terminal path sibling to `stopWithError` — e.g. accept terminal event types (or a `shouldStop` predicate) and, when `onEvent` observes a run-terminal event (`research-failed`/`research-cancelled`/`research-completed`), set `terminated = true`, close the source, cancel any pending retry timer, and clear `reconnecting`/`error` so the badge reflects "done" rather than "Reconnecting". One guard in the shared hook fixes every caller rather than per-caller overrides.
- In `apps/web/src/components/ResearchStream.tsx`, once the hook reports a clean terminal stop, drive the legacy-progress badge from the run's terminal status (Failed/Cancelled/Completed) instead of `connection.connected()`/`reconnecting()`. Derive a `terminal` memo from the event timeline as a fallback so the UI is correct even if the terminal event arrived before the transport dropped.
- Optional server-side hardening: `research-events.ts` `researchEventsResponse` could close the stream after emitting a terminal event, giving clients a clean transport-level end. The client fix is still required because a drop can occur before or at the terminal event, so the client must model terminal state regardless.

## Regression Coverage Needed

- `apps/web/src/hooks/useSSE.test.ts`: add a case that delivers a terminal event (e.g. `research-failed`) and asserts `reconnecting()` is false, the source is closed, and no reconnect is scheduled — mirroring the existing `stream-error` terminal test.
- `apps/web/e2e/walking-skeleton.spec.ts`: the existing "insufficient-evidence" and "unsupported typed-format failure" tests assert the `research-failed` alert but NOT the status badge. Add an assertion that the "Research progress" badge does not read "Reconnecting" after `research-failed` (it should show the terminal status).
- Add a regression e2e that forces a transport drop after a terminal event (e.g. closes the mocked SSE body after emitting `research-failed`) and asserts the badge remains on the terminal status rather than flipping to "Reconnecting".
- Audit the recursive path (`RecursiveRunTimeline`) for the same transport-driven badge symptom when a recursive run reaches a terminal state.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-03 - Fixed: `useSSE` now closes terminal research streams without scheduling a reconnect; `ResearchStream` pins the badge to Failed, Cancelled, or Completed after the terminal event. Verified with `bun test --preload ./test/solid-test-preload.ts src/hooks/useSSE.test.ts src/components/research-stream-status.test.ts`, `bun run typecheck`, `bun run build`, and `bun test --timeout 60000 --max-concurrency 1 e2e/walking-skeleton.spec.ts` from `apps/web`.
