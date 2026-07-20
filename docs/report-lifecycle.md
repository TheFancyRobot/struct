# Report lifecycle

Durable findings and reports preserve an editable history without weakening the
immutable evidence behind their claims. The canonical contracts live in
`@struct/domain`; PostgreSQL stores the same shape directly.

## Canonical objects

- `Claim` is the evidence boundary. It has one canonical claim signature, one
  immutable support bundle, one embedded citation lifecycle, and an append-only sequence
  of authored text revisions.
- `Finding` groups claims produced by one research run and records the exact
  immutable source versions used by that run.
- `Report` composes claims into ordered sections. A claim belongs to exactly one
  section in a report, so section regeneration has an explicit bounded scope.
- `ContentRevision` records either generated authorship (run, model, and prompt
  version) or user authorship (actor identity). Generated and user authorship
  are distinct tagged variants.

There is no second report or saved-finding model. `ResearchFinding` remains the
canonical recursive-analysis output and may be retained as a claim origin when
it becomes a durable `Claim`.

## Evidence invariants

A supported claim contains only evidence whose:

1. identity is unique within the claim;
2. stance is `supports`;
3. claim signature equals the claim's canonical signature; and
4. target is an immutable document chunk/source version, dataset query-result
   snapshot, or recursive artifact.

`document`, `dataset`, and `recursive` claims contain only that evidence kind.
`hybrid` claims contain at least document and dataset evidence. These variants
reuse the existing cross-source, document-locator, dataset-query, and recursive
artifact contracts, so locators are never reduced to an unverified string.

An unsupported claim is a valid draft artifact, but it cannot have the
`publishable` citation state. Editing a claim appends a text revision; it never
updates or replaces the evidence snapshot. A changed evidence set is a new
claim identity.

## Citation lifecycle

The durable claim citation states are:

| State | Meaning |
| --- | --- |
| `draft` | Evidence has not completed validation. |
| `valid` | Evidence currently resolves and supports the claim. |
| `stale` | A newer source/index version requires explicit revalidation. |
| `broken` | The immutable target or locator cannot be resolved. |
| `unauthorized` | The current actor cannot open the evidence target. |
| `incompatible` | The stored locator or artifact contract is not understood. |
| `publishable` | Validation passed and the claim may participate in publication. |
| `superseded` | A new citation identity explicitly replaces this one. |

Legal transitions are encoded in `transitionCitationState`. `superseded` is
terminal. Supersession requires a different, existing citation and the complete
graph must be acyclic. Every transition uses an expected revision and
idempotency key. Replaying the same operation is a no-op; reusing a key for a
different operation fails.

The lifecycle is owned directly by `Claim`; there is no separate status field
that can drift from its revision, supersession target, or last idempotency key.

The older `CitationStatus` (`validated`, `invalid`, `stale`) remains the raw
validation result persisted on a research-run citation. It is not a competing
durable lifecycle: successful raw validation is one input to moving a durable
claim citation from `draft` to `valid`.

## Report publication

Report publication follows a fail-closed sequence:

```text
draft -> publishable -> published
   \          \
    \-- edit/regenerate -> draft

any active state -> superseded
```

`prepareReportPublication` deterministically derives `publishable` only when
every claim is supported and every claim citation is `publishable`.
`publishReport` accepts only that state. A stale, broken, unauthorized,
incompatible, draft, unsupported, or superseded claim blocks publication.
Superseded reports cannot be regenerated or published.

Both operations use optimistic report revisions and idempotency keys. A stale
write fails instead of overwriting newer work.

## Section-scoped regeneration

`regenerateReportSection` receives one section identity and expected report
revision. It appends exactly one authored section revision, increments the
report revision, and returns the report to `draft`. It does not alter:

- another section;
- a claim or claim revision;
- an evidence identity or snapshot;
- a finding link; or
- a source-version identity.

Retrying the same request is idempotent. Reusing the key with different
content, authorship, or revision identity fails.

## Persistence

Migration `0015_report_lifecycle` is the direct current-schema shape for this
greenfield database. It creates:

- scoped durable claims with lossless support mode/reason and full citation
  lifecycle concurrency fields, plus append-only claim revisions;
- append-only immutable claim evidence with a database mutation guard;
- findings and their ordered source-version, claim, and title-revision links;
- reports, title revisions, ordered sections, section revisions, finding
  links, ordered source-version links, and section-scoped claim links.

The schema stores workspace, project, run, and foreign-keyed immutable
source-version identities directly. Unique constraints enforce revision ordering keys,
idempotency keys, and non-duplicated claim links. Application transactions must
decode the complete aggregate with the canonical Effect Schemas before commit,
which enforces cross-row invariants such as contiguous revisions, dangling
claim rejection, publication readiness, and supersession-cycle rejection.

No data-preservation or compatibility migration is required. During
development, drop and recreate the schema when a breaking contract changes.
