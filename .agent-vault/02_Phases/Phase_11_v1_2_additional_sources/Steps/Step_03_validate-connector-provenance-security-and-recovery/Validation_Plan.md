# Validation Plan

## Acceptance Checks

- There is explicit validation evidence for Connector Provenance Security and Recovery, not just an assertion that the slice should work.
- The step records blocking defects, remediations, and any follow-up work still needed in the planned artifacts (`packages/evaluation/src/connectors.ts`, `apps/worker/test/connector-recovery.integration.test.ts`, `docs/operations/connectors.md`...).
- The outcome increases confidence in connector extensibility without expanding trust boundaries and in the next roadmap phase rather than only improving appearances.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Make the named integration or scale tests green and capture the exact scenario coverage they provide.
- Run or script the evaluation/benchmark harness for this slice and persist the assumptions behind the numbers.

## Edge Cases

- Partial progress, retries, or restarts should not leave Connector Provenance Security and Recovery in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Deleted files, renamed files, permission errors, and partially reachable sources should preserve lineage and recovery paths.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_02_add-web-object-storage-and-export-connectors|STEP-11-02 Add Web Object Storage and Export Connectors]] rather than reworking already-planned scope upstream.
- Do not weaken existing local-file and dataset guarantees while adding web, object-storage, or export connectors.
- Keep credential handling, retries, and partial failures explicit and typed.
- Make sure connector outputs still feed the same evaluation, refresh, and report paths as first-party sources.

## Security / Observability / Evaluation Focus

- Protect secrets, access tokens, and remote-source scopes from leakage into prompts, logs, or exports.
- Validate remote content as untrusted evidence exactly like local content.
- Cover connector-specific recovery, provenance, and prompt-injection cases before widening rollout.

## Related Notes

- Step: [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_03_validate-connector-provenance-security-and-recovery|STEP-11-03 Validate Connector Provenance Security and Recovery]]
- Phase: [[02_Phases/Phase_11_v1_2_additional_sources/Phase|Phase 11 v1 2 additional sources]]
