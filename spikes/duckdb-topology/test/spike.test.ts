// Test suite for the DuckDB topology spike.
// Covers: all three topologies (correctness/hash/parity), and every probe
// (allowlist, cancellation/timeout, child crash recovery, temp cleanup/bounds,
// resource/time limits). No swallowed failures: every assertion is explicit.

import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DirectTopology } from "../src/direct/direct";
import { WorkerTopology } from "../src/worker/parent";
import { ServiceTopology } from "../src/service/client";
import { smokeRows, stableHash } from "../src/common/fixtures";
import { createHardenedConnection, importJSONFile, exportParquetAtomic, boundedQuery } from "../src/common/duckdb";
import { runAllowlistProbe } from "../src/probes/allowlist";
import { runCancellationProbe } from "../src/probes/cancellation";
import { runChildCrashProbe } from "../src/probes/child-crash";
import { runTempCleanupProbe } from "../src/probes/temp-cleanup";
import { runResourceLimitsProbe } from "../src/probes/resource-limits";
import { selectWinner } from "../src/benchmarks/run";
import type { RuntimeConfig } from "../src/common/types";
import type { ProbeReport, TopologyReport, MeasurementReport } from "../src/common/results";

function makeConfig(root: string): RuntimeConfig {
  return {
    rootDir: root,
    memoryLimit: "128MB",
    threads: "1",
    timeoutMs: 8000,
    maxRows: 1000,
    maxOutputBytes: 16 * 1024 * 1024,
  };
}

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), "duckdb-test-"));
}

function expectedSmokeHash(): string {
  const expected = smokeRows().reduce<Record<string, number>>((acc, r) => {
    acc[r.department] = (acc[r.department] ?? 0) + 1;
    return acc;
  }, {});
  return stableHash(
    Object.entries(expected)
      .map(([k, v]) => ({ department: k, c: v }))
      .sort((a, b) => a.department.localeCompare(b.department)),
  );
}

async function exerciseTopology(name: string, topo: DirectTopology | WorkerTopology | ServiceTopology) {
  test(`${name}: import, query, parquet round-trip with deterministic hash`, async () => {
    const root = freshRoot();
    const cfg = makeConfig(root);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(root, "data"), { recursive: true });
    mkdirSync(join(root, "parquet"), { recursive: true });
    const jsonPath = join(root, "data", "smoke.json");
    const pqPath = join(root, "parquet", "smoke.parquet");
    writeFileSync(jsonPath, JSON.stringify(smokeRows()));

    await topo.initialize(cfg);
    await topo.importJSON(jsonPath, "js");
    const result = await topo.query(
      "SELECT department, count(*) AS c FROM js GROUP BY department ORDER BY department LIMIT 10",
    );
    expect(result.rowsHash).toBe(expectedSmokeHash());
    expect(result.rowCount).toBe(4);
    expect(result.truncated).toBe(false);

    await topo.exportParquet("SELECT * FROM js", pqPath);
    expect(existsSync(pqPath)).toBe(true);
    const back = await topo.query(`SELECT count(*) AS c FROM read_parquet('${pqPath}') LIMIT 1`);
    expect(back.rowCount).toBe(1);
    await topo.shutdown();
    rmSync(root, { recursive: true, force: true });
  });

  test(`${name}: query hash matches direct ground truth`, async () => {
    const root = freshRoot();
    const cfg = makeConfig(root);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(root, "data"), { recursive: true });
    const jsonPath = join(root, "data", "smoke.json");
    writeFileSync(jsonPath, JSON.stringify(smokeRows()));

    // Ground truth from a bare hardened connection (no topology wrapper).
    const { conn, close } = await createHardenedConnection(cfg);
    await importJSONFile(conn, jsonPath, "gt", root);
    const groundTruth = await boundedQuery(
      conn,
      "SELECT department, count(*) AS c FROM gt GROUP BY department ORDER BY department LIMIT 10",
      cfg.maxRows,
    );
    close();

    await topo.initialize(cfg);
    await topo.importJSON(jsonPath, "js");
    const result = await topo.query(
      "SELECT department, count(*) AS c FROM js GROUP BY department ORDER BY department LIMIT 10",
    );
    // Every topology must produce a hash identical to the direct ground truth.
    expect(result.rowsHash).toBe(groundTruth.rowsHash);
    expect(result.rowsHash).toBe(expectedSmokeHash());
    await topo.shutdown();
    rmSync(root, { recursive: true, force: true });
  });
}

exerciseTopology("direct", new DirectTopology());
exerciseTopology("worker", new WorkerTopology());
exerciseTopology("service", new ServiceTopology());

test("allowlist probe: arbitrary paths, ATTACH, INSTALL, and outside writes denied", async () => {
  const root = freshRoot();
  const cfg = makeConfig(root);
  const reports = await runAllowlistProbe(cfg);
  const mustDeny = ["read /etc/passwd", "ATTACH", "INSTALL", "COPY TO /tmp", "traversal"];
  for (const name of mustDeny) {
    const r = reports.find((x) => x.name.includes(name));
    expect(r, `missing probe: ${name}`).toBeDefined();
    expect(r!.denied, `${name} should be denied: ${r!.message}`).toBe(true);
  }
  const inside = reports.find((x) => x.name.includes("inside root"));
  expect(inside!.denied, `inside-root should succeed: ${inside!.message}`).toBe(false);
  rmSync(root, { recursive: true, force: true });
});

test("cancellation + timeout probe", async () => {
  const root = freshRoot();
  const cfg = makeConfig(root);
  const reports = await runCancellationProbe(cfg);
  const cancel = reports.find((r) => r.name.includes("interrupt()"));
  expect(cancel!.denied, `cancel should terminate: ${cancel!.message}`).toBe(true);
  const timeout = reports.find((r) => r.name.includes("wall-clock"));
  expect(timeout!.denied, `timeout should reject: ${timeout!.message}`).toBe(true);
  rmSync(root, { recursive: true, force: true });
});

test("child crash recovery probe: parent survives, recovers, retries (worker + service)", async () => {
  const root = freshRoot();
  const cfg = makeConfig(root);
  const reports = await runChildCrashProbe(cfg);
  // Crash containment is honest PER TOPOLOGY: both process-isolated
  // candidates must independently survive a forced crash and recover.
  for (const t of ["worker", "service"]) {
    const survived = reports.find((r) => r.name === `child-crash:${t}: parent survives crash`);
    expect(survived, `missing ${t} survive probe`).toBeDefined();
    expect(survived!.denied, `${t} parent should survive: ${survived!.message}`).toBe(true);
    const recovered = reports.find((r) => r.name === `child-crash:${t}: recover + retry after crash`);
    expect(recovered, `missing ${t} recover probe`).toBeDefined();
    expect(recovered!.denied, `${t} recovery retry should succeed: ${recovered!.message}`).toBe(true);
  }
  rmSync(root, { recursive: true, force: true });
});

test("temp cleanup + bounds probe: atomic promote, byte cap, root removal", async () => {
  const root = freshRoot();
  const cfg = makeConfig(root);
  const reports = await runTempCleanupProbe(cfg);
  const atomic = reports.find((r) => r.name.includes("atomic promote"));
  expect(atomic!.denied, `atomic promote: ${atomic!.message}`).toBe(true);
  const cap = reports.find((r) => r.name.includes("byte cap"));
  expect(cap!.denied, `byte cap should reject: ${cap!.message}`).toBe(true);
  const removed = reports.find((r) => r.name.includes("root removed"));
  expect(removed!.denied, `root should be removed: ${removed!.message}`).toBe(true);
  rmSync(root, { recursive: true, force: true });
});

test("resource + time limits probe", async () => {
  const root = freshRoot();
  const cfg: RuntimeConfig = { ...makeConfig(root), timeoutMs: 3000 };
  const reports = await runResourceLimitsProbe(cfg);
  const opts = reports.find((r) => r.name.includes("config options present"));
  expect(opts!.denied, `options should be present: ${opts!.message}`).toBe(true);
  const mem = reports.find((r) => r.name.includes("memory_limit"));
  expect(mem!.denied, `memory_limit should be applied: ${mem!.message}`).toBe(true);
  const thr = reports.find((r) => r.name.includes("threads"));
  expect(thr!.denied, `threads should be applied: ${thr!.message}`).toBe(true);
  const bounded = reports.find((r) => r.name.includes("pathological"));
  expect(bounded!.denied, `pathological query should be bounded: ${bounded!.message}`).toBe(true);
  rmSync(root, { recursive: true, force: true });
});

test("hardening: direct read of /etc/passwd is denied at FS layer", async () => {
  const root = freshRoot();
  const cfg = makeConfig(root);
  const { conn, close } = await createHardenedConnection(cfg);
  await expect(
    (async () => {
      const r = await conn.runAndReadAll(`SELECT * FROM read_json_auto('/etc/passwd') LIMIT 1`);
      await r.readAll();
    })(),
  ).rejects.toThrow();
  close();
  rmSync(root, { recursive: true, force: true });
});

test("atomic parquet: partial .tmp is never promoted as final", async () => {
  const root = freshRoot();
  const cfg = makeConfig(root);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "parquet"), { recursive: true });
  const jsonPath = join(root, "data", "x.json");
  writeFileSync(jsonPath, '[{"id":1,"name":"a"},{"id":2,"name":"b"}]');
  const { conn, close } = await createHardenedConnection(cfg);
  await importJSONFile(conn, jsonPath, "src", root);
  const pq = join(root, "parquet", "atomic.parquet");
  await exportParquetAtomic(conn, "SELECT * FROM src", pq, root, cfg.maxOutputBytes);
  expect(existsSync(pq)).toBe(true);
  // No leftover .tmp-* partial.
  const { readdirSync } = await import("node:fs");
  const partials = readdirSync(join(root, "parquet")).filter((f) => f.includes(".tmp-"));
  expect(partials).toEqual([]);
  close();
  rmSync(root, { recursive: true, force: true });
});

test("bounded query: unbounded SELECT without LIMIT is capped at maxRows", async () => {
  const root = freshRoot();
  const cfg = makeConfig(root);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(root, "data"), { recursive: true });
  const jsonPath = join(root, "data", "scale.json");
  const { scaleRows } = await import("../src/common/fixtures");
  writeFileSync(jsonPath, JSON.stringify(scaleRows(25000, 0x5eed)));
  const { conn, close } = await createHardenedConnection(cfg);
  await importJSONFile(conn, jsonPath, "scale", root);
  const result = await boundedQuery(conn, "SELECT * FROM scale", cfg.maxRows);
  expect(result.rowCount).toBe(cfg.maxRows);
  expect(result.truncated).toBe(true);
  close();
  rmSync(root, { recursive: true, force: true });
});

// --- Selection regression: per-topology crash-containment gate ---
// Regression for the defect where a single global child-crash probe (worker
// only) let the in-process `direct` candidate (crashContained=null) pass the
// crash gate and win. The gate must be per-topology: an in-process native
// crash cannot be contained, so direct can never qualify; worker/service
// qualify only with honest per-topology containment evidence.

function selTopo(
  name: string,
  isolation: string,
  ms: number,
  crashContained: boolean | null,
): TopologyReport {
  const measurements: MeasurementReport[] = [
    { operation: "all", durationMs: ms, peakRssBytes: 0, ok: true, detail: "ok" },
  ];
  return {
    name,
    isolation,
    measurements,
    correctness: { passed: true, rowsHash: "h", detail: "ok" },
    crashContained,
  };
}

function selProbe(name: string, denied: boolean): ProbeReport {
  return { name, denied, message: "m" };
}

const safetyProbes: ProbeReport[] = [
  selProbe("allowlist: read /etc/passwd", true),
  selProbe("cancellation: interrupt() long scan", true),
];

test("selection regression: in-process direct (crashContained=null) cannot win via global crash probe; crash-contained worker wins", () => {
  // direct is simplest + fastest but cannot contain a native crash (null).
  const direct = selTopo("direct", "none", 50, null);
  const worker = selTopo("worker", "process", 108, true);
  const service = selTopo("service", "service", 128, true);
  // The OLD global worker-only crash probe is present and passing; it must NOT
  // be allowed to let the in-process direct candidate qualify.
  const probes: ProbeReport[] = [
    ...safetyProbes,
    selProbe("child-crash: parent survives crash", true),
  ];
  const sel = selectWinner([direct, worker, service], probes);
  expect(sel.winner).not.toBe("direct");
  expect(sel.winner).toBe("worker");
  expect(sel.blocker).toBe(null);
});

test("selection regression: no honest crash containment -> null winner with crash blocker", () => {
  const direct = selTopo("direct", "none", 50, null);
  const worker = selTopo("worker", "process", 108, null); // no honest evidence
  const service = selTopo("service", "service", 128, null); // no honest evidence
  const sel = selectWinner([direct, worker, service], safetyProbes);
  expect(sel.winner).toBe(null);
  expect(sel.blocker).toBe("crash not contained");
});
