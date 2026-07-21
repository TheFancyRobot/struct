# v1 Evaluation Remediation Log

This log records every failure observed while running the bounded v1 release campaign. Classify a failure before changing product code, review affected callers and tests in the same remediation round, and never weaken an owner threshold.

## Campaign preparation

- No failure was observed while mapping or implementing the campaign inventory.
- Existing capability evaluators and hardening commands were composed without changing their thresholds.

## Failure records

- `dependency-stack-readiness` first failed before starting Compose because the
  campaign did not pass the required local `DATABASE_URL`. A second preflight
  run then failed closed because `DATA_ENGINE_TOKEN` was also absent.
  Classification: campaign harness configuration, not a product defect.
  Remediation: pass the same bounded local dependency configuration used by the
  evaluation and integration gates. All production-operation callers were
  reviewed; no product operation behavior or threshold changed.
- `deployment-recovery-proof` proved database/artifact restore correctness, then
  failed during cleanup because `stack:restart` restarted containers whose bind
  mount still named the deleted recovery artifact root. Classification:
  confirmed product recovery defect. Remediation: make `stack:restart` prepare
  the active root and force-recreate the Compose services, so a changed bind
  mount is applied. The deployment/recovery callers and runbook were reviewed,
  a command-plan regression test was added, and the live recovery proof is rerun
  by this campaign. No evaluator threshold was changed.
- The first post-remediation campaign completed all 23 executable gates, then
  artifact assembly failed because the harness named `compose.yaml` instead of
  the repository's `docker-compose.yml`. Classification: campaign evidence-path
  configuration, not a product defect. Remediation: hash the actual checked-in
  Compose contract. No gate result or threshold changed.
- The deterministic check run later observed one mixed-source dark-theme
  screenshot assertion before the computed root background had applied, even
  though both theme attributes were already correct; the same five-test suite
  passed immediately on a narrow rerun. Classification: intermittent Playwright
  stylesheet-readiness race, not a product defect. Remediation: add one bounded
  computed-style readiness helper and apply it to all three responsive
  light/dark screenshot matrices before assertions and capture.
- The first post-readiness generate run reported one ESLint warning for a
  Playwright type-only import while still exiting successfully. Classification:
  confirmed campaign/static-gate defect. Remediation: use an inline type import
  and make the campaign's lint gate fail on any warning with `--max-warnings 0`.
