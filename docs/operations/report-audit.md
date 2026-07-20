# Report Audit Operations

Struct report audits are revision-specific. Never treat a report ID, citation ID,
or source ID alone as proof of fidelity: the audit unit is the exact report
revision plus its immutable claims, evidence identities, source versions,
provenance graph, validation facts, and export digest.

## Release gate

Run:

```sh
bun run --filter @struct/evaluation phase-08:eval
```

The command verifies the tracked
`packages/evaluation/results/phase-08-report-fidelity-v1.json` artifact and then
runs tamper tests. It also prints the measured wall-clock duration and enforces
the 5-second limit with `Effect.timeout`. A release is blocked unless:

- all 26 cases pass;
- claim, evidence, source-version, locator, query, revision, and hash identities
  match exactly;
- every required citation resolves, the shipped publication and export gates
  permit `publishable`, and both gates block every other citation state;
- drift never silently retargets a citation;
- repair retains the stale and supersession transitions plus the replacement
  citation identity;
- restart/replay is idempotent;
- export bytes round-trip to the same digest;
- authorization and prompt-injection cases remain contained; and
- elapsed work, concurrency, artifact bytes, and case count remain within the
  tracked limits.

Authorization has two independent signals: the evaluator makes a mismatched
workspace provenance export fail closed, and
`apps/api/test/report-export.integration.test.ts` verifies that an invalid
workspace credential receives the same not-found response as an absent export.

## Investigating a failed case

1. Read the case `id`, `observed` fields, and `evidenceHash` in the tracked
   artifact.
2. Re-run the focused evaluator. Do not regenerate the tracked artifact first.
3. Inspect the exact report revision and provenance graph. For an exported
   artifact, verify the bundle before opening its embedded `report.json` and
   `provenance.json`.
4. Compare immutable identities before comparing prose. A mismatch in a claim,
   edge, locator, version, SQL query, parameter, result hash, or artifact hash is
   a fidelity failure.
5. For drift, confirm the original source-version identity remains recorded and
   the citation becomes stale. Reindexing may not rewrite the evidence link.
6. For repair, confirm the original citation is superseded, the replacement is
   explicit, and replay does not append another revision.
7. For authorization failures, return an absent/not-found response at the API
   boundary. Do not disclose that a report or source exists.

Do not fix an audit failure by editing the JSON result. Fix the shipped contract
or evaluator defect, rerun all gates, then regenerate the artifact with:

```sh
bun run --filter @struct/evaluation phase-08:generate
```

The verifier recomputes both the outer report hash and every semantic outcome, so
rehashing a tampered artifact is insufficient.

## Export evidence

The report export contains canonical snapshots of the exact report revision and
provenance graph. Bundle verification checks canonical JSON, file count and
size, safe paths, file metadata, content hashes, report/provenance schemas, and
manifest identity. Download responses use the Struct report-bundle media type,
`Content-Disposition: attachment`, and `X-Content-Type-Options: nosniff`.

The API integration gate reopens the object store before downloading, which
proves the bundle survives process restart rather than relying on in-memory
state.
