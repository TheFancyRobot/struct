# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Extended the existing `packages/observability` path rather than introducing another telemetry abstraction or vendor. Operational boundaries now cover request, workspace, run, job, tool, database, sidecar, SSE, and report with fixed success/failure counters and bounded correlation IDs.
- `observeBoundary` captures the original Effect `Exit` inside a successful telemetry envelope, records only sanitized outcome/classification/error-tag attributes, then replays the exact success, typed failure, or interruption outside the span. This prevents automatic OpenTelemetry exception serialization from exporting raw nested errors, causes, messages, or stacks.
- Added deterministic recursive redaction and 4,096-byte support diagnostics. Sensitive keys, credential/email patterns, deep nesting, long arrays, excessive fields, and invalid correlation IDs are redacted, truncated, or rejected.
- Split process liveness (`/healthz`) from typed dependency readiness (`/readyz`) for API and worker. Production application verification now gates on readiness while dependency verification retains the authenticated sidecar check.
- Instrumented database readiness, data-engine queries, SSE scope/polls, and report publish/read paths through the existing Effect observability module.
- Added the v1 dashboard/alert contract and seven incident runbooks.
- Found an existing uncancelled `Promise.race` deadline in `scripts/v1-performance-gate.ts` that retained a 600-second timer after successful completion. The deadline is now cleared in `finally`, with a real subprocess exit regression probe.

## Related Notes

- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_04_complete-observability-operations-and-incident-runbooks|STEP-09-04 Complete Observability Operations and Incident Runbooks]]
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
