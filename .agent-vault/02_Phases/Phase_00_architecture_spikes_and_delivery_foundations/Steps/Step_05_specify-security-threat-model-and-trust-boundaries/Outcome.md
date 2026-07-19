# Outcome

- Result: completed.
- Deliverable landed (docs-only, no premature scaffolding):
  - `docs/security-model.md` — appended §19–§26 to the existing §1–§18 prose (no rewrite, no competing `docs/threat-model.md`, no new ADR). The seven required artifacts:
    1. **Trust-boundary enforcement matrix** (§19) — 6 boundaries from architecture.md §3.2 × 8 columns (crossing data, actor, enforcing component, owner, authorization rule, audit event, safe failure). Every boundary has a named enforcement owner; production enforcement files (`apps/api/src/auth/authorization.ts`, `packages/ingestion/src/path-safety.ts`, `packages/data-engine/src/sql-policy.ts`) named as spec-only handoff targets.
    2. **STRIDE threat register** (§20) — 24 threats with asset, actor, precondition, abuse, impact, preventive control, detective control, residual risk, status, and implementation/verification phase.
    3. **Abuse catalog** (§21) — ABUSE-01..15 covering traversal/encodings, symlink escape/cycles, devices/sockets, hostile/oversized/corrupt files, archive expansion (unsupported), prompt injection across supported types, cross-workspace access, SQL `ATTACH`/`COPY`/`INSTALL`/`LOAD`/DDL/DML/unsafe pragmas, unbounded output/fan-out, cancellation bypass, secret leakage, retry duplication, retention/privacy/fixture hygiene, SSRF/server-side request forgery, CSV-formula injection on export.
    4. **Provisional resource limits** (§22) — measured values from STEP-00-03/02 plus `TBD` values each with owner, evidence, fail-closed default, and calibration phase; separate unsupported-until-designed table for archives, OCR-heavy PDFs, and SQLite.
    5. **Threat-to-test matrix** (§23) — every abuse mapped to a future unit/integration/adversarial/recovery test with owner phase.
    6. **Deferred-risk register** (§24) — DEF-01..09 with severity, owner, due phase, and compensating control.
    7. **STEP-00-06 handoff** (§25) — each accepted abuse category → expected safe behavior → required observable evidence; plus filesystem rules, SQL rules, quotas, sanitization/privacy, audit events, unsupported defaults, and pre-release security-review ownership.
  - §26 reconciliation + change log provenance.
- Enforcement ownership finalized for the 6 trust boundaries (repository-contract §3.4 / §3.2 obligation): auth→`apps/api`; filesystem walker→`packages/ingestion`; SQL policy executor→`packages/data-engine`; tool gates→`packages/fred-workflows`; citation/synthesis gates→`packages/research-engine`; checkpoint/journal→`apps/worker`+`packages/persistence`.
- Reconciliation: DEC-0009, DEC-0011, DEC-0006/0007/0008/0012, STEP-00-01 (Fred boundary), STEP-00-02 (events/checkpoints/cancel-winner), STEP-00-03 (selected-at-the-time host-child worker measurements + still-applicable hardening order + DENIED probes), STEP-00-04 (package boundaries/CI gates/secrets), architecture.md §3.2/§4.1/§9.1/§14, local-development.md §3/§5, and evaluation-strategy §3.4/§6.5/§8/§13/§14/§15 are all cited and consistent. DEC-0003/DEC-0005 supersede the historical host-child topology with the pinned Phase-04 container/sidecar; its security measurements remain evidence for that sidecar boundary.

## Validation Evidence

- Documentation checks run from repository root (read-only; `git diff --check` substituted with `rg` whitespace checks per the no-git constraint, consistent with STEP-00-04):
  - Whitespace: `rg -n " +$"` and `rg -nP "\t"` over `docs/security-model.md` → clean (no trailing whitespace, no tabs).
  - Keyword coverage (Validation Plan rg): `rg -c "trust boundary|workspace|symlink|traversal|prompt injection|ATTACH|INSTALL|LOAD|secret|quota|cancel|audit|retention" docs/security-model.md` → **140 matching lines**.
  - Abuse-catalog coverage: all required abuse keywords present (traversal 18, symlink 17, device 8, socket 4, oversized 9, archive 12, prompt injection 7, cross-workspace 7, ATTACH 11, COPY 5, INSTALL 12, LOAD 29, DDL 9, DML 8, pragma 6, unbounded 8, fan-out 9, cancellation bypass 3, secret 32, retry 5, duplicate 13, retention 9, SSRF 5, CSV-formula 3, httpfs 6). Case-insensitive counts via `rg -ci`.
  - Threat register: 24 `THR-` rows; statuses 22 `controlled` + 2 `accepted risk` (THR-10→DEF-01, THR-22→DEF-06; THR-23 SSRF controlled+deferred→DEF-09), each with a named control/owner.
  - Limits: 24 limit/`TBD` rows, all with owner + fail-closed default + calibration phase; no silent `TBD`.
  - Deferred risks: 9 `DEF-` rows, all with severity/owner/due-phase/compensating-control (DEF-09 = URL-source SSRF surface).
  - Cross-document contradiction check: §19 boundary names match architecture.md §3.2 exactly; DEC-0009 (registered canonical roots + read-only allowlist SQL) and STEP-00-03's selected-at-the-time host-child worker measurements, `allowed_directories`→`enable_external_access=false` hardening order, `read_json_auto('/etc/passwd')` denial, and rejection of `direct` are consistent and cited. DEC-0003/DEC-0005 supersede only the historical host-child topology with the pinned Phase-04 container/sidecar; the hardening and measurement evidence remains applicable.
  - Premature-scaffolding check: no `apps/`, `packages/`, new ADR, `docs/threat-model.md`, `package.json`, `bunfig.toml`, or `tsconfig.base.json` created — only `docs/security-model.md` changed (docs-only).
- Matrix-dimension coverage confirmed: filesystem, source parsing, model/tool authority, SQL/DuckDB, workspace authorization, secrets, events/checkpoints, retry/resume, denial-of-service, privacy/retention, and error sanitization all present in §19–§24.
- PASS criteria met (Validation Plan): matrices complete; cross-document review consistent; no silent `TBD`; STEP-00-06 receives a concrete adversarial/limits/sanitization handoff. FAIL criteria avoided: no model/source can widen authority, no arbitrary-path/unsafe-SQL policy hole, no secrets/PII in fixtures, no missing ownership, no high-risk threat without a control/accepted risk. Implementation tests remain downstream work; this step passes on a complete, internally consistent, testable security contract.

## Follow-Up

- **STEP-00-06 (evaluation corpus + gates)** — downstream dependent; may rely on the §25 handoff (accepted abuse categories → safe behavior → observable evidence; filesystem/SQL rules; quotas; sanitization/privacy; audit events; unsupported defaults). STEP-00-06 finalizes gate-tier numeric thresholds (DEF-05) for the CI matrix in repository-contract §2.
- **Phase 02** — `apps/api` auth/authorization enforcement + cross-workspace object-level authz + rate limits + error sanitization (THR-01/02/03/04/20, ABUSE-07/11).
- **Phase 03** — `packages/ingestion` path-safety (traversal/symlink/devices) + file size/count/parser-time budgets + archive design (DEF-01).
- **Phase 04** — `packages/data-engine` sql-policy + DuckDB hardening + resource limits calibration (ABUSE-08/09, THR-13/14/15/21).
- **Phase 05/06** — `packages/research-engine`/`fred-workflows` run budgets + bounded fan-out (DEF-07); ABUSE-06 injection suite across source types.
- **Phase 09** — hardening, retention/deletion policy (DEF-06), OS/container isolation review (DEF-03), and the pre-release security-review sign-off (§25) against the implemented controls.
- DEC-0009 remains accepted; no evidence contradicts it — no decision update required.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
