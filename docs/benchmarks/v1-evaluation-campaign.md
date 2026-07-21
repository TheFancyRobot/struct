# v1 Evaluation Campaign

- Status: **passed**
- Campaign: `struct-v1-release-evaluation-v1`
- Runtime: `bun-1.3.13` on `darwin-arm64`
- Gates: 23 passed, 0 failed criteria
- Evidence artifacts: 8, all hash-qualified
- Report SHA-256: `c616237f6a434ab6b0c0ff27776aea3ba359180ce97e0a4df646f82e59727aa2`
- Remediation log: [docs/operations/v1-evaluation-remediation.md](../operations/v1-evaluation-remediation.md)

The bounded `bun run v1:evaluate` command composes the existing phase evaluators and hardening gates. It does not replace their owner thresholds. A timeout, nonzero process exit, stale artifact, failed evidence status, or deterministic report mismatch fails closed.
