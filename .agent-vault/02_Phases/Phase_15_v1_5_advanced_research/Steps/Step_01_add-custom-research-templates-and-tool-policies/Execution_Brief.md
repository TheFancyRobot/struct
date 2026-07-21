# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Custom Research Templates and Tool Policies that advances v1.5 Advanced Research while preserving advanced research depth under explicit tool and policy control.

## Prerequisites

- Re-read [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Steps/Step_03_enforce-audit-retention-and-administrative-controls|STEP-14-03 Enforce Audit Retention and Administrative Controls]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/custom-research-template.ts`
- `packages/workflows/src/tool-policies.ts`
- `apps/web/src/components/CustomTemplateEditor.tsx`
- `apps/api/src/routes/research-templates.ts`

## Required Reading

- [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_14_v1_4_collaboration_and_governance/Steps/Step_03_enforce-audit-retention-and-administrative-controls|STEP-14-03 Enforce Audit Retention and Administrative Controls]]
- `docs/product-brief.md` sections 13-17, 20-25, 28-29, and 31.

## Smallest Bounded Checklist

- Define versioned custom plan-template and tool-policy schemas with declared capabilities, inputs, outputs, budgets, owners, and approvals.
- Validate templates deterministically before compiling them to Fred workflows and reject unknown tools, cycles, unbounded fan-out, or scope escalation.
- Implement review, publish, revoke, migrate, and feature-flag lifecycles while keeping arbitrary user code out of the trusted runtime.
- Test malicious templates, incompatible versions, revoked tools, provider changes, budget exhaustion, provenance, and rollback.

## Constraints and Non-Goals

- Advanced modes must still route exact computation to deterministic tooling and preserve explicit evidence boundaries.
- Custom templates and tool policies need typed enforcement rather than prompt-only conventions.
- Multimodal or longitudinal analysis should extend provenance, not weaken it.

## Related Notes

- Step: [[02_Phases/Phase_15_v1_5_advanced_research/Steps/Step_01_add-custom-research-templates-and-tool-policies|STEP-15-01 Add Custom Research Templates and Tool Policies]]
- Phase: [[02_Phases/Phase_15_v1_5_advanced_research/Phase|Phase 15 v1 5 advanced research]]
