# Hybrid research contracts

Hybrid research extends the existing `ResearchPlan`; it does not introduce a
second planner or execution model. The question classifier selects an explicit,
bounded set of evidence routes, the planner proposes one typed DAG, and trusted
code validates and normalizes that DAG before Fred can compile it.

## Source routes

| Route | Immutable authority | Plan node | Evidence |
| --- | --- | --- | --- |
| Document | `SourceVersionId` | `document-retrieval` | Exact source versions and citation minimum |
| Dataset | `DatasetId` + `DatasetSnapshotId` | `dataset-query` | Exact immutable snapshot and citation minimum |
| Recursive | Bounded unique `SourceVersionId` set | `recursive-analysis` | Exact corpus versions and citation minimum |
| Synthesis | Completed node outputs | `answer-synthesis` | Every selected branch requirement |

`QuestionClassification.routes` is the authority for route selection. A
single-source classification selects exactly one matching route. A `mixed`
classification selects two or three distinct routes explicitly. Merely having
another source type authorized does not activate it.

## Deterministic validation

The validator rejects:

- a selected route without a matching authorized scope, plan node, and evidence
  requirement;
- an unselected document, dataset, or recursive execution branch;
- widened or duplicated source identities;
- recursive nodes without one immutable recursive source set;
- incompatible or ungranted tool capabilities;
- missing dependencies, cycles, excessive fan-out, and expanded budgets;
- mixed synthesis that does not transitively wait for every selected evidence
  branch or retain every plan-level evidence requirement.

Normalization sorts scopes, recursive source sets, dependencies, inputs,
requirements, and tool grants. The same authorized proposal therefore produces
the same normalized plan regardless of model field ordering.

## Budgets and trust boundaries

Every route remains under the existing plan ceilings for steps, tool and model
calls, tokens, elapsed time, estimated cost, fan-out, and revisions. Recursive
analysis additionally uses the bounded Phase 06 policy when execution is
implemented. This step only defines and compiles the route; persistence and
branch execution remain later Phase 07 work.

The classifier and planner are tool-free Fred agents. Their output is untrusted
until schema decoding, source-scope checks, route validation, policy validation,
budget validation, and normalization succeed. Prompts cannot widen tool access,
source authority, or budgets. Dataset SQL remains trusted-code generated, and
untrusted source content never becomes system instructions.
