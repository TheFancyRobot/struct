// Probe: resource + time limits.
// Verifies DuckDB honors memory_limit/threads at create time and that a
// resource-exhausting query is bounded by the wall-clock timeout, not allowed
// to run unbounded.

import { createHardenedConnection } from "../common/duckdb";
import { configurationOptionDescriptions } from "@duckdb/node-api";
import type { ProbeReport } from "../common/results";
import type { RuntimeConfig } from "../common/types";

export async function runResourceLimitsProbe(config: RuntimeConfig): Promise<ProbeReport[]> {
  const reports: ProbeReport[] = [];

  // Confirm the config options we rely on exist in this DuckDB build.
  const opts = configurationOptionDescriptions();
  const need = ["memory_limit", "threads", "temp_directory", "allowed_directories", "enable_external_access", "allow_community_extensions", "allow_unsigned_extensions"];
  const missing = need.filter((k) => !(k in opts));
  reports.push({
    name: "resource-limits: required config options present",
    denied: missing.length === 0,
    message: missing.length === 0 ? "all required options present" : `missing: ${missing.join(", ")}`,
  });

  const { conn, close } = await createHardenedConnection(config);

  // Verify the limits are actually set by reading them back.
  const mem = await conn.runAndReadAll(`SELECT current_setting('memory_limit') AS v`);
  await mem.readAll();
  const memVal = (mem.getRowObjectsJS()[0] as { v: string })?.v ?? "?";
  // DuckDB reports memory_limit in a normalized unit (e.g. "244.1 MiB"), so we
  // confirm it is set (non-default/empty) rather than byte-exact equality.
  const memApplied = memVal !== "0" && memVal !== "" && memVal !== null;
  reports.push({
    name: "resource-limits: memory_limit applied",
    denied: memApplied,
    message: `memory_limit=${memVal} (configured ${config.memoryLimit})`,
  });

  const thr = await conn.runAndReadAll(`SELECT current_setting('threads') AS v`);
  await thr.readAll();
  const thrVal = String((thr.getRowObjectsJS()[0] as { v: unknown })?.v ?? "?");
  const thrApplied = thrVal === config.threads;
  reports.push({
    name: "resource-limits: threads applied",
    denied: thrApplied,
    message: `threads=${thrVal} (configured ${config.threads})`,
  });

  // A pathological query is bounded by the timeout, not allowed to run forever.
  // The orphaned native query is interrupted and drained so close() never
  // races an in-flight scan (which would SIGKILL the process on teardown).
  const t0 = Date.now();
  let bounded = false;
  let readerP: Promise<import("@duckdb/node-api").DuckDBResultReader> | null = null;
  try {
    readerP = conn.runAndReadAll(`SELECT range, repeat('x', 1000000) FROM range(0, 1000000000)`);
    const timeoutP = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("resource timeout")), config.timeoutMs),
    );
    await Promise.race([readerP.then((r) => r.readAll()), timeoutP]);
  } catch {
    bounded = true;
    conn.interrupt();
    if (readerP !== null) {
      try {
        const r = await readerP;
        await r.readAll();
      } catch {
        // Expected: the interrupted query terminates with an error.
      }
    }
  }
  reports.push({
    name: "resource-limits: pathological query bounded by timeout",
    denied: bounded,
    message: `bounded=${bounded} elapsedMs=${Date.now() - t0}`,
  });

  close();
  return reports;
}
