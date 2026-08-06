---
note_type: bug
template_version: 2
contract_version: 1
title: UI lacks inference provider and model configuration
bug_id: BUG-0120
status: resolved
severity: sev-3
category: integration
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug-0120-attempt-2
created: '2026-08-05'
updated: '2026-08-05'
related_notes: |-
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]'
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_01_harden-authentication-workspace-isolation-and-secrets|STEP-09-01 Harden Authentication Workspace Isolation and Secrets]]'
  - '[[03_Bugs/BUG-0119_project-navigation-is-over-spaced-and-lacks-discoverable-search-and-settings|BUG-0119]]'
  - '[[03_Bugs/BUG-0127_inference-settings-review-feedback-leaves-runtime-configuration-incomplete|BUG-0127]]'
tags:
  - agent-vault
  - bug
---

# BUG-0120 - UI lacks inference provider and model configuration

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- UI lacks inference provider and model configuration.
- Users cannot configure inference provider connections or select the models used for chat, embeddings, and vision from the application.
- A Settings screen must be reachable from the main navigation and own both provider connections and per-capability model assignments.

## Observed Behavior

- The main menu exposes no Settings destination for inference configuration.
- There is no screen to add, inspect, test, update, disable, or remove a provider connection.
- There is no model catalog or assignment control for the chat, embedding, and vision roles.
- Provider and model choices therefore remain operational/developer configuration rather than user-manageable product state.

## Expected Behavior

- The main menu includes a clearly labeled Settings destination.
- Settings provides a provider-connections section where an authorized user can configure the supported provider type, endpoint when applicable, and credential; test the connection; see a sanitized status; update it; and remove or disable it.
- Credentials are write-only in the browser, stored server-side using the repository's secret-handling contract, never returned after submission, and redacted from logs, errors, events, and model/tool context.
- Settings provides a models section listing models attached to configured providers and allows exactly one active selection for each supported role: chat, embedding, and vision.
- Role assignment rejects incompatible model capabilities and cannot reference a disabled or deleted provider connection.
- Existing chat/model-routing and vector-embedding paths resolve the selected assignments without weakening current budgets, provenance, retry, or failure contracts.

## Reproduction Steps

1. Open the application and inspect the main navigation.
2. Attempt to open Settings or another inference-configuration surface.
3. Attempt to add a provider connection and verify it without editing server environment or source files.
4. Attempt to choose separate models for chat, embeddings, and vision.
5. Observe that none of these user workflows exists.

## Scope / Blast Radius

- Affects the shared `apps/web` navigation and a new Settings route, typed API endpoints, authorization, persistence, secret handling, provider adapters, model routing, and embedding resolution.
- Vision assignment is configuration scope only unless an existing vision consumer is present; this bug must not invent an unrelated vision/OCR workflow.
- Provider deletion/disable and model reassignment must fail safely without exposing credentials or silently changing an in-flight research run.

## Suspected Root Cause

- Provider endpoints, credentials, and model identifiers appear to be supplied through deployment/runtime configuration, while the product has no persisted provider-connection or per-role model-assignment contract and no corresponding API or Settings route.
- This remains a theory until runtime configuration, provider factories/resolvers, persistence, API routes, and navigation callers are traced end to end.

## Confirmed Root Cause

- Not yet confirmed. Inspect the current provider configuration boundary and every chat, embedding, and vision model resolver before implementation.

## Workaround

- An operator may be able to configure the current provider through deployment environment values, but end users cannot manage or verify connections and role assignments in the UI.

## Permanent Fix Plan

- Reuse existing Effect configuration/provider boundaries and SolidJS workspace routing.
- Add the minimum typed persisted records for sanitized provider metadata, protected credential material/reference, configured models, and one assignment per chat/embedding/vision role.
- Add authorized CRUD/test endpoints that never return secrets, then one Settings screen linked from the main menu.
- Wire existing chat routing and embedding resolution to the persisted assignments; connect vision only to an existing consumer.
- Prefer drop-and-recreate schema changes under the repository's greenfield policy; add no compatibility layer, provider marketplace, fallback chains, load balancing, or per-project overrides.

## Regression Coverage Needed

- Add focused domain/repository/API checks for capability validation, one assignment per role, secret write-only behavior, redaction, authorization, connection-test failures, and disabled/deleted provider references.
- Add focused resolver checks proving chat and embedding select the configured models while preserving budgets and typed provider failures; cover vision only where a consumer exists.
- Add one browser journey from main-menu Settings through provider creation/test and chat/embedding/vision assignment, including invalid credentials, keyboard/accessibility behavior, responsive layouts, and proof that secrets never reappear.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_03_implement-keyword-vector-and-hybrid-retrieval|STEP-02-03 Implement Keyword Vector and Hybrid Retrieval]]
- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_01_harden-authentication-workspace-isolation-and-secrets|STEP-09-01 Harden Authentication Workspace Isolation and Secrets]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries|DEC-0003 Use TypeScript Bun and Effect with Explicit Runtime Boundaries]]
- [[04_Decisions/DEC-0010_use-focused-fred-agents-with-deterministic-effect-tools|DEC-0010 Use Focused Fred Agents with Deterministic Effect Tools]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]
- [[03_Bugs/BUG-0119_project-navigation-is-over-spaced-and-lacks-discoverable-search-and-settings|BUG-0119 Project Navigation Is Over-Spaced and Lacks Discoverable Search and Settings]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
- 2026-08-05 - User reported that provider connections and chat/embedding/vision model assignments have no main-menu configuration screen.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05: Added the first persisted Settings slice: workspace-scoped provider metadata with write-only credential references, capability-tagged models, one model assignment per chat/embedding/vision role, and a reachable `/settings` screen. The subsequent BUG-0127 correction completed server-side credential resolution, connection testing, and runtime wiring.
- 2026-08-05: Added provider update/enable-disable/delete controls, a server-only fail-closed connection-test boundary, and persisted enabled-provider runtime resolution for chat and embedding. Focused API, persistence, worker, web, lint, and TypeScript checks pass.
- 2026-08-05: Fixed the inference-settings route test double to honor readonly capability contracts and guard route/indexed test values. `bun run typecheck` and `bun test --max-concurrency 1 apps/api/src/routes/inference-settings.test.ts` pass.
