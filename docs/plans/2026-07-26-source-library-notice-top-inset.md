# Source-library notice top inset Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Keep the global source-library attachment notice 16px/24px below the central workspace top edge.

**Architecture:** The source library's shared `SourcesPage` wrapper owns its layout gutter. Add responsive top padding there so its first child—the attachment notice—cannot render at `top: 0`. Extend the existing Playwright browser regression rather than adding a component or layout abstraction.

**Tech Stack:** SolidJS, Tailwind CSS, Bun test, Playwright.

---

### Task 1: Guard and fix the top inset

**Files:**
- Modify: `apps/web/e2e/source-import.spec.ts`
- Modify: `apps/web/src/pages/SourcesPage.tsx`
- Modify: `.agent-vault/03_Bugs/BUG-0047_source-import-notice-ignores-the-source-library-content-gutter.md`

**Step 1: Write the failing test**

Extend the existing global-library responsive browser test. At 375px and 1440px, measure the attachment notice card, `main .overflow-auto`, and require its top offset to be 16px/24px respectively.

**Step 2: Run test to verify it fails**

Run: `bun test --timeout 120000 --max-concurrency 1 ./apps/web/e2e/source-import.spec.ts`

Expected: the new assertion fails because the notice top offset is `0`.

**Step 3: Write minimal implementation**

Add `pt-4 sm:pt-6` to the existing `SourcesPage` wrapper. Do not add components, variables, or independent per-card spacing.

**Step 4: Run validation**

Run:
- `bun test --timeout 120000 --max-concurrency 1 ./apps/web/e2e/source-import.spec.ts`
- `bun run --filter @struct/web typecheck`
- vault validation

Expected: focused e2e passes at both widths, typecheck and vault validation are clean.

**Step 5: Update the bug record and commit**

Record the vertical root cause, validation evidence, and fixed status. Commit the minimal change.
