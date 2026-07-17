// Isolated worker child entrypoint. Run as its own process.
//
// Reads newline-delimited JSON requests from stdin, executes them against a
// hardened in-process DuckDB connection, and writes newline-delimited JSON
// responses to stdout. The "crash" op force-exits the process so the parent's
// crash-recovery path can be exercised.

import { createInterface } from "node:readline/promises";
import type { DuckDBConnection } from "@duckdb/node-api";
import type { RuntimeConfig } from "../common/types";
import {
  boundedQuery,
  createHardenedConnection,
  exportParquetAtomic,
  importCSVFile,
  importJSONFile,
  interruptConnection,
} from "../common/duckdb";
import type { WorkerRequest, WorkerResponse } from "./protocol";

let conn: DuckDBConnection | null = null;
let close: (() => void) | null = null;
let config: RuntimeConfig | null = null;

function respond(res: WorkerResponse): void {
  process.stdout.write(`${JSON.stringify(res)}\n`);
}

async function handle(req: WorkerRequest): Promise<void> {
  const { id, op } = req;
  try {
    switch (op) {
      case "init": {
        config = req.args as unknown as RuntimeConfig;
        const made = await createHardenedConnection(config);
        conn = made.conn;
        close = made.close;
        respond({ id, ok: true });
        return;
      }
      case "importJSON": {
        const a = req.args as { absPath: string; table: string };
        await importJSONFile(conn!, a.absPath, a.table, config!.rootDir);
        respond({ id, ok: true });
        return;
      }
      case "importCSV": {
        const a = req.args as { absPath: string; table: string };
        await importCSVFile(conn!, a.absPath, a.table, config!.rootDir);
        respond({ id, ok: true });
        return;
      }
      case "exportParquet": {
        const a = req.args as { sql: string; absPath: string };
        await exportParquetAtomic(
          conn!,
          a.sql,
          a.absPath,
          config!.rootDir,
          config!.maxOutputBytes,
        );
        respond({ id, ok: true });
        return;
      }
      case "query": {
        const a = req.args as { sql: string };
        const result = await boundedQuery(conn!, a.sql, config!.maxRows);
        respond({ id, ok: true, result });
        return;
      }
      case "cancel": {
        const started = Date.now();
        if (conn !== null) interruptConnection(conn);
        respond({ id, ok: true, result: { kind: "cancelled", latencyMs: Date.now() - started } });
        return;
      }
      case "shutdown": {
        close?.();
        respond({ id, ok: true });
        process.exit(0);
      }
      case "crash": {
        // Force a non-zero exit so the parent's crash recovery is exercised.
        respond({ id, ok: true });
        process.exit(137);
      }
      default:
        respond({ id, ok: false, error: `unknown op: ${op}` });
    }
  } catch (e) {
    respond({ id, ok: false, error: (e as Error).message });
  }
}

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, terminal: false });
  for await (const line of rl) {
    if (line.trim() === "") continue;
    let req: WorkerRequest;
    try {
      req = JSON.parse(line) as WorkerRequest;
    } catch (e) {
      respond({ id: -1, ok: false, error: `bad request json: ${(e as Error).message}` });
      continue;
    }
    await handle(req);
  }
}

main().catch((e) => {
  process.stderr.write(`worker fatal: ${(e as Error).message}\n`);
  process.exit(1);
});
