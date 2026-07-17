# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Full Evaluation Campaign and Remediate Gates that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_04_complete-observability-operations-and-incident-runbooks|STEP-09-04 Complete Observability Operations and Incident Runbooks]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/run-v1-gates.ts`
- `.github/workflows/ci.yml`
- `docs/evaluation/v1-report.md`
- `docs/evaluation/remediation-log.md`

## Required Reading

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_04_complete-observability-operations-and-incident-runbooks|STEP-09-04 Complete Observability Operations and Incident Runbooks]]
- `docs/product-brief.md` sections 16, 18-25, 27, and 29-31.

## Concrete Deliverables

- Run the v1 gate suite across security, exact computation, retrieval, recursive analysis, hybrid research, export, accessibility, and recovery.
- Produce a remediation log that ties each failing gate to an owner, fix path, or explicit release blocker decision.
- Publish the evaluation report artifact that justifies the final go/no-go call with corpus assumptions and benchmark context attached.

## Smallest Bounded Checklist

- First, run the v1 gate suite across security, exact computation, retrieval, recursive analysis, hybrid research, export, accessibility, and recovery.
- Then, produce a remediation log that ties each failing gate to an owner, fix path, or explicit release blocker decision.
- Next, publish the evaluation report artifact that justifies the final go/no-go call with corpus assumptions and benchmark context attached.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Treat hardening as evidence-producing work: every claim should be backed by tests, docs, or operational artifacts.
- Protect tenant isolation, secrets, migrations, backups, and rollback paths before optimizing for convenience.
- Do not ship v1 until evaluation, accessibility, and operational runbooks all tell a coherent story.

## Related Notes

- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_05_run-full-evaluation-campaign-and-remediate-gates|STEP-09-05 Run Full Evaluation Campaign and Remediate Gates]]
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
