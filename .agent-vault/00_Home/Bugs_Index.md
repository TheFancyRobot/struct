---
note_type: home_index
template_version: 1
contract_version: 1
title: Bugs Index
status: active
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
tags:
  - agent-vault
  - home
  - index
  - bugs
---

# Bugs Index

Use this note as the manual table of contents for bug records in \`03_Bugs/\`.

## Triage Rules

- Create one note per bug.
- Use a stable id such as \`BUG-0001\`.
- Link relevant phase, decision, and session notes.
- Record root cause and verification.

## Status Buckets

<!-- AGENT-START:bugs-index -->
_Last rebuilt: 2026-08-04._

- Notes indexed: 95
- Status summary: new (7), fixed (83), invalid (5)

| Id | Title | Status | Severity | Reported | Fixed | Linear |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-0089 | [Removed source selection notice lacks browser coverage](../03_Bugs/BUG-0089_removed-source-selection-notice-lacks-browser-coverage.md) | new | sev-3 | 2026-07-28 | - | - |
| BUG-0090 | [Mixed source live demo state lacks an explicit browser regression](../03_Bugs/BUG-0090_mixed-source-live-demo-state-lacks-an-explicit-browser-regression.md) | new | sev-3 | 2026-07-28 | - | - |
| BUG-0094 | [Evidence inspector loading and error states lack browser coverage](../03_Bugs/BUG-0094_evidence-inspector-loading-and-error-states-lack-browser-coverage.md) | new | sev-3 | 2026-07-28 | - | - |
| BUG-0095 | [Mobile project navigation drawer makes theme switching unreachable](../03_Bugs/BUG-0095_mobile-project-navigation-drawer-makes-theme-switching-unreachable.md) | new | sev-3 | 2026-07-28 | - | - |
| BUG-0096 | [Mobile project name input falls below the touch target baseline](../03_Bugs/BUG-0096_mobile-project-name-input-falls-below-the-touch-target-baseline.md) | new | sev-3 | 2026-07-28 | - | - |
| BUG-0100 | [Mixed source mobile section tabs are only 40 pixels high](../03_Bugs/BUG-0100_mixed-source-mobile-section-tabs-are-only-40-pixels-high.md) | new | sev-3 | 2026-07-28 | - | - |
| BUG-0101 | [Mixed source citation links are only 24 pixels high on mobile](../03_Bugs/BUG-0101_mixed-source-citation-links-are-only-24-pixels-high-on-mobile.md) | new | sev-3 | 2026-07-28 | - | - |
| BUG-0059 | [standard local dev stack stages source uploads outside the worker artifact root](../03_Bugs/BUG-0059_standard-local-dev-stack-stages-source-uploads-outside-the-worker-artifact-root.md) | fixed | sev-1 | 2026-07-28 | 2026-07-28 | - |
| BUG-0060 | [Clean real stack omits workspace bootstrap and blocks first project creation](../03_Bugs/BUG-0060_clean-real-stack-omits-workspace-bootstrap-and-blocks-first-project-creation.md) | fixed | sev-1 | 2026-07-28 | 2026-07-29 | - |
| BUG-0061 | [Source import file picker has no accessible label](../03_Bugs/BUG-0061_source-import-file-picker-has-no-accessible-label.md) | fixed | sev-1 | 2026-07-28 | 2026-07-29 | - |
| BUG-0049 | [Global dataset attachments did not materialize project datasets](../03_Bugs/BUG-0049_global-dataset-attachments-did-not-materialize-project-datasets.md) | fixed | sev-1 | 2026-07-26 | 2026-07-26 | - |
| BUG-0013 | [v1 UI lacks core research workflows](../03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows.md) | fixed | sev-1 | 2026-07-21 | 2026-07-26 | - |
| BUG-0107 | [Worker startup delay was misclassified as permanent idleness](../03_Bugs/BUG-0107_worker-subagents-remain-idle-and-never-execute-assigned-bug-0106-task.md) | fixed | sev-2 | 2026-08-01 | 2026-08-01 | - |
| BUG-0063 | [Source import mode switcher lacks valid group and selection semantics](../03_Bugs/BUG-0063_source-import-mode-switcher-lacks-valid-group-and-selection-semantics.md) | fixed | sev-2 | 2026-07-28 | 2026-07-30 | - |
| BUG-0064 | [Citation unavailable state references a missing accessible heading](../03_Bugs/BUG-0064_citation-unavailable-state-references-a-missing-accessible-heading.md) | fixed | sev-2 | 2026-07-28 | 2026-07-30 | - |
| BUG-0065 | [Project sidebar section label fails contrast in both themes](../03_Bugs/BUG-0065_project-sidebar-section-label-fails-contrast-in-both-themes.md) | fixed | sev-2 | 2026-07-28 | 2026-07-30 | - |
| BUG-0066 | [Mobile source form controls fall below the touch target baseline](../03_Bugs/BUG-0066_mobile-source-form-controls-fall-below-the-touch-target-baseline.md) | fixed | sev-2 | 2026-07-28 | 2026-07-30 | - |
| BUG-0067 | [Mobile navigation and evidence sheets do not isolate keyboard focus](../03_Bugs/BUG-0067_mobile-navigation-and-evidence-sheets-do-not-isolate-keyboard-focus.md) | fixed | sev-2 | 2026-07-28 | 2026-07-30 | - |
| BUG-0068 | [Source attachment checkboxes have indistinguishable accessible names](../03_Bugs/BUG-0068_source-attachment-checkboxes-have-indistinguishable-accessible-names.md) | fixed | sev-2 | 2026-07-28 | 2026-07-30 | - |
| BUG-0069 | [Reports navigation is permanently disabled and notebook is undiscoverable](../03_Bugs/BUG-0069_reports-navigation-is-permanently-disabled-and-notebook-is-undiscoverable.md) | fixed | sev-2 | 2026-07-28 | 2026-08-01 | - |
| BUG-0085 | [Terminal failed research run remains labeled Reconnecting](../03_Bugs/BUG-0085_terminal-failed-research-run-remains-labeled-reconnecting.md) | fixed | sev-2 | 2026-07-28 | 2026-08-03 | - |
| BUG-0086 | [Notebook report 404 remains stuck in loading state](../03_Bugs/BUG-0086_notebook-report-404-remains-stuck-in-loading-state.md) | fixed | sev-2 | 2026-07-28 | 2026-08-03 | - |
| BUG-0097 | [Mixed source light theme metadata text fails contrast](../03_Bugs/BUG-0097_mixed-source-light-theme-metadata-text-fails-contrast.md) | fixed | sev-2 | 2026-07-28 | 2026-08-03 | - |
| BUG-0098 | [Mixed source dataset type labels fail contrast in both themes](../03_Bugs/BUG-0098_mixed-source-dataset-type-labels-fail-contrast-in-both-themes.md) | fixed | sev-2 | 2026-07-28 | 2026-08-03 | - |
| BUG-0099 | [Mixed source dark dataset definition labels fail contrast](../03_Bugs/BUG-0099_mixed-source-dark-dataset-definition-labels-fail-contrast.md) | fixed | sev-2 | 2026-07-28 | 2026-08-03 | - |
| BUG-0048 | [Workspace source attachments do not enqueue text indexing](../03_Bugs/BUG-0048_workspace-source-attachments-do-not-enqueue-text-indexing.md) | fixed | sev-2 | 2026-07-26 | 2026-07-26 | - |
| BUG-0038 | [Research replay loses durable job ownership before cancellation verification](../03_Bugs/BUG-0038_research-replay-loses-durable-job-ownership-before-cancellation-verification.md) | fixed | sev-2 | 2026-07-25 | 2026-07-25 | - |
| BUG-0040 | [API workspace bootstrap prevents health checks during database outages](../03_Bugs/BUG-0040_api-workspace-bootstrap-prevents-health-checks-during-database-outages.md) | fixed | sev-2 | 2026-07-24 | 2026-07-25 | - |
| BUG-0106 | [Project list API exposes workspace IDs despite its response contract](../03_Bugs/BUG-0106_project-list-api-exposes-workspace-ids-despite-its-response-contract.md) | fixed | sev-3 | 2026-08-01 | 2026-08-03 | - |
| BUG-0105 | [Raw bun test bypasses isolated e2e runner](../03_Bugs/BUG-0105_raw-bun-test-bypasses-isolated-e2e-runner.md) | invalid | sev-3 | 2026-07-31 | - | - |
| BUG-0108 | [Active Context refresh counts resolved critical bugs as open](../03_Bugs/BUG-0108_active-context-refresh-counts-resolved-critical-bugs-as-open.md) | fixed | sev-3 | 2026-07-31 | 2026-08-03 | - |
| BUG-0102 | [Authenticated API mutations can race workspace bootstrap](../03_Bugs/BUG-0102_authenticated-api-mutations-can-race-workspace-bootstrap.md) | fixed | sev-3 | 2026-07-29 | 2026-07-29 | - |
| BUG-0103 | [Authenticated metrics are unavailable during workspace bootstrap](../03_Bugs/BUG-0103_authenticated-metrics-are-unavailable-during-workspace-bootstrap.md) | fixed | sev-3 | 2026-07-29 | 2026-07-29 | - |
| BUG-0104 | [Auth integration test races workspace readiness](../03_Bugs/BUG-0104_auth-integration-test-races-workspace-readiness.md) | fixed | sev-3 | 2026-07-29 | 2026-07-29 | - |
| BUG-0062 | [Source views lack a route-level h1 heading](../03_Bugs/BUG-0062_source-views-lack-a-route-level-h1-heading.md) | fixed | sev-3 | 2026-07-28 | 2026-07-29 | - |
| BUG-0070 | [New project is missing from project navigation until reload](../03_Bugs/BUG-0070_new-project-is-missing-from-project-navigation-until-reload.md) | fixed | sev-3 | 2026-07-28 | 2026-08-01 | - |
| BUG-0071 | [Add Source leaves focus in workspace navigation after route change](../03_Bugs/BUG-0071_add-source-leaves-focus-in-workspace-navigation-after-route-change.md) | fixed | sev-3 | 2026-07-28 | 2026-08-03 | - |
| BUG-0072 | [Workspace routes reuse one generic browser title](../03_Bugs/BUG-0072_workspace-routes-reuse-one-generic-browser-title.md) | fixed | sev-3 | 2026-07-28 | 2026-08-03 | - |
| BUG-0073 | [Workspace has no skip link past repeated navigation](../03_Bugs/BUG-0073_workspace-has-no-skip-link-past-repeated-navigation.md) | fixed | sev-3 | 2026-07-28 | 2026-08-03 | - |
| BUG-0074 | [Unknown routes render an empty main region](../03_Bugs/BUG-0074_unknown-routes-render-an-empty-main-region.md) | fixed | sev-3 | 2026-07-28 | 2026-08-03 | - |
| BUG-0075 | [Global Sources route has no active navigation state](../03_Bugs/BUG-0075_global-sources-route-has-no-active-navigation-state.md) | fixed | sev-3 | 2026-07-28 | 2026-08-03 | - |
| BUG-0076 | [Successful source import is not announced](../03_Bugs/BUG-0076_successful-source-import-is-not-announced.md) | fixed | sev-3 | 2026-07-28 | 2026-08-03 | - |
| BUG-0077 | [Workspace searches provide no results feedback](../03_Bugs/BUG-0077_workspace-searches-provide-no-no-results-feedback.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0078 | [Project search leaves unrelated recent projects visible](../03_Bugs/BUG-0078_project-search-leaves-unrelated-recent-projects-visible.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0079 | [Active source import mode has insufficient visual contrast](../03_Bugs/BUG-0079_active-source-import-mode-has-insufficient-visual-contrast.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0080 | [Dataset and Folder import modes lack mode-specific guidance](../03_Bugs/BUG-0080_dataset-and-folder-import-modes-lack-mode-specific-guidance.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0081 | [Disabled Reports destination is nearly invisible](../03_Bugs/BUG-0081_disabled-reports-destination-is-nearly-invisible.md) | fixed | sev-3 | 2026-07-28 | 2026-08-01 | - |
| BUG-0082 | [Unavailable project attachment control has no explanation](../03_Bugs/BUG-0082_unavailable-project-attachment-control-has-no-explanation.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0083 | [Conversation source checkbox touch target is only 25 pixels high](../03_Bugs/BUG-0083_conversation-source-checkbox-touch-target-is-only-25-pixels-high.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0084 | [Failed research submission returns no user-visible error](../03_Bugs/BUG-0084_failed-research-submission-returns-no-user-visible-error.md) | invalid | sev-3 | 2026-07-28 | - | - |
| BUG-0087 | [Research error variants lack browser coverage](../03_Bugs/BUG-0087_research-error-variants-lack-browser-coverage.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0088 | [Research cancellation failure lacks browser coverage](../03_Bugs/BUG-0088_research-cancellation-failure-lacks-browser-coverage.md) | fixed | sev-3 | 2026-07-28 | 2026-08-04 | - |
| BUG-0091 | [Notebook finding selection and citation warning lack browser coverage](../03_Bugs/BUG-0091_notebook-finding-selection-and-citation-warning-lack-browser-coverage.md) | invalid | sev-3 | 2026-07-28 | - | - |
| BUG-0092 | [Report export failure lacks browser coverage](../03_Bugs/BUG-0092_report-export-failure-lacks-browser-coverage.md) | invalid | sev-3 | 2026-07-28 | - | - |
| BUG-0093 | [Add project hash focus journey lacks browser regression coverage](../03_Bugs/BUG-0093_add-project-hash-focus-journey-lacks-browser-regression-coverage.md) | invalid | sev-3 | 2026-07-28 | - | - |
| BUG-0053 | [Pre-existing e2e infra defects surface as failures independent of brand phase](../03_Bugs/BUG-0053_pre-existing-e2e-infra-defects-surface-as-failures-independent-of-brand-phase.md) | fixed | sev-3 | 2026-07-27 | 2026-07-27 | - |
| BUG-0054 | [Error toast position inconsistent between add source and add project screens](../03_Bugs/BUG-0054_error-toast-position-inconsistent-between-add-source-and-add-project-screens.md) | fixed | sev-3 | 2026-07-27 | 2026-07-27 | - |
| BUG-0055 | [Add source view shows only error and no fields or options](../03_Bugs/BUG-0055_add-source-view-shows-only-error-and-no-fields-or-options.md) | fixed | sev-3 | 2026-07-27 | 2026-07-27 | - |
| BUG-0056 | [light-dark-mode-switch-positioned-awkwardly-and-covered-by-error-toast](../03_Bugs/BUG-0056_light-dark-mode-switch-positioned-awkwardly-and-covered-by-error-toast.md) | fixed | sev-3 | 2026-07-27 | 2026-07-28 | - |
| BUG-0057 | [full e2e suite leaks process state before mixed-source report tests](../03_Bugs/BUG-0057_full-e2e-suite-leaks-process-state-before-mixed-source-report-tests.md) | fixed | sev-3 | 2026-07-27 | 2026-07-28 | - |
| BUG-0058 | [workspace release e2e times out under full-suite docker cold-start contention](../03_Bugs/BUG-0058_workspace-release-e2e-times-out-under-full-suite-docker-cold-start-contention.md) | fixed | sev-3 | 2026-07-27 | 2026-07-28 | - |
| BUG-0041 | [Project creation controls overlap when the name field is focused](../03_Bugs/BUG-0041_project-creation-controls-overlap-when-the-name-field-is-focused.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0042 | [Center workspace is fragmented by redundant title chrome and card framing](../03_Bugs/BUG-0042_center-workspace-is-fragmented-by-redundant-title-chrome-and-card-framing.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0043 | [Workspace navigation lacks project, source, and recent discovery sections](../03_Bugs/BUG-0043_workspace-navigation-lacks-project-source-and-recent-discovery-sections.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0044 | [Navigation discovery sections lack direct creation actions](../03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0045 | [Sources are scoped to one project and cannot be reused](../03_Bugs/BUG-0045_sources-are-scoped-to-one-project-and-cannot-be-reused.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0046 | [Global source import is blocked by project selection](../03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0047 | [Source import notice ignores the source library content gutter](../03_Bugs/BUG-0047_source-import-notice-ignores-the-source-library-content-gutter.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0050 | [Workspace responsive e2e test retains obsolete project-gated source action contract](../03_Bugs/BUG-0050_workspace-responsive-e2e-test-retains-obsolete-project-gated-source-action-contract.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0051 | [Manage source library navigation link misses the 44px touch-target minimum](../03_Bugs/BUG-0051_manage-source-library-navigation-link-misses-the-44px-touch-target-minimum.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0052 | [Directory source import rejects a local canonical corpus with HTTP 413](../03_Bugs/BUG-0052_directory-source-import-rejects-a-local-canonical-corpus-with-http-413.md) | fixed | sev-3 | 2026-07-26 | 2026-07-26 | - |
| BUG-0039 | [Recursive evaluation setup timeout is too short under full-suite load](../03_Bugs/BUG-0039_recursive-evaluation-setup-timeout-is-too-short-under-full-suite-load.md) | fixed | sev-3 | 2026-07-25 | 2026-07-25 | - |
| BUG-0037 | [Root dev command does not propagate environment to workspace apps](../03_Bugs/BUG-0037_root-dev-command-does-not-propagate-environment-to-workspace-apps.md) | fixed | sev-3 | 2026-07-24 | 2026-07-24 | - |
| BUG-0033 | [E2E project lifecycle cache test asserts a nonexistent level-two project heading](../03_Bugs/BUG-0033_e2e-project-lifecycle-cache-test-asserts-a-nonexistent-level-two-project-heading.md) | fixed | sev-3 | 2026-07-23 | 2026-07-23 | - |
| BUG-0034 | [Recursive analysis responsive E2E emits unhandled 500 responses](../03_Bugs/BUG-0034_recursive-analysis-responsive-e2e-emits-unhandled-500-responses.md) | fixed | sev-3 | 2026-07-23 | 2026-07-23 | - |
| BUG-0035 | [V1 browser journey gate stubs every API route instead of using the real stack](../03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack.md) | fixed | sev-3 | 2026-07-23 | 2026-07-25 | - |
| BUG-0036 | [Automated code review capacity is rate-limited for PR #72](../03_Bugs/BUG-0036_automated-code-review-capacity-is-rate-limited-for-pr-72.md) | fixed | sev-3 | 2026-07-23 | 2026-07-23 | - |
| BUG-0032 | [E2E build artifacts break canonical lint gate](../03_Bugs/BUG-0032_e2e-build-artifacts-break-canonical-lint-gate.md) | fixed | sev-3 | 2026-07-22 | 2026-07-22 | - |
| BUG-0012 | [Frontend loads DaisyUI but bypasses its component framework](../03_Bugs/BUG-0012_frontend-loads-daisyui-but-bypasses-its-component-framework.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0014 | [Documentation roadmap links point to removed phase paths](../03_Bugs/BUG-0014_documentation-roadmap-links-point-to-removed-phase-paths.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0015 | [Citation navigation bypasses configured web base path](../03_Bugs/BUG-0015_citation-navigation-bypasses-configured-web-base-path.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0016 | [Base-path citation regression test is not isolated in the full test suite](../03_Bugs/BUG-0016_base-path-citation-regression-test-is-not-isolated-in-the-full-test-suite.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0017 | [Staged planning documents fail whitespace validation](../03_Bugs/BUG-0017_staged-planning-documents-fail-whitespace-validation.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0018 | [Vite proxy regression test does not typecheck](../03_Bugs/BUG-0018_vite-proxy-regression-test-does-not-typecheck.md) | fixed | sev-3 | 2026-07-21 | 2026-07-21 | - |
| BUG-0011 | [STEP-06-01 post-merge contract review findings](../03_Bugs/BUG-0011_step-06-01-post-merge-contract-review-findings.md) | fixed | sev-3 | 2026-07-20 | 2026-07-20 | - |
| BUG-0001 | [Research completion rejects serialized PostgreSQL JSONB payloads](../03_Bugs/BUG-0001_research-completion-rejects-serialized-postgresql-jsonb-payloads.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0002 | [SourceVersion ingestion attempt accepts forged aggregate scope](../03_Bugs/BUG-0002_sourceversion-ingestion-attempt-accepts-forged-aggregate-scope.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0003 | [Source registration persists unauthorized mismatched aggregate scope](../03_Bugs/BUG-0003_source-registration-persists-unauthorized-mismatched-aggregate-scope.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0004 | [Source text reindex lacks continuous lease renewal and database clock recovery](../03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0005 | [Canonical DuckDB runtime documentation contradicts Bun only host boundary](../03_Bugs/BUG-0005_canonical-duckdb-runtime-documentation-contradicts-bun-only-host-boundary.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0006 | [Job transitions persist unvalidated cross-domain journal payloads](../03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0007 | [Event journal cursors can commit out of replay order](../03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0008 | [Generic EventJournal append bypasses typed transition contracts](../03_Bugs/BUG-0008_generic-eventjournal-append-bypasses-typed-transition-contracts.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0009 | [Source registration persists extra sensitive payload fields](../03_Bugs/BUG-0009_source-registration-persists-extra-sensitive-payload-fields.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
| BUG-0010 | [Solid theme toggle does not apply the selected theme](../03_Bugs/BUG-0010_solid-theme-toggle-does-not-apply-the-selected-theme.md) | fixed | sev-3 | 2026-07-19 | 2026-07-19 | - |
<!-- AGENT-END:bugs-index -->

## Useful Links

- Template: [[07_Templates/Bug_Template|Bug Template]]
- Severity reference: [[06_Shared_Knowledge/Bug_Taxonomy|Bug Taxonomy]]
- Current work: [[00_Home/Active_Context|Active Context]]
