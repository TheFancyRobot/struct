# Implementation Notes

- Focused Fred nodes are split into three one-call workflows so deterministic
  Effect orchestration can stop exactly after 0, 1, 2, or 3 calls without
  bypassing core Fred.
- Deterministic services materialize identities, validate coverage/evidence,
  bind contradictions to explicit claim signatures, preserve counterevidence,
  and canonicalize merge output.
- The worker journal persists typed analysis, critique, and synthesis stages
  plus the final node, contract fingerprints, and durable call reservations.
  Replacement workers reuse committed stages; failed attempts still consume
  durable model, token, and cost budget.
- The existing attempt-fenced STEP-06-02 partition lease remains the
  single-active worker fence; this step adds no competing scheduler or runtime.

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_04_implement-recursive-fred-synthesis-and-contradiction-handling|STEP-06-04 Implement Recursive Fred Synthesis and Contradiction Handling]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
