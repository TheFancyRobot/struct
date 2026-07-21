# Execution Brief

- Prerequisites: STEP-10-01 through STEP-10-06 functional paths are integrated.
- Required reading: approved responsive/accessibility design; BUG-0012; DaisyUI/Tailwind decisions; current Playwright theme-readiness support.
- Starting files: workspace components, `apps/web/src/index.css`, theme-readiness helpers, and relevant e2e specs.
- Checklist: desktop three-pane/collapse, tablet evidence drawer, mobile source/evidence sheets, mobile activity banner above composer, 44px controls, semantic labels and landmarks, focus management, AA tokens, one SVG icon family, 150–300ms interruptible motion, and reduced-motion behavior.
- Edge cases: 200% zoom, large system text, landscape phone/tablet, virtual keyboard, long names, dark-mode reconnect/error states, drawer/sheet escape, and horizontal overflow.

## Refinement Addendum — Execution-Ready Contract

### Outcome and prerequisites

- Success means the complete Steps 01–06 workflow remains operable at the exact supported breakpoints, both themes, keyboard-only, browser accessibility tree/screen-reader review, 200% zoom/large text, reduced motion, landscape, reconnect, and error states.
- This is an audit/remediation pass over already accessible slices, not permission to defer basic semantics from earlier steps.

### Concrete starting points and required reading

- Shell/routes/styles: `apps/web/src/App.tsx`, `index.tsx`, `index.css`, `pages/HomePage.tsx`, `ResearchPage.tsx`, `NotebookPage.tsx`, and all new workspace pages/components.
- Stateful surfaces: `components/ResearchStream.tsx`, `NotebookView.tsx`, `ReportEditor.tsx`, `PartialFindingsPanel.tsx`, SourceImport/Activity, Conversation, Evidence, and Notes components.
- Base path/theme regressions: `base-path.ts`, `base-path.test.ts`, `components/citation-base-path.test.tsx`, `pages/citation-page.test.ts`, `e2e/support/theme-readiness.ts`.
- Browser references: `e2e/walking-skeleton.spec.ts`, `mixed-source-report.spec.ts`, `recursive-analysis.spec.ts`, `notebook-report.spec.ts`; add a focused accessibility/responsive workspace spec and `@axe-core/playwright` (or equivalent maintained Axe integration) if absent.
- Read `docs/accessibility.md`, BUG-0012, BUG-0015/0016, DEC-0013/0014, and the approved responsive/accessibility design.

### Exact behavior matrix

1. Breakpoints are mobile `<768`, tablet `768–1023`, desktop `>=1024`. Validate 375×812, 768×1024, 1024×768, and 1440×900, plus 812×375 and 1024×768 landscape where layout differs.
2. Desktop exposes stable three-pane/collapse behavior; tablet keeps left access and uses a right evidence drawer; mobile uses separate navigation/source and evidence sheets. Navigation and evidence are never simultaneous peer bottom navigation.
3. Mobile activity is a reserved banner above the composer; it never covers messages/actions, opens the progress sheet, and stays present for actionable failures.
4. Closed drawers/sheets are absent from tab/accessibility order. Open moves focus predictably, Escape/backdrop/close restores the opener, and route/viewport changes never strand focus.
5. Every interactive target is at least 44×44 CSS pixels; all icon-only controls have names; landmarks/headings/labels are unique; errors use text plus alert semantics; progress is polite and does not steal focus.
6. Normal text reaches 4.5:1 and large text/graphics 3:1 in both project themes. Status is never color-only. Theme choice persists and `html` plus app root remain synchronized.
7. At 200% zoom and large text, controls/actions remain reachable with no two-dimensional page scroll or clipped labels. Wide evidence scrolls inside its pane.
8. Motion is 150–300 ms, interruptible, transform/opacity-based, and nonessential motion is removed under `prefers-reduced-motion`; state changes remain understandable.
9. Virtual keyboard, reconnect, offline, partial/complete upload failure, research failure, note conflict, stale evidence, and dark-theme error states preserve content and actions.
10. Replace prior 390px-only demo evidence with the approved 375/768/1024/1440 real-workspace artifact matrix; do not treat old fixture screenshots as acceptance.

### Security, performance, recovery, non-goals, and handoff

- Accessibility metadata must not expose credentials, host paths, raw provider errors, or unauthorized resource names. Focus/inert handling cannot bypass action authorization.
- Prevent duplicate hidden component trees/listeners, layout thrash, cumulative layout shift from progress banners, and unbounded animation on SSE updates. No new UI/component system is allowed.
- Manual screen-reader/accessibility-tree findings are recorded with browser/OS/tool version and exact state; automated Axe alone is insufficient.
- Handoff records all remediation paths, the viewport/theme artifact manifest, remaining accepted limitations (if any must be zero release-blocking), and the exact journey STEP-10-08 must repeat.

### Readiness verdict

- **Pass.** Exact matrix, starting files, non-root/theme regressions, focus/screen-reader/zoom/motion behavior, failure states, performance/security, artifacts, and release handoff are concrete.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
