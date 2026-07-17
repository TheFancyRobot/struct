# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The concrete contract for Security Threat Model and Trust Boundaries in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/ingestion/src/path-safety.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The data-engine boundary in `packages/data-engine/src/sql-policy.ts` with deterministic execution, explicit limits, and source-linked outputs.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/data-engine packages/ingestion` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.
- Review the paired doc/ADR/runbook output to confirm it matches the code-facing contract and names operator/developer prerequisites explicitly.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Authorization failures, secret exposure, and audit-log gaps should be treated as first-class failures, not documentation nits.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_04_specify-repository-architecture-contracts-and-local-stack|STEP-00-04 Specify Repository Architecture Contracts and Local Stack]] rather than reworking already-planned scope upstream.
- Do not narrow or contradict the product brief, architecture notes, or phase sequencing without an explicit follow-up decision note.
- Do not invent package APIs that imply implementation already exists; keep language and artifacts clearly planned or spike-scoped.
- Make sure later Phase 1 work can start from these outputs without re-litigating repository layout, security boundaries, or evaluation gates.

## Security / Observability / Evaluation Focus

- Model all imported content as untrusted evidence and keep prompt-injection defenses visible in the design outputs.
- Call out checkpoint, event, filesystem, and SQL trust boundaries wherever a spike touches them.
- Prefer observable, restart-safe designs over opaque runtime magic.
- Audit all newly exposed boundaries for least privilege, secret hygiene, and safe error sanitization before widening rollout.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refined Acceptance Contract

### Completeness Checks

- Every asset/trust-boundary pair has an owner, enforcement location, authorization rule, safe failure, and audit requirement.
- Every abuse case has a preventive or detective control and at least one planned automated/adversarial/recovery test; otherwise it has an accepted residual risk with owner and due phase.
- Every resource/security limit is numeric or marked `TBD` with owner, evidence, fail-closed default, and calibration phase.
- The matrix covers filesystem, source parsing, model/tool authority, SQL/DuckDB, workspace authorization, secrets, events/checkpoints, retry/resume, denial of service, privacy/retention, and error sanitization.
- The STEP-00-06 handoff maps each accepted abuse category to expected safe behavior and required observable evidence.

### Documentation Validation

Run from the repository root:

```bash
git diff --check
rg -n "trust boundary|workspace|symlink|traversal|prompt injection|ATTACH|INSTALL|LOAD|secret|quota|cancel|audit|retention" docs/security-model.md
```

Then manually cross-check `docs/security-model.md`, `docs/architecture.md`, DEC-0009, STEP-00-03's chosen topology, and the refined step artifacts for contradictions. Phase 0 does not run the future `bun test packages/ingestion packages/data-engine` commands; record those in the test matrix for the implementing phases.

### Edge, Recovery, Privacy, and Performance Review

- Include encoded traversal, symlink races/cycles, devices/sockets, oversized/corrupt inputs, unsupported archives/OCR, SQL escape variants, output exhaustion, cancellation during persistence/query, duplicate retry, cross-workspace citation open, retention/deletion, and secret leakage through errors/logs/events.
- Resource budgets are security controls. Name the owner for file count/bytes, parser time, query time/memory/rows/bytes, concurrency, model/tool calls, recursive fan-out, SSE subscriptions, and event retention.
- Examples and fixtures contain no real secrets, PII, or private host paths.
- Each failure defines fail-closed behavior, typed/sanitized user response, durable audit/trace evidence, and recovery/operator follow-up.

### Pass / Fail and Handoff

- **PASS:** matrices are complete, cross-document review is consistent, no silent TBD remains, and STEP-00-06 receives a concrete adversarial/limits/sanitization handoff.
- **FAIL:** a model or source can widen authority, arbitrary paths or unsafe SQL remain possible by policy, secrets/PII enter fixtures, ownership is missing, or a high-risk threat lacks a control/accepted risk.
- Implementation tests remain downstream work; this step passes on a complete, internally consistent, testable security contract.