# Release Policy

This repository ships one product, not a set of independently versioned public
packages. Release management is therefore product-level and intentionally
simple.

## Current policy

- `main` is the integration branch for unreleased work.
- `v1.0.0` must not be created until the app has been exercised in real use and
  the remaining work is primarily polish or low-risk fixes, not product-shape
  changes.
- If the product needs internal trial use before that point, publish a
  pre-release tag instead of a `v1.0.0` tag.

## Version labels

- `v0.x.y` means the product is still evolving and may change shape without
  compatibility guarantees.
- `v0.x.y-alpha.N` is for early feedback when core workflows may still change
  materially.
- `v1.0.0-rc.N` is for the actual first stable-release candidate: feature-complete
  enough for serious use, with remaining work focused on stabilization, bug
  fixes, UX polish, and release evidence.
- `v1.0.0` is reserved for the first intentionally stable release.

## When to use each

- Use no tag when work is still being developed and validated on `main`.
- Use `alpha` only when early feedback is needed before the product shape has
  settled.
- Use successive `v0.x.y` releases while features and behavior are still moving
  materially. Start at `v0.1.0`, then advance to `v0.2.0`, `v0.3.0`, and so on
  as meaningful product increments ship.
- Use `v1.0.0-rc.N` only when the product is usable end to end, the must-fix
  list is known, and feedback should mostly refine rather than redefine the
  workflow.
- Use `v1.0.0` only when all of the following are true:
  - the release checklist is green;
  - the app has been exercised by the owner in real work;
  - any must-fix issues from that usage are resolved;
  - no known core workflow redesign is still expected;
  - the final tag and GitHub release have been explicitly authorized.

## Versioning mechanics

- Product releases are created with annotated Git tags and optional GitHub
  releases.
- Pre-1.0 version progression follows normal SemVer ordering. Do not jump to
  arbitrary high `0.x` numbers to imply maturity; advance from `v0.1.0`
  upward as actual release milestones occur.
- This repository does not use Changesets today.
- There is no `.changeset/` directory, no Changesets config, and no
  `changeset`/`changesets` release script wired into the root workspace.
- That is intentional because the current delivery unit is the application as a
  whole, not separately published packages with independent semver streams.

## When Changesets would be worth adding

Adopt Changesets only if the repository starts publishing reusable packages that
need independent version bumps, changelog generation, and coordinated package
release PRs. For the current product-level release flow, manual tags are the
lower-friction choice.
