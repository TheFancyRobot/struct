# Accessibility and responsive UI evidence

Struct v1 targets WCAG 2.2 AA behavior for the maintained SolidJS research,
citation, and report workflows. Accessibility is a release gate: keyboard,
focus, semantics, status/error communication, color contrast, reduced motion,
and reflow are tested in the production bundle.

## Reproduce the evidence

Run the focused report-workspace contract after building the current UI:

```sh
bun run --filter @struct/web build
bun test --timeout 60000 --max-concurrency 1 \
  apps/web/e2e/notebook-report.spec.ts
```

Run every maintained browser journey with:

```sh
bun run test:e2e
```

The final closure run passed 22/22 browser tests with 434 assertions.

The browser tests fail on console errors, page errors, request failures,
horizontal document overflow, incorrect theme application, broken keyboard
navigation, lost dialog focus, inaccessible status/error states, or a failed
workflow assertion. They exercise the built Vite output rather than a separate
test-only render.

## Accessibility contract

| Concern | Executable evidence |
| --- | --- |
| Keyboard | Citation links, expandable evidence, mobile report tabs, report editing/reordering, history, publish/export, and repair actions are operated through keyboard events in `apps/web/e2e/*.spec.ts`. |
| Focus | The repair dialog receives focus, traps forward and reverse Tab, closes with Escape, and restores focus to its trigger. Successful mutations move focus to the live status message. |
| Dialogs | The repair surface uses one named `dialog`, `aria-modal="true"`, a named close control, Escape handling, focus containment, and trigger restoration. |
| Landmarks and structure | The application exposes one `main` landmark. The report editor is a named `region`; page, workspace, outline, inspector, and section headings preserve document structure. |
| Names and labels | The focused gate rejects any visible button, link, input, textarea, select, or summary without a text or programmatic name. The report textarea and finding checkboxes have explicit labels. |
| Live status and errors | Loading and saved states use `status`/polite live regions; connection, stale-write, publication, and route failures use `alert`; recovery controls remain keyboard operable. |
| Contrast | The focused gate calculates WCAG relative-luminance ratios for normal report text and its title in both project themes and requires at least 4.5:1. |
| Reduced motion | Browser contexts request reduced motion; the global CSS contract collapses animation/transition duration and disables smooth scrolling. The evidence drawer removes its transition. |
| Reflow and zoom | The focused gate proves no document or component overflow at 320 CSS pixels, the reflow equivalent of 200% zoom on a 640-pixel viewport. The full matrix also covers 390×844, 1024×768, and 1440×900. |
| Error recovery | Offline, stale-write, export-blocked, loading, empty, reconnecting, cancelled, API-error, and missing-citation states are asserted without silent failure. |

## Responsive screenshot review

The canonical report-workspace images are committed under
[`docs/demos/report-workspace/`](./demos/report-workspace/). They were visually
reviewed at the exact release viewports:

| Viewport | Light | Dark | Review result |
| --- | --- | --- | --- |
| 1440×900 | [`1440x900-light.png`](./demos/report-workspace/1440x900-light.png) | [`1440x900-dark.png`](./demos/report-workspace/1440x900-dark.png) | Three-column workspace is balanced; controls and evidence remain legible; no clipping or overlap. |
| 1024×768 | [`1024x768-light.png`](./demos/report-workspace/1024x768-light.png) | [`1024x768-dark.png`](./demos/report-workspace/1024x768-dark.png) | Compact outline and editor retain hierarchy and usable density; no horizontal overflow. |
| 390×844 | [`390x844-light.png`](./demos/report-workspace/390x844-light.png) | [`390x844-dark.png`](./demos/report-workspace/390x844-dark.png) | Cards reflow to one column, primary controls remain reachable, and the outline scrolls within its own bounded surface without document overflow. |

The paired mixed-source screenshots under
[`docs/demos/mixed-source-research/`](./demos/mixed-source-research/) cover the
same six viewport/theme combinations for the research workbench. Screenshots
contain deterministic fixtures only—no credentials, private sources, prompts,
or production data.

## Known boundary

The automated contract checks browser semantics and behavior; it is not a
certification by every screen-reader/browser combination. The UI uses native
landmarks and controls so platform assistive technology can consume the same
tested names, states, and focus order without a parallel accessibility tree.
