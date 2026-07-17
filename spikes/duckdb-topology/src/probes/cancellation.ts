// Probe: cancellation + timeout.
// Verifies conn.interrupt() cancels a long CPU-bound scan and produces a typed
// terminal outcome, and that a wall-clock timeout rejects a hung operation.

import { createHardenedConnection } from "../common/duckdb";
import type { DuckDBResultReader } from "@duckdb/node-api";
import type { CancelOutcome, RuntimeConfig } from "../common/types";
import type { ProbeReport } from "../common/results";

export async function runCancellationProbe(config: RuntimeConfig): Promise<ProbeReport[]> {
  const { conn, close } = await createHardenedConnection(config);
  const reports: ProbeReport[] = [];

  // Cancellation: start a long scan, interrupt after a short delay, and confirm
  // it terminates (not hangs the parent).
  const started = Date.now();
  const longQ = conn.runAndReadAll(
    `SELECT range, repeat('x', 100000) FROM range(0, 200000000)`,
  );
  await new Promise((r) => setTimeout(r, 80));
  conn.interrupt();
  let outcome: CancelOutcome;
  try {
    const reader = await longQ;
    await reader.readAll();
    outcome = { kind: "completed", latencyMs: Date.now() - started, rowCount: reader.currentRowCount };
  } catch (e) {
    outcome = { kind: "cancelled", latencyMs: Date.now() - started };
    void e;
  }
  reports.push({
    name: "cancellation: interrupt() long scan",
    denied: outcome.kind === "cancelled",
    message: `outcome=${outcome.kind} latencyMs=${outcome.latencyMs}`,
  });

  // Timeout: a bounded query that exceeds the wall-clock cap must reject.
  // The orphaned native query is interrupted and drained so close() never
  // races an in-flight scan (which would SIGKILL the process on teardown).
  const cap = 200; // 200ms cap for the probe
  const t0 = Date.now();
  let timedOut = false;
  let readerP: Promise<DuckDBResultReader> | null = null;
  try {
    readerP = conn.runAndReadAll(
      `SELECT range, repeat('x', 100000) FROM range(0, 200000000)`,
    );
    const timeoutP = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), cap),
    );
    await Promise.race([readerP.then((r) => r.readAll()), timeoutP]);
  } catch {
    timedOut = true;
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
    name: "timeout: wall-clock cap rejects long op",
    denied: timedOut,
    message: `timedOut=${timedOut} elapsedMs=${Date.now() - t0}`,
  });

  close();
  return reports;
}
