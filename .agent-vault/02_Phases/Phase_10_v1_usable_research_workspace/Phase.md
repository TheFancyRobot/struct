---
note_type: phase
template_version: 2
contract_version: 1
title: v1 Usable Research Workspace
phase_id: PHASE-10
status: completed
owner: Codex
created: '2026-07-21'
updated: '2026-07-28'
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
  - '[[04_Decisions/DEC-0024_require-full-browser-coverage-and-design-consistency-audit-before-phase-11|DEC-0024 require full browser coverage and design consistency audit before phase 11]]'
related_bugs:
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
  - '[[03_Bugs/BUG-0018_vite-proxy-regression-test-does-not-typecheck|BUG-0018 Vite proxy regression test does not typecheck]]'
  - '[[03_Bugs/BUG-0041_project-creation-controls-overlap-when-the-name-field-is-focused|BUG-0041 Project creation controls overlap when the name field is focused]]'
  - '[[03_Bugs/BUG-0042_center-workspace-is-fragmented-by-redundant-title-chrome-and-card-framing|BUG-0042 Center workspace is fragmented by redundant title chrome and card framing]]'
  - '[[03_Bugs/BUG-0043_workspace-navigation-lacks-project-source-and-recent-discovery-sections|BUG-0043 Workspace navigation lacks project, source, and recent discovery sections]]'
  - '[[03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions|BUG-0044 Navigation discovery sections lack direct creation actions]]'
  - '[[03_Bugs/BUG-0045_sources-are-scoped-to-one-project-and-cannot-be-reused|BUG-0045 Sources are scoped to one project and cannot be reused]]'
  - '[[03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection|BUG-0046 Global source import is blocked by project selection]]'
  - '[[03_Bugs/BUG-0047_source-import-notice-ignores-the-source-library-content-gutter|BUG-0047 Source import notice ignores the source library content gutter]]'
  - '[[03_Bugs/BUG-0048_workspace-source-attachments-do-not-enqueue-text-indexing|BUG-0048 Workspace source attachments do not enqueue text indexing]]'
  - '[[03_Bugs/BUG-0049_global-dataset-attachments-did-not-materialize-project-datasets|BUG-0049 Global dataset attachments did not materialize project datasets]]'
  - '[[03_Bugs/BUG-0050_workspace-responsive-e2e-test-retains-obsolete-project-gated-source-action-contract|BUG-0050 Workspace responsive e2e test retains obsolete project-gated source action contract]]'
  - '[[03_Bugs/BUG-0051_manage-source-library-navigation-link-misses-the-44px-touch-target-minimum|BUG-0051 Manage source library navigation link misses the 44px touch-target minimum]]'
  - '[[03_Bugs/BUG-0052_directory-source-import-rejects-a-local-canonical-corpus-with-http-413|BUG-0052 Directory source import rejects a local canonical corpus with HTTP 413]]'
  - '[[03_Bugs/BUG-0057_full-e2e-suite-leaks-process-state-before-mixed-source-report-tests|BUG-0057 full e2e suite leaks process state before mixed-source report tests]]'
  - '[[03_Bugs/BUG-0058_workspace-release-e2e-times-out-under-full-suite-docker-cold-start-contention|BUG-0058 workspace release e2e times out under full-suite docker cold-start contention]]'
  - '[[03_Bugs/BUG-0059_standard-local-dev-stack-stages-source-uploads-outside-the-worker-artifact-root|BUG-0059 standard local dev stack stages source uploads outside the worker artifact root]]'
  - '[[03_Bugs/BUG-0064_citation-unavailable-state-references-a-missing-accessible-heading|BUG-0064 Citation unavailable state references a missing accessible heading]]'
  - '[[03_Bugs/BUG-0061_source-import-file-picker-has-no-accessible-label|BUG-0061 Source import file picker has no accessible label]]'
  - '[[03_Bugs/BUG-0065_project-sidebar-section-label-fails-contrast-in-both-themes|BUG-0065 Project sidebar section label fails contrast in both themes]]'
  - '[[03_Bugs/BUG-0066_mobile-source-form-controls-fall-below-the-touch-target-baseline|BUG-0066 Mobile source form controls fall below the touch target baseline]]'
  - '[[03_Bugs/BUG-0067_mobile-navigation-and-evidence-sheets-do-not-isolate-keyboard-focus|BUG-0067 Mobile navigation and evidence sheets do not isolate keyboard focus]]'
  - '[[03_Bugs/BUG-0068_source-attachment-checkboxes-have-indistinguishable-accessible-names|BUG-0068 Source attachment checkboxes have indistinguishable accessible names]]'
  - '[[03_Bugs/BUG-0069_reports-navigation-is-permanently-disabled-and-notebook-is-undiscoverable|BUG-0069 Reports navigation is permanently disabled and notebook is undiscoverable]]'
  - '[[03_Bugs/BUG-0070_new-project-is-missing-from-project-navigation-until-reload|BUG-0070 New project is missing from project navigation until reload]]'
  - '[[03_Bugs/BUG-0071_add-source-leaves-focus-in-workspace-navigation-after-route-change|BUG-0071 Add Source leaves focus in workspace navigation after route change]]'
  - '[[03_Bugs/BUG-0072_workspace-routes-reuse-one-generic-browser-title|BUG-0072 Workspace routes reuse one generic browser title]]'
  - '[[03_Bugs/BUG-0073_workspace-has-no-skip-link-past-repeated-navigation|BUG-0073 Workspace has no skip link past repeated navigation]]'
  - '[[03_Bugs/BUG-0074_unknown-routes-render-an-empty-main-region|BUG-0074 Unknown routes render an empty main region]]'
  - '[[03_Bugs/BUG-0075_global-sources-route-has-no-active-navigation-state|BUG-0075 Global Sources route has no active navigation state]]'
  - '[[03_Bugs/BUG-0076_successful-source-import-is-not-announced|BUG-0076 Successful source import is not announced]]'
  - '[[03_Bugs/BUG-0077_workspace-searches-provide-no-no-results-feedback|BUG-0077 Workspace searches provide no no results feedback]]'
  - '[[03_Bugs/BUG-0078_project-search-leaves-unrelated-recent-projects-visible|BUG-0078 Project search leaves unrelated recent projects visible]]'
  - '[[03_Bugs/BUG-0079_active-source-import-mode-has-insufficient-visual-contrast|BUG-0079 Active source import mode has insufficient visual contrast]]'
  - '[[03_Bugs/BUG-0080_dataset-and-folder-import-modes-lack-mode-specific-guidance|BUG-0080 Dataset and Folder import modes lack mode specific guidance]]'
  - '[[03_Bugs/BUG-0081_disabled-reports-destination-is-nearly-invisible|BUG-0081 Disabled Reports destination is nearly invisible]]'
  - '[[03_Bugs/BUG-0082_unavailable-project-attachment-control-has-no-explanation|BUG-0082 Unavailable project attachment control has no explanation]]'
  - '[[03_Bugs/BUG-0083_conversation-source-checkbox-touch-target-is-only-25-pixels-high|BUG-0083 Conversation source checkbox touch target is only 25 pixels high]]'
  - '[[03_Bugs/BUG-0084_failed-research-submission-returns-no-user-visible-error|BUG-0084 Failed research submission returns no user visible error]]'
  - '[[03_Bugs/BUG-0085_terminal-failed-research-run-remains-labeled-reconnecting|BUG-0085 Terminal failed research run remains labeled Reconnecting]]'
  - '[[03_Bugs/BUG-0086_notebook-report-404-remains-stuck-in-loading-state|BUG-0086 Notebook report 404 remains stuck in loading state]]'
  - '[[03_Bugs/BUG-0087_research-error-variants-lack-browser-coverage|BUG-0087 Research error variants lack browser coverage]]'
  - '[[03_Bugs/BUG-0088_research-cancellation-failure-lacks-browser-coverage|BUG-0088 Research cancellation failure lacks browser coverage]]'
  - '[[03_Bugs/BUG-0089_removed-source-selection-notice-lacks-browser-coverage|BUG-0089 Removed source selection notice lacks browser coverage]]'
  - '[[03_Bugs/BUG-0090_mixed-source-live-demo-state-lacks-an-explicit-browser-regression|BUG-0090 Mixed source live demo state lacks an explicit browser regression]]'
  - '[[03_Bugs/BUG-0091_notebook-finding-selection-and-citation-warning-lack-browser-coverage|BUG-0091 Notebook finding selection and citation warning lack browser coverage]]'
  - '[[03_Bugs/BUG-0092_report-export-failure-lacks-browser-coverage|BUG-0092 Report export failure lacks browser coverage]]'
  - '[[03_Bugs/BUG-0093_add-project-hash-focus-journey-lacks-browser-regression-coverage|BUG-0093 Add project hash focus journey lacks browser regression coverage]]'
  - '[[03_Bugs/BUG-0094_evidence-inspector-loading-and-error-states-lack-browser-coverage|BUG-0094 Evidence inspector loading and error states lack browser coverage]]'
  - '[[03_Bugs/BUG-0095_mobile-project-navigation-drawer-makes-theme-switching-unreachable|BUG-0095 Mobile project navigation drawer makes theme switching unreachable]]'
  - '[[03_Bugs/BUG-0096_mobile-project-name-input-falls-below-the-touch-target-baseline|BUG-0096 Mobile project name input falls below the touch target baseline]]'
  - '[[03_Bugs/BUG-0097_mixed-source-light-theme-metadata-text-fails-contrast|BUG-0097 Mixed source light theme metadata text fails contrast]]'
  - '[[03_Bugs/BUG-0098_mixed-source-dataset-type-labels-fail-contrast-in-both-themes|BUG-0098 Mixed source dataset type labels fail contrast in both themes]]'
  - '[[03_Bugs/BUG-0099_mixed-source-dark-dataset-definition-labels-fail-contrast|BUG-0099 Mixed source dark dataset definition labels fail contrast]]'
  - '[[03_Bugs/BUG-0100_mixed-source-mobile-section-tabs-are-only-40-pixels-high|BUG-0100 Mixed source mobile section tabs are only 40 pixels high]]'
  - '[[03_Bugs/BUG-0101_mixed-source-citation-links-are-only-24-pixels-high-on-mobile|BUG-0101 Mixed source citation links are only 24 pixels high on mobile]]'
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
- The phase blocks [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]].

## Acceptance Criteria

- [x] Scope is concrete and linked to the right durable notes.
- [x] Step notes exist for the first executable work units.
- [x] Validation and documentation expectations are explicit.
- [x] A new browser session can create/select a project without manually supplied identifiers.
- [x] A user can add supported files, folders, pasted text, and structured data from the left pane, return to navigation immediately, and monitor durable progress without an overlay toast.
- [x] Ready sources can be queried while other sources process; partial failures are recoverable and never erase successful work.
- [x] Conversation drafts and active state survive pane changes, route navigation, and SSE reconnects.
- [x] Inline citations open exact document or deterministic dataset evidence in the right pane without moving the conversation.
- [x] A user can save, edit, reload, and reopen a first-class note with originating run and citation provenance.
- [x] The approved desktop, tablet, mobile, light/dark, accessibility, and reduced-motion behaviors pass.
- [x] Playwright proves create project → add sources → navigate during upload → chat → citation → save note → reload/reopen against real API-backed state.
- [x] The fixture-driven root experience is removed, documentation is accurate, all repository gates pass, Agent Vault validates cleanly, and zero confirmed defects remain.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]
- Current phase status: completed
- Next phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
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
- [[04_Decisions/DEC-0024_require-full-browser-coverage-and-design-consistency-audit-before-phase-11|DEC-0024 require full browser coverage and design consistency audit before phase 11]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]
- [[03_Bugs/BUG-0018_vite-proxy-regression-test-does-not-typecheck|BUG-0018 Vite proxy regression test does not typecheck]]
- [[03_Bugs/BUG-0041_project-creation-controls-overlap-when-the-name-field-is-focused|BUG-0041 Project creation controls overlap when the name field is focused]]
- [[03_Bugs/BUG-0042_center-workspace-is-fragmented-by-redundant-title-chrome-and-card-framing|BUG-0042 Center workspace is fragmented by redundant title chrome and card framing]]
- [[03_Bugs/BUG-0043_workspace-navigation-lacks-project-source-and-recent-discovery-sections|BUG-0043 Workspace navigation lacks project, source, and recent discovery sections]]
- [[03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions|BUG-0044 Navigation discovery sections lack direct creation actions]]
- [[03_Bugs/BUG-0045_sources-are-scoped-to-one-project-and-cannot-be-reused|BUG-0045 Sources are scoped to one project and cannot be reused]]
- [[03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection|BUG-0046 Global source import is blocked by project selection]]
- [[03_Bugs/BUG-0047_source-import-notice-ignores-the-source-library-content-gutter|BUG-0047 Source import notice ignores the source library content gutter]]
- [[03_Bugs/BUG-0048_workspace-source-attachments-do-not-enqueue-text-indexing|BUG-0048 Workspace source attachments do not enqueue text indexing]]
- [[03_Bugs/BUG-0049_global-dataset-attachments-did-not-materialize-project-datasets|BUG-0049 Global dataset attachments did not materialize project datasets]]
- [[03_Bugs/BUG-0050_workspace-responsive-e2e-test-retains-obsolete-project-gated-source-action-contract|BUG-0050 Workspace responsive e2e test retains obsolete project-gated source action contract]]
- [[03_Bugs/BUG-0051_manage-source-library-navigation-link-misses-the-44px-touch-target-minimum|BUG-0051 Manage source library navigation link misses the 44px touch-target minimum]]
- [[03_Bugs/BUG-0052_directory-source-import-rejects-a-local-canonical-corpus-with-http-413|BUG-0052 Directory source import rejects a local canonical corpus with HTTP 413]]
- [[03_Bugs/BUG-0057_full-e2e-suite-leaks-process-state-before-mixed-source-report-tests|BUG-0057 full e2e suite leaks process state before mixed-source report tests]]
- [[03_Bugs/BUG-0058_workspace-release-e2e-times-out-under-full-suite-docker-cold-start-contention|BUG-0058 workspace release e2e times out under full-suite docker cold-start contention]]
- [[03_Bugs/BUG-0059_standard-local-dev-stack-stages-source-uploads-outside-the-worker-artifact-root|BUG-0059 standard local dev stack stages source uploads outside the worker artifact root]]
- [[03_Bugs/BUG-0064_citation-unavailable-state-references-a-missing-accessible-heading|BUG-0064 Citation unavailable state references a missing accessible heading]]
- [[03_Bugs/BUG-0061_source-import-file-picker-has-no-accessible-label|BUG-0061 Source import file picker has no accessible label]]
- [[03_Bugs/BUG-0065_project-sidebar-section-label-fails-contrast-in-both-themes|BUG-0065 Project sidebar section label fails contrast in both themes]]
- [[03_Bugs/BUG-0066_mobile-source-form-controls-fall-below-the-touch-target-baseline|BUG-0066 Mobile source form controls fall below the touch target baseline]]
- [[03_Bugs/BUG-0067_mobile-navigation-and-evidence-sheets-do-not-isolate-keyboard-focus|BUG-0067 Mobile navigation and evidence sheets do not isolate keyboard focus]]
- [[03_Bugs/BUG-0068_source-attachment-checkboxes-have-indistinguishable-accessible-names|BUG-0068 Source attachment checkboxes have indistinguishable accessible names]]
- [[03_Bugs/BUG-0069_reports-navigation-is-permanently-disabled-and-notebook-is-undiscoverable|BUG-0069 Reports navigation is permanently disabled and notebook is undiscoverable]]
- [[03_Bugs/BUG-0070_new-project-is-missing-from-project-navigation-until-reload|BUG-0070 New project is missing from project navigation until reload]]
- [[03_Bugs/BUG-0071_add-source-leaves-focus-in-workspace-navigation-after-route-change|BUG-0071 Add Source leaves focus in workspace navigation after route change]]
- [[03_Bugs/BUG-0072_workspace-routes-reuse-one-generic-browser-title|BUG-0072 Workspace routes reuse one generic browser title]]
- [[03_Bugs/BUG-0073_workspace-has-no-skip-link-past-repeated-navigation|BUG-0073 Workspace has no skip link past repeated navigation]]
- [[03_Bugs/BUG-0074_unknown-routes-render-an-empty-main-region|BUG-0074 Unknown routes render an empty main region]]
- [[03_Bugs/BUG-0075_global-sources-route-has-no-active-navigation-state|BUG-0075 Global Sources route has no active navigation state]]
- [[03_Bugs/BUG-0076_successful-source-import-is-not-announced|BUG-0076 Successful source import is not announced]]
- [[03_Bugs/BUG-0077_workspace-searches-provide-no-no-results-feedback|BUG-0077 Workspace searches provide no no results feedback]]
- [[03_Bugs/BUG-0078_project-search-leaves-unrelated-recent-projects-visible|BUG-0078 Project search leaves unrelated recent projects visible]]
- [[03_Bugs/BUG-0079_active-source-import-mode-has-insufficient-visual-contrast|BUG-0079 Active source import mode has insufficient visual contrast]]
- [[03_Bugs/BUG-0080_dataset-and-folder-import-modes-lack-mode-specific-guidance|BUG-0080 Dataset and Folder import modes lack mode specific guidance]]
- [[03_Bugs/BUG-0081_disabled-reports-destination-is-nearly-invisible|BUG-0081 Disabled Reports destination is nearly invisible]]
- [[03_Bugs/BUG-0082_unavailable-project-attachment-control-has-no-explanation|BUG-0082 Unavailable project attachment control has no explanation]]
- [[03_Bugs/BUG-0083_conversation-source-checkbox-touch-target-is-only-25-pixels-high|BUG-0083 Conversation source checkbox touch target is only 25 pixels high]]
- [[03_Bugs/BUG-0084_failed-research-submission-returns-no-user-visible-error|BUG-0084 Failed research submission returns no user visible error]]
- [[03_Bugs/BUG-0085_terminal-failed-research-run-remains-labeled-reconnecting|BUG-0085 Terminal failed research run remains labeled Reconnecting]]
- [[03_Bugs/BUG-0086_notebook-report-404-remains-stuck-in-loading-state|BUG-0086 Notebook report 404 remains stuck in loading state]]
- [[03_Bugs/BUG-0087_research-error-variants-lack-browser-coverage|BUG-0087 Research error variants lack browser coverage]]
- [[03_Bugs/BUG-0088_research-cancellation-failure-lacks-browser-coverage|BUG-0088 Research cancellation failure lacks browser coverage]]
- [[03_Bugs/BUG-0089_removed-source-selection-notice-lacks-browser-coverage|BUG-0089 Removed source selection notice lacks browser coverage]]
- [[03_Bugs/BUG-0090_mixed-source-live-demo-state-lacks-an-explicit-browser-regression|BUG-0090 Mixed source live demo state lacks an explicit browser regression]]
- [[03_Bugs/BUG-0091_notebook-finding-selection-and-citation-warning-lack-browser-coverage|BUG-0091 Notebook finding selection and citation warning lack browser coverage]]
- [[03_Bugs/BUG-0092_report-export-failure-lacks-browser-coverage|BUG-0092 Report export failure lacks browser coverage]]
- [[03_Bugs/BUG-0093_add-project-hash-focus-journey-lacks-browser-regression-coverage|BUG-0093 Add project hash focus journey lacks browser regression coverage]]
- [[03_Bugs/BUG-0094_evidence-inspector-loading-and-error-states-lack-browser-coverage|BUG-0094 Evidence inspector loading and error states lack browser coverage]]
- [[03_Bugs/BUG-0095_mobile-project-navigation-drawer-makes-theme-switching-unreachable|BUG-0095 Mobile project navigation drawer makes theme switching unreachable]]
- [[03_Bugs/BUG-0096_mobile-project-name-input-falls-below-the-touch-target-baseline|BUG-0096 Mobile project name input falls below the touch target baseline]]
- [[03_Bugs/BUG-0097_mixed-source-light-theme-metadata-text-fails-contrast|BUG-0097 Mixed source light theme metadata text fails contrast]]
- [[03_Bugs/BUG-0098_mixed-source-dataset-type-labels-fail-contrast-in-both-themes|BUG-0098 Mixed source dataset type labels fail contrast in both themes]]
- [[03_Bugs/BUG-0099_mixed-source-dark-dataset-definition-labels-fail-contrast|BUG-0099 Mixed source dark dataset definition labels fail contrast]]
- [[03_Bugs/BUG-0100_mixed-source-mobile-section-tabs-are-only-40-pixels-high|BUG-0100 Mixed source mobile section tabs are only 40 pixels high]]
- [[03_Bugs/BUG-0101_mixed-source-citation-links-are-only-24-pixels-high-on-mobile|BUG-0101 Mixed source citation links are only 24 pixels high on mobile]]
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non Blocking Import]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_05_integrate-exact-evidence-inspector|STEP-10-05 Integrate Exact Evidence Inspector]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance|STEP-10-06 Add Durable User Notes with Provenance]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
- [x] [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped|STEP-10-09 Make Source Registration Workspace Scoped]]
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
- BUG-0013 was the confirmed repository defect at refinement. Phase 10 resolved it through the eight independently reviewed remediation units; any new confirmed defect still stops advancement until fixed.
- The root orchestrator owns all git operations. Each implementation step uses one fresh `openai-codex/gpt-5.4` worker, one branch, one reviewed pull request, and independent root verification.

### Remediation Design Readiness Matrix

This matrix records the execution readiness that preceded the now-completed Phase 10 work.

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

No unresolved design question or external blocker remains. BUG-0013 is fixed, all Phase 10 steps and acceptance criteria are complete, and Phase 11 refinement remains gated on Phase 10 review and merge.
