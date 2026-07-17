// Narrow local service entrypoint. Runs a hardened DuckDB behind a localhost
// HTTP server bound to 127.0.0.1 only. Prints the chosen port on stdout as
// `PORT=<n>` so the parent/client can connect.
//
// Run as its own process: `bun run src/service/server.ts`.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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

let conn: DuckDBConnection | null = null;
let close: (() => void) | null = null;
let config: RuntimeConfig | null = null;

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(json);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const raw = await readBody(req);
    const args = raw.trim() === "" ? {} : JSON.parse(raw);

    switch (path) {
      case "/init": {
        config = args as unknown as RuntimeConfig;
        const made = await createHardenedConnection(config);
        conn = made.conn;
        close = made.close;
        send(res, 200, { ok: true });
        return;
      }
      case "/import-json": {
        const a = args as { absPath: string; table: string };
        await importJSONFile(conn!, a.absPath, a.table, config!.rootDir);
        send(res, 200, { ok: true });
        return;
      }
      case "/import-csv": {
        const a = args as { absPath: string; table: string };
        await importCSVFile(conn!, a.absPath, a.table, config!.rootDir);
        send(res, 200, { ok: true });
        return;
      }
      case "/export-parquet": {
        const a = args as { sql: string; absPath: string };
        await exportParquetAtomic(conn!, a.sql, a.absPath, config!.rootDir, config!.maxOutputBytes);
        send(res, 200, { ok: true });
        return;
      }
      case "/query": {
        const a = args as { sql: string };
        const result = await boundedQuery(conn!, a.sql, config!.maxRows);
        send(res, 200, { ok: true, result });
        return;
      }
      case "/cancel": {
        const started = Date.now();
        if (conn !== null) interruptConnection(conn);
        send(res, 200, { ok: true, result: { kind: "cancelled", latencyMs: Date.now() - started } });
        return;
      }
      case "/shutdown": {
        send(res, 200, { ok: true });
        close?.();
        server.close();
        process.exit(0);
      }
      case "/crash": {
        send(res, 200, { ok: true });
        process.exit(137);
      }
      default:
        send(res, 404, { ok: false, error: `unknown path: ${path}` });
    }
  } catch (e) {
    send(res, 500, { ok: false, error: (e as Error).message });
  }
});

server.listen(0, "127.0.0.1", () => {
  const addr = server.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;
  process.stdout.write(`PORT=${port}\n`);
});

process.on("SIGTERM", () => {
  close?.();
  server.close();
  process.exit(0);
});
