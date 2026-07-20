# Execution Brief

## Exact Outcome

- Ship a minimal production-usable identity boundary and enforce authenticated workspace ownership across every externally reachable HTTP, SSE, worker, persistence, artifact, citation, report, source, directory, dataset, and research path.
- Reject missing, invalid, or cross-workspace access without leaking resource existence; centralize secret loading and redaction.

## Prerequisites

- Phase 08 is merged with a functional responsive application and passing 26/26 report-fidelity evaluator.
- Inspect current route composition, ownership repository tests, configuration, `.env.example`, and the secret scan before choosing the smallest integration point.

## Planned Starting Files

- `apps/api/src/main.ts`, `apps/api/src/config.ts`, and `apps/api/src/routes/`
- `apps/worker/src/config.ts` and worker job boundaries
- `packages/persistence/src/repositories/ownership.ts` plus ownership integration tests
- `.env.example`, `scripts/secrets-scan.ts`, and `docs/security-model.md`

## Required Reading

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009]]
- `docs/product-brief.md` security, isolation, and privacy requirements.

## Concrete Deliverables

- Typed identity context with explicit unauthenticated/forbidden failures and fail-closed production configuration.
- Workspace authorization on HTTP, SSE, persistence, and worker entry points, with negative cross-workspace tests.
- Secret configuration/redaction covering API, worker, PostgreSQL, and data-engine credentials.
- Focused security guidance and dependency/security scan evidence.

## Smallest Bounded Checklist

- Inventory externally reachable routes and durable ownership boundaries.
- Implement one shared identity/authorization path through existing composition.
- Add missing-workspace, cross-workspace, guessed-ID, SSE, and background-job negative coverage.
- Run focused and repository-wide gates, secret scanning, and pre-PR affected-code review.

## Constraints and Non-Goals

- Bun is the sole host runtime; PostgreSQL and the authenticated no-egress data-engine remain Docker Compose services.
- Do not preserve legacy behavior or database data, or add an identity platform or speculative abstraction.
- Use the Effect skills for Effect code and the SolidJS skill for SolidJS code.
- Self-review the full diff and affected callers before PR; advance only with zero known confirmed defects.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_01_harden-authentication-workspace-isolation-and-secrets|STEP-09-01]]
- [[05_Sessions/2026-07-20-211503-harden-authentication-workspace-isolation-and-secrets-phase-09-refinement|Phase 09 refinement session]]
