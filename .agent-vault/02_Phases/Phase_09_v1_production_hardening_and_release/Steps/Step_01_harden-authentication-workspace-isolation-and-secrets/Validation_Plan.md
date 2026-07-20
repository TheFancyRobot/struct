# Validation Plan

## Acceptance Checks

- Every externally reachable API and SSE path requires a valid identity and enforces workspace ownership.
- Missing/invalid credentials, guessed IDs, and cross-workspace reads/writes/streams fail closed without existence leaks.
- Background jobs and repositories cannot cross workspace scope; representative ownership integration tests pass.
- Required secrets are validated at startup and never appear in logs, errors, responses, artifacts, screenshots, or committed files.

## Planned Verification

- Add focused API, SSE, worker, and PostgreSQL ownership tests for allowed and denied paths.
- Run `bun run secrets:scan` plus dependency/security checks supported by the repository.
- Run `bun run typecheck`, `bun run lint`, `bun run lint:imports`, `bun run test`, `bun run test:integration`, `bun run build`, and `bun run docs:lint`.
- Run applicable isolated Playwright journeys when authentication changes browser behavior.

## Edge Cases

- Missing, malformed, expired, replayed, or mismatched identity; guessed UUIDs; SSE reconnect under another workspace.
- Worker retries after identity/workspace removal; resource relationships with mixed workspace IDs.
- Secrets embedded in nested causes, telemetry attributes, validation errors, support diagnostics, or screenshots.

## Regression Expectations

- Existing functional report, citation, ingestion, directory, dataset, research, and recovery paths remain green for authorized users.
- Phase 08's 26/26 evaluator and all current unit/integration/isolated Playwright baselines remain passing.
- Review every caller affected by identity threading in the same edit round.

## Security / Observability / Evaluation Focus

- Assert least privilege, fail-closed configuration, constant-shape denied responses, correlation without secret content, and explicit audit events.
- A confirmed defect blocks advancement; review feedback is verified before repair.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_01_harden-authentication-workspace-isolation-and-secrets|STEP-09-01]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009]]
