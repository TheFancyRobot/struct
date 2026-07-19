---
note_type: session
template_version: 2
contract_version: 1
title: codex-step-04-05-worker session for Generate Reproducible 25000 JSON Corpus and Ground Truth
session_id: SESSION-2026-07-19-222127
date: '2026-07-19'
status: completed
owner: Codex
branch: agent/step-04-05-reproducible-corpus
phase: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]'
context:
  context_id: SESSION-2026-07-19-222127
  status: completed
  updated_at: '2026-07-19T22:21:27.738Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]].
    target: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]'
    section: Context Handoff
  last_action:
    type: saved
related_bugs: []
related_decisions: []
created: '2026-07-19'
updated: '2026-07-19'
tags:
  - agent-vault
  - session
---

# codex-step-04-05-worker session for Generate Reproducible 25000 JSON Corpus and Ground Truth

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 22:21 - Created session note.
- 22:21 - Linked related step [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]].
- Implemented the fixed-seed Bun corpus generator, independent exact oracle, manifest verifier, compare CLI, smoke integration, tests, compact result evidence, and operator documentation.
- Self-review caught and fixed downstream issues before handoff: preserved the existing Phase 02 smoke consumer, corrected percentage basis-point units, added source-version lineage to citations/files, hardened output/metadata/symlink handling, and regenerated all canonical hashes.
- Generated two independent 25,000-record full corpora and verified every record plus identical manifests.
- Root impact review aligned the emitted manifest with the declared stable corpus contract: schema/file descriptor names, record counts and identities, inert abuse IDs, SHA-256 stream metadata, benchmark-environment schema version, and strict Effect Schema decoding. Added malformed-manifest regression coverage, reconciled the broader v2 documentation boundary, regenerated two full corpora, and updated all dependent evidence hashes.
- Root adversarial review made verification enforce the complete on-disk inventory, reject nested symlinks/non-regular entries, and validate the ownership marker, so unlisted files cannot silently expand the evaluated corpus. Added regression coverage for unlisted-file and marker tampering.
- Downstream documentation audit updated the canonical repository command/gate contract for corpus generation and comparison, removed stale claims that the full corpus and DuckDB sidecar were deferred, and corrected the README data-engine status.
- Addressed all four automatic Codex findings as one impact-reviewed change: declared every emitted family column (including optional fixture columns), rejected excess manifest properties before hashing, added one complete schema question plus one question for each of eight security truth classes, and preserved root-level output basenames with `basename`. Added direct regression coverage that derives emitted columns from generated files, proves complete question coverage, and reproduces excess-property rejection. Regenerated and compared two full corpora and reconciled all dependent hashes/evidence.
- Addressed all four completed CodeRabbit findings in the same remediation: synchronized the step snapshot, moved session history into its bounded execution-log block, labeled the documentation fence, and corrected repository-descendant output detection with direct-child regression coverage.
<!-- AGENT-END:session-execution-log -->

## Findings

- Record important facts learned during the session.
- The existing `corpus:smoke` command is also the Phase 02 retrieval/provenance/injection gate, so STEP-04-05 composes the new generator smoke after it instead of replacing that established behavior.
- Exactly 25,000 refers to generated JSON record files; manifest, ground truth, questions, and cleanup marker are metadata and excluded from the scale count.
- The full generated artifact occupied about 107 MiB allocated storage and generated in about 2.5 seconds on this machine; neither observation is a portable performance threshold.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.
- Worker implementation is complete with zero known confirmed defects. Root should independently inspect the diff, rerun proportionate gates, publish the dedicated PR, address automated review feedback with downstream impact checks, and only then mark STEP-04-05 completed.
- STEP-04-06 can consume one regeneration command, the compact v1 evidence file, the verified full manifest hash, exact/schema/security/recovery question truth, and stable citation targets.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- `package.json`
- `README.md`
- `docs/evaluation-corpus.md`
- `docs/evaluation-corpus-generator.md`
- `packages/evaluation/package.json`
- `packages/evaluation/src/index.ts`
- `packages/evaluation/src/corpus.ts`
- `packages/evaluation/src/corpus-generate.ts`
- `packages/evaluation/src/corpus-compare-hashes.ts`
- `packages/evaluation/src/corpus-generator-smoke.ts`
- `packages/evaluation/test/corpus-generator.test.ts`
- `packages/evaluation/results/phase-04-corpus-v1.json`
- STEP-04-05 companion notes and this session note via bounded Agent Vault mutations.
<!-- AGENT-END:session-changed-paths -->

## Validation Run

<!-- AGENT-START:session-validation-run -->
- `bun run corpus:smoke` — passed Phase 02 gates plus deterministic 250-record generator repeat.
- Post-review `bun run corpus:generate --profile full --out <absolute-dir>` runs — 25,000 records each; 1,986 ms and 1,847 ms.
- `bun run corpus:compare-hashes <a>/manifest.json <b>/manifest.json` — passed after verifying all 50,000 generated record files and both metadata sets.
- Post-review `bun test packages/evaluation --max-concurrency 1` — 20 passed, 0 failed, 73 assertions.
- Post-review full repository tests — 472 passed, 151 expected integration skips, 0 failed, 2,093 assertions.
- `bun run typecheck && bun run lint && bun run lint:imports && bun run build` — passed.
- `bun run docs:lint && bun run secrets:scan` — passed.
<!-- AGENT-END:session-validation-run -->

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- None.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [x] Implement and locally validate STEP-04-05.
- [ ] Root orchestrator: independently review, publish, complete automated review remediation, merge, and close the step/session mirrors.
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- Completed the Bun-only reproducible 25,000-file JSON corpus, exact ground truth and citations, security/schema/recovery cases, verify-before-compare workflow, compact checked-in evidence, tests, scripts, and docs. All local code, test, build, security, documentation, reproducibility, and vault gates are green. No git or GitHub command was run.
- Merged PR #23 into `main` at merge commit `ca9514a` after two independent 25,000-record generations matched exactly, 472 repository tests passed with 0 failures, all static/build/docs/security/vault gates passed, and all eight automatic-review threads were addressed and resolved.
