# Validation Plan

- Acceptance: 375, 768, 1024, and 1440px layouts preserve all actions and state; the keyboard-only end-to-end flow works; automated accessibility checks report no serious violations.
- Direct checks: accessibility audit, computed contrast, focus order, reduced-motion, large-text, theme screenshots, and mobile/landscape Playwright coverage.
- Regression: no DaisyUI bypass expansion; custom CSS remains bounded to layout and project tokens.

## Refinement Addendum — Exact Validation

### Automated checks

```bash
bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 apps/web/src/components/workspace-accessibility.test.tsx apps/web/src/base-path.test.ts apps/web/src/components/citation-base-path.test.tsx apps/web/src/pages/citation-page.test.ts
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/workspace-accessibility.spec.ts apps/web/e2e/workspace-responsive.spec.ts apps/web/e2e/walking-skeleton.spec.ts apps/web/e2e/recursive-analysis.spec.ts apps/web/e2e/notebook-report.spec.ts
bun run typecheck
bun run lint
bun run lint:imports
bun run test
bun run test:integration
bun run build
bun run docs:lint
bun run secrets:scan
```

### Required matrix and evidence

- Run 375×812, 768×1024, 1024×768, and 1440×900 in `struct-light` and `struct-dark`; add 812×375 and any distinct tablet landscape case.
- Repeat the primary keyboard journey and base-path assertions at `/struct/projects/:projectId`.
- Axe reports no critical/serious violations in empty project, importing/progress, conversation/reconnect/error, evidence open/stale, note edit/conflict, and archived states.
- Capture computed contrast for primary/secondary text, controls/focus rings, alerts/status, and evidence metadata in both themes; assert target ratios.
- Tab/Shift-Tab order, sheet/drawer focus entry, Escape/backdrop close, focus return, disabled composer explanation, live progress, and error announcement are deterministic.
- At 200% zoom/large text: no hidden action, viewport horizontal overflow, clipped control, or fixed element covering content. At reduced motion, computed transition/scroll behavior is nonessential-free.
- Mobile activity banner reserves space above the composer; virtual keyboard and landscape retain composer/actions; failure banners remain actionable.
- Theme persists across navigation/reload and both `html`/app root match. Console/network collection reports zero unexpected errors/failures.
- Generate the real-workspace screenshot/accessibility artifact manifest for 375/768/1024/1440 × light/dark and update `docs/accessibility.md`; remove or clearly supersede stale 390px/fixture evidence.

### Manual accessibility checks

- Complete the full workflow keyboard-only and inspect the accessibility tree with VoiceOver or an equivalent screen reader for project chooser, import progress, streamed answer, evidence, and note editor.
- Record browser, OS, assistive technology, theme, viewport, findings, and remediation. Any confirmed accessibility defect blocks exit.

### Exit gate

- Automated/manual matrices and artifacts pass, no DaisyUI bypass or base-path/theme regression exists, full repository gates are green, and no confirmed defect remains before STEP-10-08.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
