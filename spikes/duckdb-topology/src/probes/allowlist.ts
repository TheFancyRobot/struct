// Probe: filesystem allowlist + root rejection.
// Verifies the proven hardening sequence denies arbitrary paths, ATTACH,
// INSTALL, and writes outside the sandbox root, while allowing I/O inside it.

import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHardenedConnection, importJSONFile, exportParquetAtomic } from "../common/duckdb";
import { probeDenial } from "../common/security";
import type { ProbeReport } from "../common/results";
import type { RuntimeConfig } from "../common/types";

export async function runAllowlistProbe(config: RuntimeConfig): Promise<ProbeReport[]> {
  const { conn, close } = await createHardenedConnection(config);
  const jsonPath = join(config.rootDir, "data", "allowlist.json");
  writeFileSync(jsonPath, '[{"id":1,"name":"ok"}]');

  const reports: ProbeReport[] = [];

  // Positive: allowed path inside root works.
  try {
    await importJSONFile(conn, jsonPath, "allowed", config.rootDir);
    reports.push({ name: "allowlist: read inside root", denied: false, message: "ok (carve-out works)" });
  } catch (e) {
    reports.push({ name: "allowlist: read inside root", denied: true, message: (e as Error).message.slice(0, 160) });
  }

  // Negative: arbitrary path /etc/passwd must be DENIED at FS layer.
  reports.push(
    await probeDenial("allowlist: read /etc/passwd", async () => {
      const r = await conn.runAndReadAll(`SELECT * FROM read_json_auto('/etc/passwd') LIMIT 1`);
      await r.readAll();
    }),
  );

  // Negative: ATTACH outside root must be DENIED.
  reports.push(
    await probeDenial("allowlist: ATTACH outside root", async () => {
      await conn.run(`ATTACH '/tmp/probe-rogue-${process.pid}.db' AS rogue`);
    }),
  );

  // Negative: INSTALL extension (network) must be DENIED.
  reports.push(
    await probeDenial("allowlist: INSTALL httpfs", async () => {
      await conn.run(`INSTALL httpfs`);
    }),
  );

  // Negative: COPY TO outside root must be DENIED.
  reports.push(
    await probeDenial("allowlist: COPY TO /tmp (outside root)", async () => {
      await exportParquetAtomic(conn, "SELECT 1", `/tmp/probe-leak-${process.pid}.parquet`, config.rootDir, config.maxOutputBytes);
    }),
  );

  // Negative: path-traversal attempt via ../ must be rejected by our guard.
  reports.push(
    await probeDenial("allowlist: path traversal ../", async () => {
      await importJSONFile(conn, join(config.rootDir, "../etc/passwd"), "bad", config.rootDir);
    }),
  );

  close();
  rmSync(`/tmp/probe-rogue-${process.pid}.db`, { force: true });
  rmSync(`/tmp/probe-leak-${process.pid}.parquet`, { force: true });
  return reports;
}

// Smoke helper used by tests: a standalone hardening check.
export async function smokeHardening(): Promise<boolean> {
  const root = mkdtempSync(join(tmpdir(), "duckdb-smoke-"));
  try {
    const cfg: RuntimeConfig = {
      rootDir: root,
      memoryLimit: "128MB",
      threads: "1",
      timeoutMs: 5000,
      maxRows: 1000,
      maxOutputBytes: 10 * 1024 * 1024,
    };
    const reports = await runAllowlistProbe(cfg);
    rmSync(root, { recursive: true, force: true });
    const denials = reports.filter((r) => r.name.includes("DENIED") || r.name.includes("/etc/passwd") || r.name.includes("ATTACH") || r.name.includes("INSTALL") || r.name.includes("/tmp") || r.name.includes("traversal"));
    return denials.every((d) => d.denied);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
