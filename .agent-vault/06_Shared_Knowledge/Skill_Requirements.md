---
note_type: shared_knowledge
title: Skill Requirements by Domain
created: '2026-07-17'
updated: '2026-07-17'
tags:
  - agent-vault
  - shared-knowledge
  - skills
---

# Skill Requirements by Domain

When working on this project, agents MUST load the relevant skill files before implementing code.

## Backend Work (apps/api, apps/worker, packages/*)

Before writing any Effect-TS code, read these skills:

1. **`/Users/dino/.agents/skills/effect-ts/SKILL.md`** — Core Effect-TS patterns: Services, Layers, Error handling, Schemas, Config, generators, resource management.
2. **`/Users/dino/.agents/skills/effect-best-practices/SKILL.md`** — Enforced patterns: Effect.Service with accessors, Schema.TaggedError for errors, Layer.mergeAll for composition, Effect.fn for methods, Option matching, anti-patterns.

**Mandatory rules from Effect-TS skills:**
- Use `Effect.Service` for business logic — not `Context.Tag`
- Use `Schema.TaggedError` for errors — not plain classes
- Use `Effect.fn("Service.method")` for named service methods
- Use `Effect.gen(function* () { ... })` for sequential code
- Never use `throw` inside `Effect.gen`; use `Effect.fail`
- Never use `Effect.runPromise` / `Effect.runSync` inside services
- Use `Effect.log` — never `console.log`
- Use `Config.*` for environment variables — never `process.env`
- Use `Option` — never `null`/`undefined` in domain types

## Frontend Work (apps/web)

Before writing any SolidJS code, read these skills:

1. **`/Users/dino/.agents/skills/solidjs/SKILL.md`** — Core SolidJS: signals, stores, effects, resources, context, routing, lifecycle, refs, event handling.
2. **`/Users/dino/.agents/skills/frontend-design/SKILL.md`** — Design principles: distinctive aesthetics, typography, color, motion, spatial composition, avoid generic AI defaults.

**Mandatory rules from SolidJS skills:**
- Use `createSignal` for scalar state, `createStore` for nested objects/arrays
- Call signal getters: `count()` not `count`
- Don't destructure props — use `props.name`
- Use `<For>` for keyed lists, `<Index>` for index-keyed
- Use `onMount`/`onCleanup` for side effects
- Use `createEffect` for reactive effects
- Use `children(() => props.children)` for child handling
- Use `clsx` or `classList` for conditional classes
- Use `untrack` for non-reactive reads

## Both

- Always follow the repository contract: `docs/repository-contract.md`, `docs/local-development.md`
- Keep package boundaries: no cross-app imports, domain is leaf
- Use Effect Schema for all contracts
- Preserve workspace scoping and typed failures
