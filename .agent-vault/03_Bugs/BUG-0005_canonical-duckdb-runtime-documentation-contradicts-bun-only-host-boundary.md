---
note_type: bug
template_version: 2
contract_version: 1
title: Canonical DuckDB runtime documentation contradicts Bun only host boundary
bug_id: BUG-0005
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: duckdb-runtime-docs-remediation
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
tags:
  - agent-vault
  - bug
---

# BUG-0005 - Canonical DuckDB runtime documentation contradicts Bun only host boundary

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Canonical DuckDB runtime documentation contradicts Bun only host boundary.
- Related notes: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].

## Observed Behavior

- Describe what actually happens.
- Canonical local-development, repository, architecture, and security contracts promoted STEP-00-03's host child-process topology and Node fallback as the v1 production boundary, including statements that DuckDB would not be containerized.
- This conflicted with the maintained repository's Bun-only host runtime and with the selected Phase-04 isolated sidecar direction.

## Expected Behavior

- Describe what should happen instead.
- Bun is the sole maintained host runtime for applications, workspaces, scripts, tests, and tooling.
- The current `docker-compose.yml` is described truthfully as PostgreSQL-only.
- Phase 04 plans an isolated DuckDB container/sidecar whose pinned internal adapter runtime does not become a host prerequisite; exact image, protocol, mounts, health, resource, cancellation, and restart details are refined before implementation.
- STEP-00-03 child-process measurements remain explicitly historical evidence rather than canonical production topology.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.
- Canonical runtime and data-plane boundaries in `docs/architecture.md`, `docs/local-development.md`, `docs/repository-contract.md`, `docs/security-model.md`, `docs/implementation-plan.md`, and the DEC-0003/DEC-0005 ADR mirrors.
- Durable vault architecture, DEC-0003/DEC-0005, and PHASE-04 acceptance/scope.
- Phase-00 spike artifacts remain unchanged except where canonical security prose now labels their role as historical.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- Canonical local-development guidance retained the Phase-00 child-process Node fallback and stated DuckDB would never be containerized, contradicting the accepted Bun-only maintained-host contract and the user-directed isolated container boundary for Phase 04.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Completed: reconciled canonical docs and vault decisions to the Bun-only maintained-host contract and planned Phase-04 sidecar boundary.
- Completed: removed the host Node fallback and false claims that DuckDB is already implemented or prohibited from containerization.
- Completed: added Phase-04 security and acceptance requirements for authenticated bounded access, approved mounts only, no egress/Docker socket, non-root/resource-limited execution, cancellation, and crash/restart recovery.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Documentation consistency search must find no canonical host DuckDB child, Node fallback, or never-containerized requirement outside explicitly historical text.
- Compose inspection must prove the present file defines PostgreSQL only.
- Phase-04 refinement and implementation must verify the sidecar acceptance and security controls before DuckDB readiness is claimed.
- Completed: strict negative scan rejects residual active Phase-04 worker-process, host Node fallback, and non-container guidance; positive scan requires historical/superseded labeling plus the DEC-0003/DEC-0005 sidecar handoff across the spike and linked Vault artifacts.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
<!-- AGENT-END:bug-related-notes -->
- Session: [[05_Sessions/2026-07-19-022106-implement-deterministic-retrieval-and-fred-research-workflow-duckdb-runtime-docs-remediation|SESSION-2026-07-19-022106 duckdb-runtime-docs-remediation]]
- Runtime decision: [[04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries|DEC-0003 Use TypeScript Bun and Effect with Explicit Runtime Boundaries]]
- Data-plane decision: [[04_Decisions/DEC-0005_use-duckdb-and-parquet-for-the-deterministic-data-plane|DEC-0005 Use DuckDB and Parquet for the Deterministic Data Plane]]
- Owning future phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19 - Fixed canonical contracts and durable decisions; preserved STEP-00-03 as historical evidence; validation recorded in [[05_Sessions/2026-07-19-022106-implement-deterministic-retrieval-and-fred-research-workflow-duckdb-runtime-docs-remediation|SESSION-2026-07-19-022106 duckdb-runtime-docs-remediation]].
- 2026-07-19 - Independent adversarial follow-up found three residual future-facing `process/container` permissions. Narrowed `docs/architecture.md`, DEC-0003, and STEP-01-06's execution brief to a pinned container/service image; explicitly prohibited a DuckDB host child or native adapter in maintained host applications. Targeted ambiguity search, PostgreSQL-only Compose inspection, typecheck, lint, import-boundary validation, and vault doctor/all passed.
- 2026-07-19 - Final independent review found the residual contradiction inside STEP-00-03 historical artifacts: their selected-at-the-time child-process result was still phrased as an active Phase-04/Node-fallback handoff. Added explicit supersession notices to the spike document and every linked STEP-00-03 artifact, retained the measurements, and redirected current Phase-04 guidance to the DEC-0003/DEC-0005 isolated sidecar.
- 2026-07-19 - Final closure review found one surviving authoritative contradiction in `docs/product-brief.md`: its future-instability instruction still permitted direct Node and host-worker candidates. Replaced that instruction with the DEC-0003/DEC-0005 sidecar-only refinement boundary, explicitly preserving DuckDB while forbidding host Node, a host DuckDB child process, and host-loaded native adapters. The brief now links the accepted ADR mirrors and labels STEP-00-03 candidate selection historical/superseded.
- 2026-07-19 - Ultimate closure review found STEP-00-05's Outcome and companion handoffs still called the selected-at-the-time host-child worker topology consistent without its supersession qualifier. Reconciled the STEP-00-05 parent, Implementation Notes, Outcome, and Validation Plan: DEC-0003/DEC-0005 supersede the host-child topology with the pinned Phase-04 container/sidecar, while STEP-00-03 hardening, denial, and measurement evidence remains applicable.
