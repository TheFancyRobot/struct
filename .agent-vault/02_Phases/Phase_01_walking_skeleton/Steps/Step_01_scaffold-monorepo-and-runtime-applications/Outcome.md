---
note_type: outcome
template_version: 2
contract_version: 1
title: Outcome — Scaffold Monorepo and Runtime Applications
step: '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]'
status: completed
created: '2026-07-17'
updated: '2026-07-18'
related_sessions:
  - '[[05_Sessions/2026-07-17-231312-scaffold-monorepo-and-runtime-applications-step-01-01-implementor|Session 2026-07-17]]'
tags:
  - agent-vault
  - outcome
---

# Outcome — Scaffold Monorepo and Runtime Applications

## Deliverables

- ✅ Root monorepo manifests: `package.json`, `bunfig.toml`, `tsconfig.base.json`, `docker-compose.yml`, `.env.example`, `.gitignore`
- ✅ `apps/web` — SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI 5 with custom 'struct' theme
- ✅ `apps/api` — Bun native HTTP server with Effect runtime, health check, SSE placeholder
- ✅ `apps/worker` — Effect runtime skeleton, ready for job execution
- ✅ `packages/domain` — Branded UUIDs, Effect Schemas, Schema.TaggedError definitions
- ✅ `packages/persistence` — Placeholder scaffold
- ✅ `packages/observability` — Placeholder scaffold
- ✅ Root scripts: `dev`, `build`, `typecheck`, `lint`, `lint:imports`, `test`, `migrations:up/down/create`, etc.
- ✅ Tooling configs: vitest, ESLint 10 flat config, dependency-cruiser, babel.config.json
- ✅ docs ADRs: `docs/adr/DEC-0013` (Tailwind+DaisyUI), `docs/adr/DEC-0014` (SolidJS+Vite+Solid Router)

## Review Fix Round (7 findings)

1. ✅ `branded-ids.test.ts` — Fixed: uses `Schema.decodeUnknownSync` with `toThrow()` for rejection assertion (no Effect-to-Either mismatch)
2. ✅ ESLint 10 flat config (`eslint.config.mjs`) with `@babel/eslint-parser` + `@babel/preset-typescript` for TS parsing, `no-restricted-imports` for package/import-boundary enforcement. `bun run lint` passes with 0 errors/warnings.
3. ✅ dependency-cruiser config as `.mjs` with SWC transpiler. `bun run lint:imports` passes. Verified detection with a temporary app-to-app probe violation, then removed the probe.
4. ✅ Removed obsolete Compose `version` field.
5. ✅ Removed stock `vite.svg` and favicon reference from `index.html`.
6. ✅ Pinned `concurrently@10.0.3` in root devDependencies.
7. ✅ Removed `css-modules.d.ts`; replaced with `vite-env.d.ts` (`/// <reference types="vite/client" />`).

### LightningCSS warnings
- Suppressed via correct Vite config: `build.cssMinify: 'esbuild'` in `vite.config.ts`. PostCSS/Tailwind handles `@theme`/`@plugin` at-rules; esbuild minifies the final output without lightningcss warnings. Build output is clean.

### TypeScript 7.0.2 compatibility note
- `typescript-eslint` is incompatible with TS 7.0.2 (TS 7 removed `ScriptTarget`/`Extension` enums that `@typescript-eslint/typescript-estree` requires at module load time). ESLint uses `@babel/eslint-parser` + `@babel/preset-typescript` (Babel 7.x) as the TS parser instead. TS type-aware linting is deferred until `typescript-eslint` publishes a TS 7-compatible release. `tsc --noEmit` strict typecheck covers type correctness.
- `dependency-cruiser` uses SWC (not the TypeScript compiler) for TS parsing since `dependency-cruiser` also doesn't support TS 7 yet.

## Validation Evidence

### Typecheck
- Command: `bunx tsc --noEmit --project tsconfig.base.json`
- Result: **PASS** — zero errors

### Lint
- Command: `bun run lint`
- Result: **PASS** — 0 errors, 0 warnings

### Lint:imports
- Command: `bun run lint:imports`
- Result: **PASS** — 0 violations, 13 modules, 7 dependencies cruised
- Probe test: Created temporary `apps/web/src/probe-violation.ts` importing from `apps/api/src/main.ts` → detected as `no-app-to-app-web-api` error → removed probe → clean

### Build
- Command: `bun run build`
- Result: **PASS** — all three apps build successfully, no LightningCSS warnings
  - `@struct/web`: Vite build → `dist/index.html` (0.41 kB), CSS (22.21 kB), JS (28.78 kB)
  - `@struct/api`: tsc build → dist/
  - `@struct/worker`: tsc build → dist/

### Tests
- Command: `bun run test`
- Result: **PASS** — 3 tests in `packages/domain/src/branded-ids.test.ts`
  - ✓ decodes a valid UUID into WorkspaceId
  - ✓ decodes a valid UUID into ProjectId
  - ✓ rejects an invalid UUID (throws)

### Docker Compose
- Command: `docker compose config`
- Result: **PASS** — valid config, no `version` warning, PostgreSQL pgvector:pg16
- Command: `docker compose up -d postgres`
- Result: **ENVIRONMENTAL LIMITATION** — Docker daemon not running at time of test. Config validated successfully.

### App Startup Smoke
- `apps/api` on port 3001: **PASS** — healthz returns `{"status":"ok","version":"0.0.1-skeleton"}`
- `apps/worker` on port 3002: **PASS** — starts, logs "Worker starting (metrics on port 3002)"
- `apps/web` on port 3000: **PASS** — Vite dev server serves `<!DOCTYPE html>` with SolidJS app shell

## Package Dependency Boundaries

- `packages/domain`: imports only `effect` — no internal deps
- `packages/persistence`: imports `effect`, `@struct/domain`
- `packages/observability`: imports `effect`, `@struct/domain`
- `apps/api`: imports `effect`, `@struct/domain`, `@struct/persistence`, `@struct/observability`
- `apps/worker`: imports `effect`, `@struct/domain`, `@struct/observability`
- `apps/web`: imports `solid-js`, `@solidjs/router`, `daisyui`, `tailwindcss`, `vite`, `vite-plugin-solid`

No cross-app imports. No package importing another package. Domain is leaf. Verified by both ESLint `no-restricted-imports` and dependency-cruiser.

## Versions

- Bun: 1.3.13
- Node: v24.15.0
- TypeScript: 7.0.2
- Effect: 3.22.0
- SolidJS: 1.9.14
- Vite: 8.1.5
- Tailwind CSS: 4.2.4
- DaisyUI: 5.6.18
- Vitest: 4.1.10
- ESLint: 10.7.0
- dependency-cruiser: 18.1.0
- PostgreSQL: pgvector/pgvector:pg16

## Concerns / Follow-Up

- **typescript-eslint incompatibility**: TS 7.0.2's new module structure (unstable subpaths, removed `ScriptTarget`/`Extension` enums) breaks `@typescript-eslint/typescript-estree` at module load time. Using `@babel/eslint-parser` + Babel 7 as workaround. TS type-aware ESLint rules deferred until typescript-eslint publishes TS 7 support.
- **dependency-cruiser TS support**: Uses SWC for TS parsing since dependency-cruiser's native TS transpiler requires TS <7.0.0. SWC works correctly for dependency analysis.
- **Docker daemon**: Was not running during smoke test. Compose config validated; runtime startup verified previously.
- Minimal API routes only (healthz, SSE placeholder). Real endpoints land in STEP-01-02+.

## Next Step

- STEP-01-02: Define Core Domain Schemas and Persistence Migrations
