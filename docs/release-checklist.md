# v1.0 release checklist

This is the final go/no-go record for Struct v1. It deliberately stops before
tagging, publishing, deploying, or otherwise performing the release.

## Canonical campaign

- [x] The bounded release campaign passed 23/23 gates with zero failed
  criteria. Evidence:
  [`v1-evaluation-campaign-v1.json`](../packages/evaluation/results/v1-evaluation-campaign-v1.json)
  and [`v1 Evaluation Campaign`](./benchmarks/v1-evaluation-campaign.md).
- [x] The canonical campaign report SHA-256 is
  `c616237f6a434ab6b0c0ff27776aea3ba359180ce97e0a4df646f82e59727aa2`.
  The campaign included 781 unit tests, 114 real PostgreSQL/data-engine
  integration tests, 21 Playwright journeys, two 25,000-file evaluators,
  recovery, build, typecheck, zero-warning lint, import boundaries,
  documentation links, secret scanning, and vault integrity.
- [x] The post-campaign accessibility closure passed the full maintained
  browser suite at 22/22 with 434 assertions after rebuilding the production
  bundle.
- [x] No campaign input hashed by `scripts/v1-evaluation-campaign.ts` changed
  during documentation/accessibility closure, so the passing campaign remains
  canonical. The changed Solid UI and browser assertions are revalidated by
  the focused commands in
  [`Accessibility and responsive UI evidence`](./accessibility.md).

## Product and operations

- [x] Setup and configuration match `package.json`, `.env.example`, and the
  running topology. Evidence: [`Quickstart`](./setup.md) and
  [`Local Development`](./local-development.md).
- [x] The production topology and ownership boundaries are documented.
  Evidence: [`Architecture`](./architecture.md) and
  [`Deployment and Recovery`](./operations/deployment-recovery.md).
- [x] PostgreSQL and content-addressed artifact backups are paired, guarded,
  content-verified, and covered by restore/restart proof. Evidence:
  [`Deployment and Recovery`](./operations/deployment-recovery.md) and the
  campaign `deployment-recovery-proof` gate.
- [x] Database outage, worker stall, data-engine outage, stuck/cancelled run,
  SSE reconnect storm, backup/restore failure, and secret exposure have
  detection, containment, recovery, and verification procedures. Evidence:
  [`Observability and incident response`](./operations/observability-incident-response.md).
- [x] Performance ceilings and fault classifications pass without weakened
  thresholds. Evidence:
  [`v1 performance, capacity, and resilience gate`](./benchmarks/v1-performance-resilience.md).
- [x] Health and readiness are distinct; rollout/rollback gates use readiness.
  Evidence: `/healthz`, `/readyz`, `bun run ops database:verify`, and
  `bun run ops application:verify` in the operations runbooks.

## Security and privacy

- [x] Bearer authentication, workspace authorization, sandboxed filesystem
  roots, read-only allowlisted SQL, no-egress data-engine isolation, bounded
  execution, typed failures, citation validation, and prompt-injection
  resistance are covered by the campaign. Evidence:
  [`Security Model`](./security-model.md) and phase evidence linked by the
  canonical campaign report.
- [x] Logs, spans, support diagnostics, errors, fixtures, screenshots, and
  documentation contain no credential or private-source payloads. Evidence:
  `bun run secrets:scan` plus
  [`Observability and incident response`](./operations/observability-incident-response.md).
- [x] Greenfield behavior is explicit: no compatibility layer or data
  preservation migration is required; guarded drop/recreate is the supported
  reset path.

## User workflows and accessibility

- [x] Document research, structured queries, directory/recursive analysis,
  mixed-source synthesis, exact citation navigation, durable findings, report
  editing/history/repair, publication gating, and export are covered by unit,
  integration, evaluation, and browser evidence.
- [x] Keyboard, focus, dialog, structure, labels, live status, contrast,
  reduced motion, error recovery, 320-pixel reflow, and the six required
  viewport/theme screenshots pass the focused release contract. Evidence:
  [`Accessibility and responsive UI evidence`](./accessibility.md).
- [x] The 1440×900, 1024×768, and 390×844 light/dark screenshots were visually
  reviewed for overflow, clipping, contrast, hierarchy, and usable density.

## Documentation and review

- [x] Every documented root command was reconciled against the executable
  `package.json` scripts and `scripts/production-operations.ts` command switch.
- [x] Local Markdown links pass `bun run docs:lint`.
- [x] The final closure change received a worker self-review across affected
  Solid components, routes, browser assertions, commands, and documentation.
- [x] The root orchestrator owns the final clean-tree assertion and automated
  PR review before merge. Immediately before release it must run
  `test -z "$(git status --porcelain)"`; this ephemeral proof cannot be cached
  in a committed document.

## Accepted v1 limits

- Single-node deployment: Bun hosts web/API/worker; Compose hosts PostgreSQL and
  the authenticated, no-egress DuckDB data engine. Kubernetes, multi-region,
  and object-storage adapters are post-v1 concerns.
- Authentication is a single operator-managed bearer credential bound to one
  configured workspace, not user self-service sessions or an internet-facing
  multi-tenant identity system.
- Artifact persistence is local content-addressed disk storage and must be
  backed up/restored with its paired PostgreSQL archive.
- Project/source creation and research initiation remain API/operator driven;
  the maintained browser surfaces focus on research progress, citations,
  mixed-source evidence, notebooks, and reports.
- URL ingestion, archive expansion, OCR for scanned PDFs, Office formats, and
  SQLite import are unsupported rather than partially or unsafely accepted.
- Performance ceilings are release gates measured on the recorded host, not
  universal latency guarantees for every machine or model provider.

## Release procedure — intentionally not executed

Deployment is separate: this repository has no executable production deploy
target, so the v1.0 release consists only of publishing the reviewed source
state and its tag. From the repository root, the release owner must run:

```sh
git switch main
git pull --ff-only origin main
test -z "$(git status --porcelain)"
bun --version                         # must print 1.3.13
bun install --frozen-lockfile
bun run v1:evaluate                  # must finish 23/23 with zero failures
git tag -a v1.0.0 -m "Struct v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --verify-tag --generate-notes --title "Struct v1.0.0"
```

If any preflight command fails, stop before creating the tag. If the tag push
succeeds but GitHub release publication fails, repair or remove the remote tag
deliberately before retrying; never create a different artifact under the same
version.

- [ ] Perform the exact v1.0 tag and GitHub release commands above. Do not
  check this box until they are intentionally authorized and complete.
