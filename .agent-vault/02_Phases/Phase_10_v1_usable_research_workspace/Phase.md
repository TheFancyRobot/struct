---
note_type: phase
template_version: 2
contract_version: 1
title: v1 Usable Research Workspace
phase_id: PHASE-10
status: planned
owner: ''
created: '2026-07-21'
updated: '2026-07-21'
depends_on:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]'
  - '[[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]'
  - '[[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]'
related_bugs:
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
  - '[[03_Bugs/BUG-0018_vite-proxy-regression-test-does-not-typecheck|BUG-0018 Vite proxy regression test does not typecheck]]'
tags:
  - agent-vault
  - phase
---

# Phase 10 v1 Usable Research Workspace

Use this note for a bounded phase. Keep it focused, link outward, and avoid duplicating durable detail from architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Define and complete the v1 Usable Research Workspace milestone.
- Deliver the approved unified research workspace so a user can create or select a project, add and monitor sources, chat with ready sources, inspect exact evidence, save an editable note with provenance, and reopen persisted work entirely through the browser.
- Resolve [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013]] before any post-v1 phase begins.

## Why This Phase Exists

- Capture the next bounded milestone after [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]].
- The current root route renders a hard-coded report fixture and exposes no complete user workflow despite v1 backend capabilities.
- Phase 09 validated backend contracts and report rendering but did not gate release on an empty-browser end-to-end journey.
- The approved design at `docs/superpowers/specs/2026-07-21-unified-research-workspace-design.md` is the user-visible source of truth.

## Scope

- Add the concrete work items for this milestone.
- Create step notes as execution becomes clearer.
- Project list, create, select, and reopen flows.
- Full-viewport LTR workspace: extensible navigation and sources left, conversation center, evidence right.
- Browser source import, durable non-blocking progress, and recovery.
- Source-scoped durable conversations, exact citations, and first-class editable notes.
- Desktop, tablet, mobile, light/dark, keyboard, screen-reader, reconnect, and failure behavior.
- A real API-backed Playwright release journey that removes the demo-fixture path.

## Non-Goals

- Leave unrelated follow-on ideas in the roadmap or inbox until they become concrete.
- Post-v1 global command UX, reusable templates, advanced saved views, additional external source connectors, audio, podcasts, flashcards, quizzes, generic browsing, social features, or a plugin marketplace.
- Preserving compatibility with fixture-driven home routes or hand-constructed ID URLs.
- Weakening immutable source-version, deterministic computation, authorization, or provenance guarantees.

## Dependencies

- Depends on [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]].
- Requires the completed Phase 02–08 ingestion, retrieval, research, evidence, and artifact capabilities.
- Requires Phase 09 authentication, workspace isolation, deployment, evaluation, and accessibility foundations.
- BUG-0012 DaisyUI remediation is treated as the styling baseline and must remain green.
- The phase blocks [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]].

## Acceptance Criteria

- [ ] Scope is concrete and linked to the right durable notes.
- [ ] Step notes exist for the first executable work units.
- [ ] Validation and documentation expectations are explicit.
- [ ] A new browser session can create/select a project without manually supplied identifiers.
- [ ] A user can add supported files, folders, pasted text, and structured data from the left pane, return to navigation immediately, and monitor durable progress without an overlay toast.
- [ ] Ready sources can be queried while other sources process; partial failures are recoverable and never erase successful work.
- [ ] Conversation drafts and active state survive pane changes, route navigation, and SSE reconnects.
- [ ] Inline citations open exact document or deterministic dataset evidence in the right pane without moving the conversation.
- [ ] A user can save, edit, reload, and reopen a first-class note with originating run and citation provenance.
- [ ] The approved desktop, tablet, mobile, light/dark, accessibility, and reduced-motion behaviors pass.
- [ ] Playwright proves create project → add sources → navigate during upload → chat → citation → save note → reload/reopen against real API-backed state.
- [ ] The fixture-driven root experience is removed, documentation is accurate, all repository gates pass, Agent Vault validates cleanly, and zero confirmed defects remain.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
- Current phase status: planned
- Next phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|Phase 11 v1 1 research usability]]
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
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- [[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]
- [[03_Bugs/BUG-0018_vite-proxy-regression-test-does-not-typecheck|BUG-0018 Vite proxy regression test does not typecheck]]
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]]
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_05_integrate-exact-evidence-inspector|STEP-10-05 Integrate Exact Evidence Inspector]]
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance|STEP-10-06 Add Durable User Notes with Provenance]]
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- [ ] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
<!-- AGENT-END:phase-steps -->

## Notes

- Add architecture, bug, and decision links as the milestone becomes more concrete.
- Use the `Steps/` directory for the first executable units instead of expanding this note too far.
- Ordering is intentionally sequential: project scope precedes shell routing; shell precedes import UX; import precedes source-scoped conversation; conversation precedes evidence and note capture; cross-cutting responsive/accessibility work follows functional integration; release validation is last.
- Greenfield policy permits direct schema replacement for the new Note model; no compatibility migration layer is required.
- Rollback boundary: each step must be independently reviewable and leave existing backend research guarantees green before the next step begins.
### Refinement Contract — 2026-07-21

- Authority order for this phase is the approved workspace design, the matching implementation plan, accepted ADRs, then the current repository baseline. The design status was corrected to `Approved`; no product-design approval remains open.
- The eight-step order remains sequential. Each step owns one independently reviewable vertical slice and must leave the full repository green before the next begins.
- The current single-user web server keeps the bearer credential server-side. Every new Phase 10 API handler derives `workspaceId` from the authenticated identity; the browser must not send or persist a workspace identifier. Existing browser calls that still accept `workspaceId` are replaced as their owning slice is integrated and are gone from the release journey by STEP-10-08.
- The canonical SPA route is `/projects/:projectId`, composed with the configured `BASE_PATH`. The URL is authoritative for the active project; only a validated last-project identifier may be cached for root-route convenience. Foreign, deleted, and guessed identifiers use the same not-found response shape.
- Reuse `ProjectRepo`, `SourceRepo`, `ResearchExecutionRepo`, `ResearchProjectionRepo`, the event journal, immutable `SourceVersion` contracts, source storage, ingestion, and data-engine materialization. Do not create a second repository stack, event bus, state framework, database, runtime, or fixture compatibility layer.
- Route handlers belong in bounded `apps/api/src/routes/*.ts` modules and are only wired in `apps/api/src/main.ts`; UI state uses Solid signals/stores behind a project-scoped workspace provider.
- Browser folder import means uploading a bounded set of selected files plus validated relative paths. It never means accepting a browser-supplied host path or weakening registered-root, symlink, traversal, or workspace controls.
- Large browser uploads must use bounded streaming/multipart staging rather than base64 JSON or whole-request buffering. Per-file, batch-file-count, and aggregate-byte limits are configuration-backed, documented, rejected before durable enqueue where possible, and enforced again while streaming.
- Project/thread/note server records and journal cursors are authoritative. Project-scoped draft, pane, and source-selection continuity may use bounded `sessionStorage`; no imported content, answer text, note body, credential, or evidence excerpt is placed in long-lived browser storage.
- Accessibility is implemented in every functional slice; STEP-10-07 is the cross-cutting audit and remediation pass, not the first accessibility pass. All panes and sheets require semantic labels, keyboard operation, visible focus, and deterministic focus restoration as they are introduced.
- The later approved workspace typography supersedes the prior editorial baseline: STEP-10-02 locally bundles Manrope for interface/conversation text, retains IBM Plex Mono for identifiers/query metadata, and removes the Newsreader editorial role from workspace routes. No remote font request is allowed.
- The release journey uses the real web proxy, API, worker, PostgreSQL, artifact storage, ingestion, retrieval, citations, and note persistence. A deterministic test provider is allowed at the model-provider boundary, but page-level network stubs, fixture routes, direct database shortcuts, and direct API calls are not release evidence.
- BUG-0013 is the one confirmed repository defect and is the reason this remediation phase may proceed. It remains open through STEP-10-08; no unrelated phase or step may advance, and any new confirmed defect stops the sequence until fixed.
- The root orchestrator owns all git operations. Each implementation step uses one fresh `openai-codex/gpt-5.4` worker, one branch, one reviewed pull request, and independent root verification.

### Refinement Readiness Matrix

| Step | Readiness | Durable clarification |
| --- | --- | --- |
| STEP-10-01 | Pass | Auth-derived workspace scope, project-name/idempotency policy, canonical routing, exact files and tests are specified. |
| STEP-10-02 | Pass | Shell-only boundaries, typography authority, interim citation behavior, responsive/focus checks, and non-goals are specified. |
| STEP-10-03 | Pass | Browser import semantics, streaming limits, durable activity projection, source-kind routing, and recovery are specified. |
| STEP-10-04 | Pass | Thread continuation, committed-cursor reduction, source scope, draft continuity, pagination, and retry/cancel behavior are specified. |
| STEP-10-05 | Pass | Evidence union, exact provenance, base-path-aware pane state, authorization parity, and failure states are specified. |
| STEP-10-06 | Pass | Distinct note/revision/provenance model, optimistic autosave, conflict recovery, safety limits, and archive behavior are specified. |
| STEP-10-07 | Pass | Exact viewport/theme/input/accessibility matrix, `/struct` regression, artifacts, and manual checks are specified. |
| STEP-10-08 | Pass | Real-stack deterministic journey, demo removal, full gate ladder, documentation refresh, and defect closure are specified. |

No unresolved question or external blocker remains for refinement. Implementation remains blocked on the per-step branch/review gates and on resolving BUG-0013 through this phase.
