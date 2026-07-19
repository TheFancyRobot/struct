# DEC-0014: Use SolidJS 1.9, Vite 8, and Solid Router for Frontend Runtime

## Status

Accepted.

## Context

The frontend needs a framework that integrates cleanly with TypeScript 7.0.2, Bun, Effect, SSE-driven state, and the Tailwind/DaisyUI system already selected (DEC-0013). The UI must drive fine-grained reactive state (SSE events, research progress, citation state) with minimal bundle and excellent incremental rendering. The project must avoid forcing TypeScript 7 patches or disabling type-checking, and must keep the build tooling simple for a Bun-native workspace.

A prior attempt used Next.js, which required a local `typescript/lib/typescript.js` compatibility shim and separately enabled `typescript.ignoreBuildErrors`. This violated the project's TypeScript hygiene contract (DEC-0003): it disabled the project's own strict checks behind a framework-supplied shim, creating upgrade fragility and a hidden dependency on Next.js pinning the compiler version.

## Decision Drivers

- Fine-grained reactivity for SSE-driven state (many small, frequent DOM updates)
- TypeScript 7.0.2 strict mode with no patches or disabled checks
- Bun-native workspace with simple build tooling
- Minimal bundle size
- No SSR requirement (authenticated SPA)
- Library-mode routing (not file-based, not SolidStart)

## Decision

- **Framework:** SolidJS 1.9 as the primary UI library.
- **Build tool:** Vite 8 as the frontend build tool with `vite-plugin-solid`.
- **Routing:** Solid Router in library mode with programmatic configuration (not file-based routing).
- `apps/web` is a Vite 8 + SolidJS 1.9 SPA that consumes the typed API client over fetch/SSE.
- **No SolidStart.** SolidStart is explicitly rejected; the app is a Vite-built SPA with programmatic routing only.
- The Effect API/worker layer is kept separate (DEC-0003); `apps/web` communicates with the API process over HTTP and SSE only.
- Frontend TypeScript configuration uses TS 7.0.2 with `noUnusedLocals`, `noUnusedParameters`, and strict mode enabled — no patches and no disabled checks.

## Considered Options

- **SolidJS 1.9 + Vite 8 + Solid Router** — chosen. Fine-grained reactivity, small bundle, clean TS7 integration, no patches needed.
- **Next.js (App Router)** — rejected. Required a TS7 compatibility shim and `typescript.ignoreBuildErrors`, violating DEC-0003. Build tooling mismatch (Turbopack/Webpack). Overhead for SPA surface.
- **React + Vite** — rejected. Viable but SolidJS wins on fine-grained reactivity for SSE-driven state. React's batching model produces more re-renders. Larger bundle.
- **Svelte / SvelteKit** — rejected. Svelte native TS7 checker failed. SvelteKit's TypeScript peer range excludes TS7. Ecosystem lock-in to file-based routing.
- **Other (Astro, Qwik, Preact)** — rejected. Not a fit for streaming real-time research UI or add unnecessary abstraction.

## Consequences

### Positive

- Fine-grained reactivity reduces unnecessary re-renders for SSE-driven state
- SolidJS produces a smaller runtime bundle than React + React DOM
- Solid's type system maps cleanly to TS 7.0.2 with no patches needed
- The frontend uses the repository-wide native `bun:test` runner; Vite remains the build and development tool only
- Library-mode Solid Router gives full programmatic control over routes
- Aligns with the Effect/functional-reactive paradigm already chosen for the backend

### Negative

- SolidJS 1.9 has a smaller ecosystem than React; fewer component patterns, testing utilities, and third-party libraries
- Vite 8 is a newer major version; the Solid plugin ecosystem may lag React/Vite integrations in maturity
- Solid Router is maintained by a small team; API stability is good but community resources are thinner than React Router
- Developers must think in terms of signals and granular subscriptions rather than component re-renders
- No SSR benefit for SEO or initial paint (acceptable for authenticated research workspace)
- `typescript-eslint` and `eslint-plugin-solid` are both incompatible with TS 7.0.2 (they depend on `@typescript-eslint/typescript-estree` which crashes on TS7's removed `ScriptTarget`/`Extension` enums). ESLint uses `@babel/eslint-parser` + Babel 7 as a TS7-compatible workaround. TS type-aware linting is deferred until the ecosystem catches up.

## Links

- [DEC-0013: Use Tailwind CSS 4 and DaisyUI with a Project-Owned Custom Theme](./DEC-0013-use-tailwind-css-4-and-daisyui-with-a-project-owned-custom-theme.md) — styling layer consumed by this frontend
- [DEC-0003: Use TypeScript, Bun, and Effect with Explicit Runtime Boundaries](./DEC-0003-use-typescript-bun-and-effect-with-explicit-runtime-boundaries.md) — TypeScript + Bun runtime boundaries
- [DEC-0008: Own the Typed API and Live Research Event Stream](./DEC-0008-own-the-typed-api-and-live-research-event-stream.md) — API and SSE model consumed by the frontend
- [docs/frontend-architecture.md](../frontend-architecture.md) — full frontend contract

## Related Phase

- [PHASE-00 Architecture Spikes and Delivery Foundations](../../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md)
- [PHASE-01 Walking Skeleton](../../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md)
