

<!-- agent-vault:start -->

## Agent Vault

Use `.agent-vault/` as durable project memory. Prefer MCP tools over direct edits.

### Start

1. Read `.agent-vault/00_Home/Active_Context.md`.
2. Follow only the links needed for the current task.
3. Create or update notes with MCP tools.

### MCP Tools

- `vault_traverse` - load narrow linked context
- `vault_extract` - extract one heading or generated block without loading a whole note
- `vault_lookup_code_graph` - symbol/file lookup without loading the full index
- `vault_create` - create phase, step, session, bug, and decision notes
- `vault_mutate` - update frontmatter or append sections
- `vault_refresh` - rebuild indexes, active context, or code graph
- `vault_validate` - run vault integrity checks
- `vault_help` - command help

### Rules

- Use bounded mutations only.
- Do not rewrite whole notes or delete human prose.
- Do not load the whole vault by default.
- Prefer `vault_extract` when a specific heading or generated block is enough.
- Treat `01_Architecture/Code_Graph.md` as summary-only; use `vault_lookup_code_graph` for detail.
- See `.agent-vault/AGENTS.md` for the full contract.

<!-- agent-vault:end -->

## Zero-Defect Advancement Gate

- Do not start a new roadmap step or phase while any confirmed defect is known anywhere in the repository.
- Fix every discovered defect, even when it is unrelated to the current step or phase, then validate the fix before advancing.
- A genuinely external blocker must be recorded as an open bug and blocks roadmap advancement until resolved; it is not an exception to the gate.
- Review approval and step completion require zero known confirmed defects across code, tests, builds, security, documentation, and vault state.

## Greenfield Compatibility Policy

- Do not preserve backward compatibility or accommodate legacy code or libraries.
- The database is not in production and contains no data that must be migrated.
- When a breaking database change is needed, prefer drop-and-recreate over compatibility layers or data-preservation scripts.

## Phase Refinement Gate

- After the final step of a phase is reviewed and merged, refine the next planned phase before creating or implementing its first step branch.
- Phase refinement must reconcile the phase objective, scope, step sequence, dependencies, execution briefs, validation plans, architecture links, decisions, and known risks with the repository state produced by the completed phase.
- Record the refinement in an Agent Vault session, update the affected phase and step notes, refresh generated vault context, and require a clean vault validation before declaring the next phase ready.
- This gate applies at phase boundaries; steps within an already-active refined phase continue through their normal per-step branch, review, and merge gates.

## Roadmap Orchestration Gate

- Spawn every subagent with `model: "openai-codex/gpt-5.4"`; do not use an unqualified model name or a team default that can override it.
- Execute each roadmap step or bug in one fresh subagent. Do not reuse a failed worker for a retry.
- Worker subagents must not run any git command. The root orchestrator exclusively owns branches, staging, commits, pushes, pull requests, review remediation, and merges.
- The root orchestrator must independently verify step status, mirrored `context_status`, repository validation, and vault integrity before publishing a step.
- Each subsequent step uses its own branch and pull request into `main`. Wait for required checks and automated code-review feedback, address every unresolved actionable comment, and merge successfully before advancing.
- Default retry policy is three total fresh-worker attempts per unit. Stop on an unrecovered failure or any unresolved confirmed defect.
- Continue through the refined roadmap without interactive approval pauses. Stop immediately before performing the v1.0 release action.
