---
note_type: decision
template_version: 2
contract_version: 1
title: Use SolidJS, Vite 8, and Solid Router for Frontend Runtime
decision_id: DEC-0014
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]'
  - '[[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]'
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Code_Map|Code Map]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013]]'
tags:
  - agent-vault
  - decision
  - frontend
---

# DEC-0014 - Use SolidJS, Vite 8, and Solid Router for Frontend Runtime

Use one note per durable choice. Record what was chosen, why, tradeoffs, and supersession history, and link back to the phase, bug, or architecture note that made the choice necessary. See [[07_Templates/Note_Contracts|Note Contracts]].

## Status

- Current status: accepted.

## Context

- The frontend needs a framework that integrates cleanly with TypeScript 7.0.2, Bun, Effect, SSE-driven state, and the Tailwind/DaisyUI system already selected (DEC-0013).
- The UI must drive fine-grained reactive state (SSE events, research progress, citation state) with minimal bundle and excellent incremental rendering.
- The project must avoid forcing TypeScript 7 patches or disabling type-checking, and must keep the build tooling simple for a Bun-native workspace.

## Decision

- **Framework:** SolidJS 1.9 as the primary UI library.
- **Build tool:** Vite 8 as the frontend build tool.
- **Routing:** Solid Router for SPA routing within `apps/web`.
- `apps/web` is a Vite 8 + SolidJS 1.9 SPA that consumes the typed API client over fetch/SSE.
- **No SolidStart.** SolidStart is explicitly rejected; the app is a Vite-built SPA with programmatic routing only.
- The Effect API/worker layer is kept separate (DEC-0003); `apps/web` communicates with the API process over HTTP and SSE only.
- Frontend TypeScript configuration uses TS 7.0.2 with `noUnusedLocals`, `noUnusedParameters`, and strict mode enabled — no patches and no disabled checks.
- **Routing:** Solid Router in library mode with programmatic configuration (not file-based routing).

## Alternatives Considered

### Next.js (App Router) — Rejected

- **Required TypeScript 7 shim, not support:** The rejected attempt created a local `typescript/lib/typescript.js` compatibility file and separately enabled Next `typescript.ignoreBuildErrors`. This violated the project's TypeScript hygiene contract (DEC-0003): it disabled the project's own strict checks behind a framework-supplied shim, creating upgrade fragility and a hidden dependency on Next.js pinning the compiler version.
- **Build tooling mismatch:** Next.js pins its own bundler (Turbopack/Webpack) and controls the build pipeline. Integrating Vite for the frontend layer would create a dual-build-tool setup within `apps/web`, complicating the local dev experience and CI.
- **Overhead for SPA surface:** The research workspace is an SPA driven by SSE; server-side rendering provides negligible benefit for this interaction model.

### React + Vite — Rejected

- **Viable but not selected:** React with Vite is a sound and well-supported combination that would satisfy the technical requirements. It was considered as a fallback.
- **SolidJS wins on fine-grained reactivity:** Solid compiles templates to direct DOM updates and uses fine-grained reactivity without a Virtual DOM, producing finer-grained reactivity than React's batching model. This matters for a UI that continuously streams research progress events, citation updates, and SSE-driven state changes with many small, frequent DOM updates.
- **Bundle size:** SolidJS produces a smaller runtime bundle than React + React DOM for equivalent functionality.
- **TypeScript ergonomics:** Solid's type system maps cleanly to TS 7.0.2 with no patches needed.
- **Team preference:** SolidJS aligns better with the Effect/functional-reactive paradigm already chosen for the backend.

### Svelte / SvelteKit — Rejected

- **Svelte native TS7 checker failed:** The Svelte compiler's native TypeScript checker does not support TypeScript 7.0.2. Attempting to use Svelte with TS 7 results in compilation failures in the Svelte compiler itself.
- **SvelteKit's TypeScript peer range excludes TS7:** SvelteKit's TypeScript peer range excludes TS 7. Installing SvelteKit alongside TS 7 produces peer dependency resolution failures.
- **Ecosystem lock-in:** SvelteKit couples the app to its own file-based routing and server conventions, which would conflict with the Vite 8 + Solid Router approach already chosen.

### Other frameworks (Astro, Qwik, Preact) — Rejected

- **Astro:** Multi-framework framework suited to content-heavy sites; not a fit for a streaming real-time research UI.
- **Qwik:** Resumability model adds complexity for an SPA that already has SSE-driven state; no clear advantage.
- **Preact:** Smaller React alternative but inherits React's batching reactivity model and adds an extra abstraction layer with less community tooling for the specific SSE/research use case.

## Tradeoffs

- SolidJS 1.9 has a smaller ecosystem than React. Component patterns, testing utilities, and third-party libraries are fewer, though growing steadily.
- Vite 8 is a newer major version. While Vite itself is stable and widely adopted, the Solid plugin ecosystem may lag React/Vite integrations in maturity.
- Solid Router is the de facto standard router for SolidJS but is maintained by a small team; API stability is good but community resources are thinner than React Router.
- Fine-grained reactivity reduces unnecessary re-renders but requires developers to think in terms of signals and granular subscriptions rather than component re-renders.
- The SPA-only model means no server-side rendering benefit for SEO or initial paint; this is acceptable given the authenticated research workspace use case.
- Tailwind 4 is a recent major version; the custom DaisyUI theme must be maintained and tested against Tailwind upgrades.

## Consequences

- **`apps/web` package structure:**
  - `apps/web/package.json` — SolidJS 1.9, Vite 8, Solid Router (library mode, programmatic config), Tailwind 4, DaisyUI (DEC-0013), typed API client, SSE consumption; no direct DB or orchestration; **no SolidStart**.
  - `apps/web/vite.config.ts` — Vite 8 config with Solid plugin, Tailwind 4 integration, and path aliases.
  - `apps/web/src/` — Solid components, routes, stores, API client, SSE hook, utility modules.
- **Routing contract:** Solid Router in library mode with programmatic configuration owns SPA routes. Routes map to research UI panels: project list, source browser, research conversation, citation inspector, report editor.
- **State management:** Solid's fine-grained signals and stores drive reactive state. A dedicated SSE hook subscribes to the product event journal and updates stores reactively. Stores are typed with Effect Schema-compatible types consumed from the API client.
- **API flow:** `apps/web` calls the typed API over HTTP (fetch). Long-running research/ingestion progress is consumed via SSE events streamed from the API. The API client is generated from the API's Effect Schema contracts.
- **Error handling:** API errors surface through the typed client as Effect-compatible domain errors. UI displays structured error messages; infrastructure details are never exposed to the client (DEC-0008).
- **Testing:** Vite provides first-class test runner integration. Unit tests cover components and stores; integration tests cover API client interactions with mocked endpoints; E2E tests cover full research flows.
- **Styling and accessibility:** All styling flows through Tailwind 4 utility classes and DaisyUI component primitives with the custom project theme (DEC-0013). DaisyUI provides built-in accessibility states; custom theme tokens ensure visual consistency. All interactive elements must support keyboard navigation and screen readers.
- **Non-goals:** No SSR, no file-based routing, no server-side rendering, no static site generation. `apps/web` is a pure SPA. **SolidStart is explicitly not used.**
- **Shared UI package (`packages/shared-ui`):** Component contracts and design tokens live here; actual implementations stay in `apps/web` for now and can be extracted later.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Architecture: [[01_Architecture/Code_Map|Code Map]]
- Decision: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013]] — styling layer
- Decision: [[04_Decisions/DEC-0003_use-typescript-bun-and-effect-with-explicit-runtime-boundaries|DEC-0003]] — TypeScript + Effect runtime boundaries
- Decision: [[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008]] — API and SSE model
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Created and accepted: SolidJS + Vite 8 + Solid Router + Tailwind 4 + DaisyUI custom theme for frontend. Rejected Next.js (TS7 patch/disabled checks required), React+Vite (viable but SolidJS wins on fine-grained reactivity for SSE-driven state), Svelte/SvelteKit (TS7 checker incompatibility and peer dependency exclusions).
<!-- AGENT-END:decision-change-log -->
