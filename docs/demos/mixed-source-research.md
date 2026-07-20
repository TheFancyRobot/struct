# Mixed-source research demo

STEP-07-05 adds a deterministic, browser-visible mixed-source report to the
existing SolidJS research route. It demonstrates the stable UI boundary for a
hybrid result without adding another API, executor, or client state system.

## Open the fixture

Start the existing web app:

```sh
bun run --filter @struct/web dev
```

Open a valid research route and add the fixture query:

```text
/projects/f80e8400-e29b-41d4-a716-446655440001/research/f80e8400-e29b-41d4-a716-446655440002/runs/f80e8400-e29b-41d4-a716-446655440003?demo=mixed-source&state=complete
```

Supported deterministic states are `loading`, `live`, `reconnecting`,
`complete`, `cancelled`, `empty`, and `error`.

The fixture exposes exact document spans, immutable source versions, canonical
SQL, selected columns and types, exact returned rows, quantitative semantics,
cohort mismatches, limitations, inline citations, and committed progress.

## Playwright verification

Run the focused browser suite:

```sh
bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/mixed-source-report.spec.ts
```

The suite verifies:

- served route and asset HTTP success;
- light/dark theme synchronization and computed surfaces;
- exact document, SQL, table, citation, and keyboard interactions;
- desktop and mobile navigation;
- loading, reconnecting, cancelled, empty, and error states;
- page/console errors and horizontal overflow;
- screenshots at exactly 1440x900, 1024x768, and 390x844 in both themes.

The six durable screenshots are generated in
`docs/demos/mixed-source-research/`.
