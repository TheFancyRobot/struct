# Execution Brief

- Prerequisites: Phase 09 authorization and workspace isolation remain intact; no post-v1 navigation work begins.
- Required reading: approved design and implementation plan in `docs/superpowers/`; `docs/product-brief.md`; DEC-0003, DEC-0008, DEC-0014; System Overview and Integration Map.
- Starting files: `packages/domain/src/schemas.ts`, `packages/domain/src/branded-ids.ts`, `packages/persistence/src/repositories/interfaces.ts`, `packages/persistence/src/migrations/`, `apps/api/src/main.ts`, `apps/web/src/index.tsx`, and `apps/web/src/App.tsx`.
- Checklist: add typed list/create contracts; add workspace-isolated repository operations and greenfield schema changes; expose authenticated API routes; add a typed web client; establish the canonical project route and selector/creator; preserve deep links and reload state.
- Edge cases: empty workspace, duplicate or invalid names, cross-workspace enumeration, stale/deleted selection, refresh during creation, API timeout, and browser back/forward.

## Refinement Addendum — Execution-Ready Contract

### Outcome and prerequisites

- Success means an authenticated empty browser can list projects, create one, land on the `BASE_PATH`-aware `/projects/:projectId` route, reload it, switch projects, use Back/Forward, and reopen a previously selected authorized project without entering an identifier.
- Start only after Phase 09 remains green. Reuse the existing `Project`/`ProjectId` schemas and `ProjectRepo.create`, `findById`, and `findByWorkspaceId`; do not replace working persistence.

### Concrete starting points

- Domain: `packages/domain/src/schemas.ts`, `branded-ids.ts`, `index.ts`; add a bounded project-lifecycle contract module and tests rather than expanding unrelated schemas.
- Persistence: `packages/persistence/src/repositories/interfaces.ts`, `repositories/idempotency-keys.ts`, `repositories/integration.test.ts`, `migrations/0002_init_tables.sql`, and the next migration manifest entry (currently `0018`) for normalized-name uniqueness.
- API/auth: `apps/api/src/auth.ts`, `main.ts`, `auth-boundary.test.ts`, `auth-boundary.integration.test.ts`, and route patterns in `routes/sources.ts`, `dataset-queries.ts`, and `durable-artifacts.ts`; create `routes/projects.ts` plus focused tests.
- Web: `apps/web/src/index.tsx`, `App.tsx`, `base-path.ts`, `server.ts`, `vite.config.ts`; create `api/projects.ts`, a project-scoped state provider, `ProjectSwitcher`, and `ProjectPage` (or equivalently named bounded files).
- Browser harness: `apps/web/e2e/support/app-server.ts` and a new `apps/web/e2e/project-lifecycle.spec.ts`.

### Required behavior and constraints

1. Define Effect Schema request/response contracts. Normalize names with trim plus Unicode NFC; accept 1–120 characters; reject control characters. Enforce case-insensitive uniqueness per workspace with a database constraint and return a typed `409` duplicate response.
2. `GET /api/projects`, `POST /api/projects`, and `GET /api/projects/:projectId` derive workspace scope from the authenticated identity. They do not accept `workspaceId` from query/body input.
3. Project creation accepts an `Idempotency-Key`; a retried browser submission returns the first committed project instead of creating a duplicate.
4. Foreign, deleted, malformed, and guessed project identifiers return the same bounded not-found shape. List responses contain only the authenticated workspace and use deterministic updated/name/id ordering.
5. `/` loads the project list. A valid cached `struct:last-project-id` may redirect to its canonical route; invalid/unauthorized cached values are deleted and the chooser is shown. The cache contains only the project ID.
6. `/projects/:projectId` is the URL source of truth and works at `/struct/projects/:projectId`. Route loads abort or ignore stale responses when selection changes.
7. Empty, loading, create-in-progress, validation, duplicate, unavailable, and not-found states are keyboard usable and do not leak infrastructure messages.

### Non-goals, security, performance, and handoff

- Do not add source import, conversation, notes, or evidence behavior in this slice. Keep old feature routes working until their owning steps replace them.
- Never expose the server-side API credential or workspace ID to browser state. Preserve timing-safe authentication and authorization/not-found parity.
- Bound project-list payloads; a simple first-page cap is sufficient for v1 and must have a deterministic continuation contract if more results exist.
- On failure, retain the typed project-name input for retry but do not persist it beyond the current browser session. On success, navigate only after the server commit returns.
- Handoff must list the final route contracts, migration, new files, focused/full validation, and any downstream call sites that still carry legacy `workspaceId` so later steps can remove them.

### Readiness verdict

- **Pass.** Exact outcome, purpose, prerequisites, starting files, required behavior, constraints/non-goals, validation ownership, failure recovery, security, performance, integration effects, and handoff expectations are concrete.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
