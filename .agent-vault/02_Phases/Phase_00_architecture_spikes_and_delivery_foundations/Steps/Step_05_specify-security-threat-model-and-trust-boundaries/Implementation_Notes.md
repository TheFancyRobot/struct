# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

## Session 1 — Security threat-model spec (step-00-05-implementor)

### Scope decision (important)
- This step is **documentation-only**. Per the Phase 00 refinement contract and the Execution Brief refinement addendum, the canonical deliverable is to **extend `docs/security-model.md`** — not to create a competing `docs/threat-model.md`, not to create new ADR files, and not to scaffold production `apps/`/`packages/` code.
- The Execution Brief's "Planned Starting Files" (`apps/api/src/auth/authorization.ts`, `packages/ingestion/src/path-safety.ts`, `packages/data-engine/src/sql-policy.ts`) are **enforcement handoff targets**, named as canonical enforcement owners in the trust-boundary matrix (§19), but NOT implemented in Phase 0. Phase 0 is spec-only; Phase 09 hardens.

### Upstream evidence reconciled
- **DEC-0009** — sandbox filesystem roots + allowlist read-only SQL; fail-closed typed errors; Phases 03/04 implement, Phase 09 audits. Grounds §7/§9/§19 (boundaries 4 & 6)/ABUSE-01/02/08.
- **DEC-0011** — reproducible ~25,000-file corpus; grounds §22 calibration phases and §23 adversarial/recovery tests.
- **DEC-0006/0007/0008/0012** — immutable source versions (THR-19), product job/event journal + Fred at the orchestration boundary (§19 boundaries 3 & 5), owned typed API + live event stream (§19 boundaries 1 & 2 + sanitization).
- **STEP-00-03 (DuckDB topology spike)** — selected `worker` topology (isolated child process, JSON-over-stdio IPC, spawned by `apps/worker`); `direct` rejected (native crash not containable). Hardening order: `allow_community_extensions=false` + `allow_unsigned_extensions=false` → `SET allowed_directories=['<sandboxRoot>']` → `SET enable_external_access=false` (carve-out must be set before locking). Measured: `memory_limit` ~244 MiB, `threads=2`, `conn.interrupt()` ~93 ms, wall-clock timeout ~255 ms, pathological query bounded ~10393 ms, atomic Parquet promote, byte cap. Probes: `read_json_auto('/etc/passwd')` DENIED, `ATTACH`/`INSTALL` DENIED. Limitations recorded as DEF-03/DEF-04 (OS/container isolation + cooperative cancellation unproven).
- **STEP-00-02 (live events/cancellation/checkpoint spike)** — append-only journal, event identity `(runId, attempt, sequence)`, cursor `cursor:<attempt>:<sequence>`; event payload < 16 KiB; checkpoint < 64 KiB; SSE heartbeat 15 s; cancel-winner rule (persisted intent wins only before terminal commit); late/duplicate cancel = audited no-op; reconnect `events`/`resync-required`/`forbidden` with auth re-check; terminal reconciliation (no duplicate terminal); duplicate side-effect rate `0`.
- **STEP-00-01 (Fred runtime spike)** — Fred owns workflow graph execution, typed IO validation, hook callbacks, coarse SSE lifecycle; product owns run identity, journals, checkpoints, artifact refs, auth, replay, retrieval, persistence, citation validation, SQL, security. Gap register: typed tool-failure propagation (Phase 1), bounded parallel decomposition + capability-aware routing (Phase 5 → DEF-07).
- **STEP-00-04 (repository contracts)** — package responsibilities + dependency directions (architecture §4.1/§4.2), Fred pinning/lockfile/dev-override (§4.4), migration sole executor `apps/api` (§6.5), local service table + secrets/sanitization (local-development §3/§5), CI gate matrix (repository-contract §2). STEP-00-05 named finalizing owner for trust-boundary enforcement (repository-contract §3.4) and security-enforcement code (§3.2). All enforcement owners in §19 + calibration phases in §22 come from this contract.

### Deliverable landed (docs-only)
- `docs/security-model.md` — appended §19–§26 (no rewrite of existing §1–§18 prose):
  - §19 Trust-boundary enforcement matrix (6 boundaries × 8 columns: crossing data, actor, enforcing component, owner, authorization rule, audit event, safe failure).
  - §20 STRIDE threat register (24 threats: asset, actor, precondition, abuse, impact, preventive control, detective control, residual risk, status, impl/verification phase).
  - §21 Abuse catalog (ABUSE-01..15 covering traversal/encodings, symlink escape/cycles, devices/sockets, hostile/oversized/corrupt files, archive expansion [unsupported], prompt injection across supported types, cross-workspace access, SQL ATTACH/COPY/INSTALL/LOAD/DDL/DML/pragma, unbounded output/fan-out, cancellation bypass, secret leakage, retry duplication, retention/privacy/fixture hygiene, SSRF/server-side request forgery, CSV-formula injection on export).
  - §22 Provisional resource limits (measured values from STEP-00-03/02; TBD values each with owner + evidence + fail-closed default + calibration phase; unsupported-until-designed table for archives/OCR/SQLite).
  - §23 Threat-to-test matrix (every ABUSE → unit/integration/adversarial/recovery test + owner phase).
  - §24 Deferred-risk register (DEF-01..09: severity, owner, due phase, compensating control).
  - §25 STEP-00-06 handoff (abuse category → expected safe behavior → required observable evidence; filesystem/SQL rules; quotas; sanitization/privacy; audit events; unsupported defaults; pre-release security-review ownership).
  - §26 Reconciliation and evidence provenance + change log.

### Constraints respected
- NO premature scaffolding: no `apps/`, `packages/`, new ADR, `docs/threat-model.md`, `package.json`, `bunfig.toml`, `tsconfig.base.json` created. Only `docs/security-model.md` changed.
- NO git mutation: `git diff --check` substituted with read-only `rg` whitespace checks (no trailing whitespace, no tabs) — consistent with STEP-00-04.
- Controls enforce outside prompts and fail closed with typed/sanitized errors; every threat has a named control or accepted residual risk; every boundary has an enforcement owner; no silent `TBD`.
- No real secrets/PII/customer content in fixtures; `/etc/passwd`, `/Users/...`, `/tmp/rogue.db` appear only as canonical attack examples in DENIED/reject context (matching STEP-00-03 probes and existing security-model.md §14).

### Validation observed
- Keyword coverage (Validation Plan rg): `rg -c "trust boundary|workspace|symlink|traversal|prompt injection|ATTACH|INSTALL|LOAD|secret|quota|cancel|audit|retention" docs/security-model.md` → **140 matching lines**.
- Abuse-catalog coverage: all required abuse keywords present (traversal 18, symlink 17, ATTACH 11, INSTALL 12, LOAD 29, DDL 9, DML 8, pragma 6, unbounded 8, fan-out 9, secret 32, retention 9, SSRF 5, CSV-formula 3, httpfs 6, ...). Case-insensitive counts via `rg -ci`.
- Threat register: 24 threats; 22 controlled + 2 accepted-risk (THR-10→DEF-01 archive, THR-22→DEF-06 retention; THR-23 SSRF controlled+deferred→DEF-09), each with control + owner.
- Limits: 24 `TBD`/measured rows, all with owner + fail-closed default + calibration phase; no silent `TBD`.
- Deferred risks: 9 DEFs, all with severity/owner/due-phase/compensating-control (DEF-09 = URL-source SSRF surface).
- Cross-doc contradiction check: §19 boundaries match architecture.md §3.2 exactly; DEC-0009 (registered roots + allowlist SQL) and STEP-00-03 (worker topology + hardening order + DENIED probes) consistent and cited. No contradictions.
- Whitespace: clean (no trailing whitespace, no tabs).

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_05_specify-security-threat-model-and-trust-boundaries|STEP-00-05 Specify Security Threat Model and Trust Boundaries]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
