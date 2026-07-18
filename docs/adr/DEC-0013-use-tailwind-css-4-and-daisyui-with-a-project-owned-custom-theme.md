# DEC-0013: Use Tailwind CSS 4 and DaisyUI 5 with a Project-Owned Custom Theme for Frontend Styling

## Status

Accepted.

## Context

The frontend needs one consistent styling system across the web application, shared UI, research workflows, reports, and future UX surfaces. Styling choices must remain themeable and accessible without accumulating one-off CSS or competing component systems. The product requires a distinctive, project-owned visual identity — not a stock theme.

## Decision Drivers

- Single styling system across all frontend surfaces
- Themeable and accessible without one-off CSS or CSS-in-JS
- Distinctive project-owned visual identity (not stock DaisyUI)
- Consistent component primitives to reduce bespoke styling
- TypeScript 7.0.2 and Bun compatibility (no patches, no disabled checks)

## Decision

Use Tailwind CSS 4 for all frontend layout and utility styling. Use DaisyUI 5 as the component and design-token layer. Define and own a project-specific DaisyUI theme (`struct`) — do not ship an unmodified stock theme.

Frontend work must extend the shared theme or reusable components instead of introducing another styling framework or ad hoc page-level design system.

## Considered Options

- **Tailwind CSS 4 + DaisyUI 5 with custom theme** — chosen. Provides a single styling system, consistent component primitives, and a distinctive project-owned identity.
- **Plain CSS or CSS Modules** — rejected. Would duplicate tokens and component patterns across surfaces.
- **A different component library or CSS-in-JS runtime** — rejected. Adds runtime or theming complexity; keeps the stack singular.
- **Stock DaisyUI themes** — rejected. The product requires a distinctive, project-owned visual identity.

## Consequences

### Positive

- One consistent styling system across all frontend surfaces
- DaisyUI provides built-in accessibility states (keyboard, ARIA, focus management)
- Custom theme tokens ensure visual consistency and a distinctive identity
- No ad hoc CSS or CSS-in-JS runtime overhead
- Tailwind 4 CSS-based configuration (no `tailwind.config.js` needed)

### Negative

- The team must maintain Tailwind/DaisyUI configuration, custom theme tokens, accessibility states, and upgrade compatibility
- DaisyUI conventions constrain component markup, but provide consistent primitives
- Tailwind 4 is a recent major version; the custom DaisyUI theme must be maintained and tested against Tailwind upgrades
- Exceptions require an explicit superseding decision rather than local divergence

## Links

- [DEC-0014: Use SolidJS, Vite 8, and Solid Router for Frontend Runtime](./DEC-0014-use-solidjs-vite-8-and-solid-router-for-frontend-runtime.md) — frontend framework that consumes this styling system
- [DEC-0003: Use TypeScript, Bun, and Effect with Explicit Runtime Boundaries](./DEC-0003-use-typescript-bun-and-effect-with-explicit-runtime-boundaries.md) — TypeScript + Bun runtime boundaries
- [docs/frontend-architecture.md](../frontend-architecture.md) — §8 styling and accessibility
- [PHASE-01 Walking Skeleton](../../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md)

## Related Phase

- [PHASE-00 Architecture Spikes and Delivery Foundations](../../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md)
- [PHASE-01 Walking Skeleton](../../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md)
