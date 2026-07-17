// Real DuckDB core for the spike, grounded in verified 1.5.4-r.1 behavior.
//
// Proven hardening sequence (see probes): create with community/unsigned
// extensions blocked and external access ON; SET allowed_directories to the
// sandbox root; then SET enable_external_access=false. After this, local
// JSON/CSV/Parquet I/O under the root works while arbitrary paths, ATTACH,
// INSTALL and writes outside the root are DENIED at the FS layer.

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { mkdirSync, existsSync, renameSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { QueryResult, RuntimeConfig } from "./types";
import { assertInsideRoot, validateReadQuery } from "./security";
import { canonicalRowsJson } from "./fixtures";

/** Create a hardened DuckDB connection following the proven sequence. */
export async function createHardenedConnection(
  config: RuntimeConfig,
): Promise<{ conn: DuckDBConnection; close: () => void }> {
  const root = resolve(config.rootDir);
  mkdirSync(join(root, "tmp"), { recursive: true });
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "parquet"), { recursive: true });

  // Step 1: create with extensions blocked; external access stays ON so we can
  // set the allowlist next.
  const instance = await DuckDBInstance.create(":memory:", {
    memory_limit: config.memoryLimit,
    threads: config.threads,
    temp_directory: join(root, "tmp"),
    allow_community_extensions: "false",
    allow_unsigned_extensions: "false",
  });
  const conn = await instance.connect();

  // Step 2: carve out the sandbox root as the only allowed directory.
  await conn.run(`SET allowed_directories=['${root.replace(/'/g, "''")}']`);
  // Step 3: lock down everything except the carve-out.
  await conn.run("SET enable_external_access=false");

  const close = () => {
    conn.disconnectSync();
    instance.closeSync();
  };
  return { conn, close };
}

/** Import a JSON file into a table via real read_json_auto. */
export async function importJSONFile(
  conn: DuckDBConnection,
  absPath: string,
  table: string,
  rootDir: string,
): Promise<void> {
  const safe = assertInsideRoot(absPath, rootDir);
  await conn.run(
    `CREATE TABLE ${table} AS SELECT * FROM read_json_auto('${safe.replace(/'/g, "''")}')`,
  );
}

/** Import a CSV file into a table via real read_csv_auto. */
export async function importCSVFile(
  conn: DuckDBConnection,
  absPath: string,
  table: string,
  rootDir: string,
): Promise<void> {
  const safe = assertInsideRoot(absPath, rootDir);
  await conn.run(
    `CREATE TABLE ${table} AS SELECT * FROM read_csv_auto('${safe.replace(/'/g, "''")}')`,
  );
}

/**
 * Write Parquet through a temporary path then atomically promote, so no
 * partial file is ever accepted as a complete dataset snapshot.
 */
export async function exportParquetAtomic(
  conn: DuckDBConnection,
  sql: string,
  absPath: string,
  rootDir: string,
  maxOutputBytes: number,
): Promise<void> {
  const dest = assertInsideRoot(absPath, rootDir);
  const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
  await conn.run(`COPY (${sql}) TO '${tmp.replace(/'/g, "''")}' (FORMAT PARQUET)`);
  const st = statSync(tmp);
  if (st.size > maxOutputBytes) {
    rmSync(tmp, { force: true });
    throw new Error(
      `output rejected: ${st.size} bytes exceeds cap ${maxOutputBytes}`,
    );
  }
  // Atomic promote: rename is atomic on the same filesystem.
  renameSync(tmp, dest);
}

/** Normalize a DuckDB JS value: BigInt -> Number (safe for JSON + hashing). */
function normalizeValue(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = normalizeValue(val);
    return out;
  }
  return v;
}

/** Read a Parquet file back via real read_parquet. */
export async function readParquet(
  conn: DuckDBConnection,
  absPath: string,
  rootDir: string,
): Promise<QueryResult> {
  const safe = assertInsideRoot(absPath, rootDir);
  const reader = await conn.runAndReadAll(
    `SELECT * FROM read_parquet('${safe.replace(/'/g, "''")}')`,
  );
  await reader.readAll();
  return readerToResult(reader);
}

/**
 * Run a bounded read-only query. The SQL is validated first, and the result is
 * hard-capped at maxRows; truncation is reported honestly.
 */
export async function boundedQuery(
  conn: DuckDBConnection,
  sql: string,
  maxRows: number,
): Promise<QueryResult> {
  const rejection = validateReadQuery(sql, maxRows);
  if (rejection !== null) throw new Error(rejection);
  const reader = await conn.runAndReadAll(sql);
  await reader.readAll();
  const all = (reader.getRowObjectsJS() as Readonly<Record<string, unknown>>[]).map(
    (r) => normalizeValue(r) as Readonly<Record<string, unknown>>,
  );
  const columns = reader.columnNames();
  const truncated = all.length > maxRows;
  const rows = truncated ? all.slice(0, maxRows) : all;
  const rowsHash = createHash("sha256")
    .update(canonicalRowsJson(rows))
    .digest("hex");
  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
    rowsHash,
  };
}

/** Cooperative cancellation: interrupt the connection's running query. */
export function interruptConnection(conn: DuckDBConnection): void {
  conn.interrupt();
}

/** Convert a materialized reader into a QueryResult with a stable hash. */
function readerToResult(
  reader: import("@duckdb/node-api").DuckDBResultReader,
): QueryResult {
  const all = (reader.getRowObjectsJS() as Readonly<Record<string, unknown>>[]).map(
    (r) => normalizeValue(r) as Readonly<Record<string, unknown>>,
  );
  const columns = reader.columnNames();
  const rowsHash = createHash("sha256")
    .update(canonicalRowsJson(all))
    .digest("hex");
  return { columns, rows: all, rowCount: all.length, truncated: false, rowsHash };
}

/** True when a file exists (used by cleanup verification). */
export function fileExists(p: string): boolean {
  return existsSync(p);
}
