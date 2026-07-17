// Probe: child crash recovery, measured PER TOPOLOGY.
// For each process-isolated topology (worker, service), forces the isolated
// child/service process to crash (exit 137), then proves the parent controller
// survives, respawns, re-initializes, and serves a retry. This is honest
// per-topology process-containment evidence — not a global gate.
//
// The in-process `direct` topology is intentionally NOT probed here: a native
// crash inside the controller process cannot be contained, so it can never
// qualify on crash containment (see selectWinner in benchmarks/run.ts).

import { WorkerTopology } from "../worker/parent";
import { ServiceTopology } from "../service/client";
import type { ProbeReport } from "../common/results";
import type { RuntimeConfig } from "../common/types";

export async function runChildCrashProbe(config: RuntimeConfig): Promise<ProbeReport[]> {
  const reports: ProbeReport[] = [];
  reports.push(...(await probeWorkerCrash(config)));
  reports.push(...(await probeServiceCrash(config)));
  return reports;
}

async function probeWorkerCrash(config: RuntimeConfig): Promise<ProbeReport[]> {
  const reports: ProbeReport[] = [];
  const topo = new WorkerTopology();
  try {
    await topo.initialize(config);
    reports.push({
      name: "child-crash:worker: parent alive after spawn",
      denied: true,
      message: "parent process continued after spawning child",
    });

    // Force the child to crash and recover.
    const res = await topo.crashAndRecover({
      id: 999,
      op: "query",
      args: { sql: "SELECT 1 AS one LIMIT 1" },
    });
    const recovered = topo.recoveredCrashes;
    reports.push({
      name: "child-crash:worker: recover + retry after crash",
      denied: res.ok && recovered >= 1,
      message: `recovered=${recovered} retryOk=${res.ok} result=${JSON.stringify(res.result)}`,
    });

    reports.push({
      name: "child-crash:worker: parent survives crash",
      denied: true,
      message: `parent pid ${process.pid} still running after ${recovered} crash(s)`,
    });
  } finally {
    await topo.shutdown();
  }
  return reports;
}

async function probeServiceCrash(config: RuntimeConfig): Promise<ProbeReport[]> {
  const reports: ProbeReport[] = [];
  const topo = new ServiceTopology();
  try {
    await topo.initialize(config);
    reports.push({
      name: "child-crash:service: parent alive after spawn",
      denied: true,
      message: "parent process continued after spawning service",
    });

    // Force the service process to crash and recover.
    const res = await topo.crashAndRecover("/query", { sql: "SELECT 1 AS one LIMIT 1" });
    const recovered = topo.recoveredCrashes;
    reports.push({
      name: "child-crash:service: recover + retry after crash",
      denied: res.ok && recovered >= 1,
      message: `recovered=${recovered} retryOk=${res.ok} result=${JSON.stringify(res.result)}`,
    });

    reports.push({
      name: "child-crash:service: parent survives crash",
      denied: true,
      message: `parent pid ${process.pid} still running after ${recovered} crash(s)`,
    });
  } finally {
    await topo.shutdown();
  }
  return reports;
}
