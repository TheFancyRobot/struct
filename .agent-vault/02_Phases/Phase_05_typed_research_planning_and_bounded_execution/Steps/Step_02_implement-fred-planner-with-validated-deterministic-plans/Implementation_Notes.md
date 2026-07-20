# Implementation Notes

- Added focused Fred classifier and planner configs with typed STEP-05-01 inputs/outputs, `maxSteps: 1`, `toolChoice: none`, and no tools.
- Both agent inputs reuse the same exported nonblank bounded `ResearchQuestion` schema, so whitespace-only questions fail before either provider call.
- `validateResearchPlan` decodes untrusted proposals through the shared domain contract, then checks immutable identity/question, authorized source scope, compatible and bounded tool grants, required grants per node, per-tool call counts, and all budget ceilings before normalization.
- Document retrieval inputs and document evidence requirements are restricted to document source scopes; dataset lineage cannot satisfy document evidence.
- Normalization only canonicalizes ordering after validation. It copies and bytewise-sorts outer collections plus nested dataset-scope and document-evidence source-version sets without mutating input or repairing authority, graph, or budget failures.
- Provider failure normalization retains no provider payload or cause details.
- PR #28 review remediation moved `QuestionClassification` into the shared planning input. Exact-computation proposals now require authorized dataset scope and validated dataset-query output on a transitive node-output path to answer synthesis; disconnected query nodes fail typed before executable output.
- Source authorization keeps document scopes as exact source-version identities while allowing dataset scopes to narrow `sourceVersionIds` within the authorized dataset/snapshot identity. Canonical normalization retains its separate full scope ordering key.
- Every document-retrieval node now requires compatible authorized document source-version direct inputs, and every dataset-query node requires compatible authorized dataset-snapshot direct inputs. Empty, incompatible, and out-of-scope direct inputs fail typed.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
