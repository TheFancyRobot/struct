# Execution Brief

## Exact Outcome

- Produce a falsifiable Phase 04 evaluation proving exact computation, schema handling, SQL/sidecar security, citation integrity, and restart recovery on the versioned 25,000-file corpus.

## Prerequisites

- STEP-04-05 is merged; regenerate and verify its corpus/ground-truth manifest before evaluation.
- Read all Phase 04 Outcomes, DEC-0005, DEC-0009, DEC-0011, and the zero-defect gate.

## Deliverables

- Evaluate import/materialization, profiling, safe SQL, result snapshots, and citations end to end against independent ground truth.
- Exercise documented schema families/drift, exact aggregates/joins/filters, limits/timeouts/cancellation, injection data, auth failures, no-egress/path isolation, and SQL bypass attempts.
- Inject process/sidecar interruption at meaningful persistence boundaries; restart through the real lease/job recovery path and prove no duplicate snapshots, artifacts, results, citations, or events.
- Publish a deterministic machine-readable report whose hashed fields cover environment, pins, seed, manifest hash, commands, counts, and pass/fail reasons; preserve volatile timings in a separate non-hashed machine-readable metadata envelope and summarize both in concise operations/benchmark documentation.
- Record every confirmed defect as a bug, fix and re-run it before completing the phase.

## Constraints and Non-Goals

- Do not substitute a simulated set-membership proof for real persistence/restart behavior.
- No model judgment for exact answers and no release action.

## Handoff

- PHASE-05 receives a zero-known-defect, deterministic dataset tool boundary and the exact evaluation evidence needed for typed research planning.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
