# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Web Object Storage and Export Connectors that advances v1.2 Additional Sources while preserving connector extensibility without expanding trust boundaries.

## Prerequisites

- Re-read [[02_Phases/Phase_12_v1_2_additional_sources/Phase|Phase 12 v1 2 additional sources]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_12_v1_2_additional_sources/Steps/Step_01_define-a-secure-connector-framework|STEP-12-01 Define a Secure Connector Framework]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/ingestion/src/connectors/web-snapshot.ts`
- `packages/ingestion/src/connectors/object-storage.ts`
- `packages/ingestion/src/connectors/export-import.ts`
- `apps/api/src/routes/connectors.ts`

## Required Reading

- [[02_Phases/Phase_12_v1_2_additional_sources/Phase|Phase 12 v1 2 additional sources]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_12_v1_2_additional_sources/Steps/Step_01_define-a-secure-connector-framework|STEP-12-01 Define a Secure Connector Framework]]
- `docs/product-brief.md` sections 10, 16, 18-25, 28-29, and 31.

## Smallest Bounded Checklist

- Implement web-snapshot and S3-compatible object connectors through the approved connector capability and credential contracts.
- Map every remote object or snapshot to an immutable local source version with origin URI, revision metadata, content hash, and retrieval policy.
- Implement bounded pagination, rate limiting, retries, deletion/change detection, credential redaction, and resumable cursors.
- Add conformance fixtures for partial failure, revoked credentials, upstream mutation, robots/licensing policy, export round trips, and recovery.

## Constraints and Non-Goals

- Connector abstractions must preserve provenance, source-versioning, and explicit authorization boundaries across source types.
- Every connector should be sandboxed, observable, and recoverable before expanding format coverage.
- Do not let connector convenience bypass core ingestion, citation, or retention rules.

## Related Notes

- Step: [[02_Phases/Phase_12_v1_2_additional_sources/Steps/Step_02_add-web-object-storage-and-export-connectors|STEP-12-02 Add Web Object Storage and Export Connectors]]
- Phase: [[02_Phases/Phase_12_v1_2_additional_sources/Phase|Phase 12 v1 2 additional sources]]
