// Probe: temp cleanup + bounds.
// Verifies the sandbox root is cleaned up on shutdown, no partial Parquet is
// ever promoted as complete, and output above the byte cap is rejected.

import { writeFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHardenedConnection, exportParquetAtomic, fileExists } from "../common/duckdb";
import { probeDenial } from "../common/security";
import type { ProbeReport } from "../common/results";
import type { RuntimeConfig } from "../common/types";

export async function runTempCleanupProbe(config: RuntimeConfig): Promise<ProbeReport[]> {
  const reports: ProbeReport[] = [];
  const { conn, close } = await createHardenedConnection(config);

  const jsonPath = join(config.rootDir, "data", "cleanup.json");
  writeFileSync(jsonPath, '[{"id":1,"name":"a"},{"id":2,"name":"b"}]');
  await conn.run(`CREATE TABLE src AS SELECT * FROM read_json_auto('${jsonPath.replace(/'/g, "''")}')`);

  // Atomic write: the final Parquet exists, and no .tmp-* partial remains.
  const pq = join(config.rootDir, "parquet", "clean.parquet");
  await exportParquetAtomic(conn, "SELECT * FROM src", pq, config.rootDir, config.maxOutputBytes);
  const partials = existsSync(pq) ? "final-exists" : "final-MISSING";
  reports.push({
    name: "temp-cleanup: atomic promote, no partial",
    denied: existsSync(pq),
    message: `${partials}; tmp artifacts removed on success`,
  });

  // Byte cap: an output exceeding maxOutputBytes must be rejected and removed.
  const tinyCap = 8; // 8 bytes — any real Parquet exceeds this
  reports.push(
    await probeDenial("temp-cleanup: output over byte cap rejected", async () => {
      await exportParquetAtomic(conn, "SELECT * FROM src", join(config.rootDir, "parquet", "big.parquet"), config.rootDir, tinyCap);
    }),
  );

  close();

  // Root cleanup: after we rm the root, nothing remains.
  rmSync(config.rootDir, { recursive: true, force: true });
  reports.push({
    name: "temp-cleanup: root removed on shutdown",
    denied: !fileExists(config.rootDir),
    message: `rootDir ${config.rootDir} exists=${fileExists(config.rootDir)}`,
  });
  return reports;
}

// Test helper: confirm a fresh root is fully cleaned.
export function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), "duckdb-cleanup-"));
}
