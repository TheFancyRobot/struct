# Validation Plan

## Acceptance Checks

- The slice for Web Object Storage and Export Connectors is implemented through typed module boundaries in the planned files (`packages/ingestion/src/connectors/web-snapshot.ts`, `packages/ingestion/src/connectors/object-storage.ts`, `packages/ingestion/src/connectors/export-import.ts`...).
- An observable path exists from the new code to the adjacent API, worker, persistence, or UI surface it must support.
- The result advances connector extensibility without expanding trust boundaries without bypassing provenance, bounded execution, or validation expectations.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Run an integration flow that exercises the API/worker boundary touched by this step, including failure handling.

## Edge Cases

- Partial progress, retries, or restarts should not leave Web Object Storage and Export Connectors in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Deleted files, renamed files, permission errors, and partially reachable sources should preserve lineage and recovery paths.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_01_define-a-secure-connector-framework|STEP-11-01 Define a Secure Connector Framework]] rather than reworking already-planned scope upstream.
- Do not weaken existing local-file and dataset guarantees while adding web, object-storage, or export connectors.
- Keep credential handling, retries, and partial failures explicit and typed.
- Make sure connector outputs still feed the same evaluation, refresh, and report paths as first-party sources.

## Security / Observability / Evaluation Focus

- Protect secrets, access tokens, and remote-source scopes from leakage into prompts, logs, or exports.
- Validate remote content as untrusted evidence exactly like local content.
- Cover connector-specific recovery, provenance, and prompt-injection cases before widening rollout.

## Related Notes

- Step: [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_02_add-web-object-storage-and-export-connectors|STEP-11-02 Add Web Object Storage and Export Connectors]]
- Phase: [[02_Phases/Phase_11_v1_2_additional_sources/Phase|Phase 11 v1 2 additional sources]]
