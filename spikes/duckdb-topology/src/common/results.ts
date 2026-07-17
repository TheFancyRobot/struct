// Machine-generated benchmark result writer. Writes ONLY measured values.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { hostname, type, freemem, totalmem } from "node:os";
import { version as duckdbVersion } from "@duckdb/node-api";

export interface BenchmarkBundle {
  readonly generatedAt: string;
  readonly machine: MachineMeta;
  readonly topologies: readonly TopologyReport[];
  readonly probes: readonly ProbeReport[];
  readonly limitations: readonly string[];
  readonly selection: SelectionReport;
}

export interface MachineMeta {
  readonly hostname: string;
  readonly osType: string;
  readonly freeMemBytes: number;
  readonly totalMemBytes: number;
  readonly nodeVersion: string;
  readonly bunVersion: string;
  readonly duckdbVersion: string;
}

export interface TopologyReport {
  readonly name: string;
  readonly isolation: string;
  readonly measurements: readonly MeasurementReport[];
  readonly correctness: { readonly passed: boolean; readonly rowsHash: string; readonly detail: string };
  readonly crashContained: boolean | null;
}

export interface MeasurementReport {
  readonly operation: string;
  readonly durationMs: number;
  readonly peakRssBytes: number;
  readonly ok: boolean;
  readonly detail: string;
}

export interface ProbeReport {
  readonly name: string;
  readonly denied: boolean;
  readonly message: string;
}

export interface SelectionReport {
  readonly winner: string | null;
  readonly rationale: string;
  readonly blocker: string | null;
}

export function machineMeta(): MachineMeta {
  return {
    hostname: hostname(),
    osType: type(),
    freeMemBytes: freemem(),
    totalMemBytes: totalmem(),
    nodeVersion: process.version,
    bunVersion: (globalThis as { Bun?: { version: string } }).Bun?.version ?? "n/a",
    duckdbVersion: duckdbVersion(),
  };
}

/** Write the benchmark bundle as stable, pretty JSON. */
export function writeBenchmarkBundle(bundle: BenchmarkBundle, outPath: string): void {
  mkdirSync(dirname(outPath) || ".", { recursive: true });
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
}
