---
note_type: phase
template_version: 2
contract_version: 1
title: Walking Skeleton
phase_id: PHASE-01
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries|DEC-0003 Use TypeScript Bun and Effect with Explicit Runtime Boundaries]]'
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]'
  - '[[04_Decisions/DEC-0015_use-per-step-branch-pr-review-and-merge-gates|DEC-0015 Use Per-Step Branch PR Review and Merge Gates]]'
related_bugs:
  - '[[03_Bugs/BUG-0001_research-completion-rejects-serialized-postgresql-jsonb-payloads|BUG-0001 Research completion rejects serialized PostgreSQL JSONB payloads]]'
  - '[[03_Bugs/BUG-0002_sourceversion-ingestion-attempt-accepts-forged-aggregate-scope|BUG-0002 SourceVersion ingestion attempt accepts forged aggregate scope]]'
  - '[[03_Bugs/BUG-0003_source-registration-persists-unauthorized-mismatched-aggregate-scope|BUG-0003 Source registration persists unauthorized mismatched aggregate scope]]'
  - '[[03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery|BUG-0004 Source text reindex lacks continuous lease renewal and database clock recovery]]'
  - '[[03_Bugs/BUG-0005_canonical-duckdb-runtime-documentation-contradicts-bun-only-host-boundary|BUG-0005 Canonical DuckDB runtime documentation contradicts Bun only host boundary]]'
  - '[[03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads|BUG-0006 Job transitions persist unvalidated cross-domain journal payloads]]'
  - '[[03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order|BUG-0007 Event journal cursors can commit out of replay order]]'
  - '[[03_Bugs/BUG-0008_generic-eventjournal-append-bypasses-typed-transition-contracts|BUG-0008 Generic EventJournal append bypasses typed transition contracts]]'
  - '[[03_Bugs/BUG-0009_source-registration-persists-extra-sensitive-payload-fields|BUG-0009 Source registration persists extra sensitive payload fields]]'
tags:
  - agent-vault
  - phase
  - v1
---

# Phase 01 Walking Skeleton

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Deliver the first independently testable vertical slice: create a project, ingest one text source, run one Fred workflow over deterministic retrieval, stream progress, persist state, and navigate one valid citation.

## Why This Phase Exists

- A narrow end-to-end path validates architectural seams early and establishes production-quality conventions without spreading effort across incomplete feature breadth.

## Scope

- Scaffold the Bun/TypeScript monorepo, web/API/worker runtime boundaries, Effect layers, CI, tests, and local dependencies.
- Create branded domain identifiers, typed failures, initial PostgreSQL migrations, artifact storage, and immutable source-version records.
- Ingest one plain-text source, deterministically index and retrieve passages, and expose retrieval only through typed tools.
- Run one bounded Fred research workflow and persist both Fred checkpoints and product-owned job events.
- Stream replayable SSE progress to a minimal web experience and render a citation that opens the exact source span.
- Instrument the slice and document setup, migrations, recovery, and known constraints.

## Non-Goals

- PDF/Office parsing, directory recursion, vector retrieval, datasets, recursive decomposition, or polished report authoring.
- Using model-generated retrieval identifiers or citations without deterministic validation.
- Treating the walking skeleton as a disposable prototype.

## Dependencies

- Depends on [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]].

## Acceptance Criteria

- [ ] A new project can be created and reopened after process restart.
- [ ] One text file produces an immutable source version and retrievable, content-addressed artifacts.
- [ ] A Fred workflow answers a fixture question using only a typed deterministic retrieval tool.
- [ ] Progress events are persisted before delivery, stream live over SSE, and replay after reconnect without duplication.
- [ ] The answer contains a validated citation that navigates to the exact stored source span and version.
- [ ] PostgreSQL state, artifacts, job state, checkpoints, and the completed answer survive restart.
- [ ] Automated unit, integration, workflow, API/SSE, browser, migration, and restart tests pass in CI.
- [ ] Traces and structured logs correlate project, source version, research run, workflow run, tool call, and citation without leaking source text or secrets.

## Delivery Strategy

- **Safe parallel work:** After the domain and migration contracts are fixed, ingestion/storage and web/SSE work can proceed in parallel; the end-to-end workflow and restart test integrate both lanes.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]
<!-- AGENT-END:phase-linear-context -->

## Related Architecture

<!-- AGENT-START:phase-related-architecture -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
<!-- AGENT-END:phase-related-architecture -->

## Related Decisions

<!-- AGENT-START:phase-related-decisions -->
- [[04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries|DEC-0003 Use TypeScript Bun and Effect with Explicit Runtime Boundaries]]
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- [[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]
- [[04_Decisions/DEC-0015_use-per-step-branch-pr-review-and-merge-gates|DEC-0015 Use Per-Step Branch PR Review and Merge Gates]]
<!-- AGENT-END:phase-related-decisions -->
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- [[03_Bugs/BUG-0001_research-completion-rejects-serialized-postgresql-jsonb-payloads|BUG-0001 Research completion rejects serialized PostgreSQL JSONB payloads]]
- [[03_Bugs/BUG-0002_sourceversion-ingestion-attempt-accepts-forged-aggregate-scope|BUG-0002 SourceVersion ingestion attempt accepts forged aggregate scope]]
- [[03_Bugs/BUG-0003_source-registration-persists-unauthorized-mismatched-aggregate-scope|BUG-0003 Source registration persists unauthorized mismatched aggregate scope]]
- [[03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery|BUG-0004 Source text reindex lacks continuous lease renewal and database clock recovery]]
- [[03_Bugs/BUG-0005_canonical-duckdb-runtime-documentation-contradicts-bun-only-host-boundary|BUG-0005 Canonical DuckDB runtime documentation contradicts Bun only host boundary]]
- [[03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads|BUG-0006 Job transitions persist unvalidated cross-domain journal payloads]]
- [[03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order|BUG-0007 Event journal cursors can commit out of replay order]]
- [[03_Bugs/BUG-0008_generic-eventjournal-append-bypasses-typed-transition-contracts|BUG-0008 Generic EventJournal append bypasses typed transition contracts]]
- [[03_Bugs/BUG-0009_source-registration-persists-extra-sensitive-payload-fields|BUG-0009 Source registration persists extra sensitive payload fields]]
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [x] [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]
- [x] [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]
- [ ] [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- [ ] [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
- [ ] [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]]
- [ ] [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
- Skill requirements by domain: [[06_Shared_Knowledge/Skill_Requirements|Skill Requirements]] — backend agents must read Effect-TS skills; frontend agents must read SolidJS skills before writing code.
