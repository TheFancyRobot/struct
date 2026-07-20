# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added `packages/evaluation/src/recursive-analysis.ts`, a deterministic Effect-based 25,000-file fixture and evaluator that exercises the production `CorpusPartitioning` plan, claim, commit, validate, and resume surfaces.
- The fixed corpus produces 50 equal 500-item partitions and eight decomposition nodes. Evaluation ground truth retains exact identities for 25 minority findings and 50 contradiction signals, preventing count-only false positives.
- Leaf recovery commits four of eight claims, interrupts the remaining leases, derives one recovery transition from the before/after scheduler identities, resumes four retryable leases, preserves all four committed artifact identities, and converges with complete coverage and zero duplicate partition-artifact identities.
- Merge recovery serializes and schema-validates the bounded partition-summary checkpoint and derives duplicate counts from its partition identities. `apps/worker/test/recursive-analysis.scale.test.ts` additionally injects an interruption into the production recursive synthesis job with an in-memory idempotency journal; this does not claim persistence-backend coverage.
- Added a canonical hashed report plus check/generate commands. Deterministic elapsed work (7/600,000 ms), partitions and committed artifacts (50/100), largest artifact (32,000/65,536 bytes), total committed artifacts (1,600,000/6,553,600 bytes), tokens, cost, and concurrency are explicit policy-derived gates.
- Report verification now fails closed when the overall status disagrees with criteria/blockers or when any required criterion is missing or duplicated. A tamper test recomputes a valid hash after removing a criterion and proves semantic verification still rejects it.
- No confirmed product defect or remaining scale blocker was found.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_06_evaluate-25000-file-recursive-analysis-and-recovery|STEP-06-06 Evaluate 25000-File Recursive Analysis and Recovery]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
