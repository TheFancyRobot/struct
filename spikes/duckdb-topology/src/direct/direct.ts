// Topology 1: direct in-process DuckDB access.
// DuckDB runs in the controller process. Cancellation uses conn.interrupt().

import type { DuckDBConnection } from "@duckdb/node-api";
import type {
  CancelOutcome,
  QueryResult,
  RuntimeConfig,
  Topology,
} from "../common/types";
import {
  boundedQuery,
  createHardenedConnection,
  exportParquetAtomic,
  importCSVFile,
  importJSONFile,
  interruptConnection,
} from "../common/duckdb";

export class DirectTopology implements Topology {
  readonly name = "direct";
  readonly isolation = "none" as const;
  private conn: DuckDBConnection | null = null;
  private close: (() => void) | null = null;
  private config: RuntimeConfig | null = null;
  private activeQuery: Promise<QueryResult> | null = null;

  async initialize(config: RuntimeConfig): Promise<void> {
    this.config = config;
    const { conn, close } = await createHardenedConnection(config);
    this.conn = conn;
    this.close = close;
  }

  async importJSON(absPath: string, table: string): Promise<void> {
    this.requireReady();
    await importJSONFile(this.conn!, absPath, table, this.config!.rootDir);
  }

  async importCSV(absPath: string, table: string): Promise<void> {
    this.requireReady();
    await importCSVFile(this.conn!, absPath, table, this.config!.rootDir);
  }

  async exportParquet(sql: string, absPath: string): Promise<void> {
    this.requireReady();
    await exportParquetAtomic(
      this.conn!,
      sql,
      absPath,
      this.config!.rootDir,
      this.config!.maxOutputBytes,
    );
  }

  async query(sql: string): Promise<QueryResult> {
    this.requireReady();
    this.activeQuery = boundedQuery(this.conn!, sql, this.config!.maxRows);
    // Enforce a wall-clock timeout; direct in-process scans cannot be safely
    // interrupted without interrupt(), so we race the timeout against the query.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`query timeout after ${this.config!.timeoutMs}ms`)),
        this.config!.timeoutMs,
      ),
    );
    try {
      return await Promise.race([this.activeQuery, timeout]);
    } catch (e) {
      // On timeout, interrupt the orphaned native scan and drain it so the
      // native thread fully terminates before a later close()/shutdown(); an
      // undrained in-flight query would SIGKILL the process on teardown.
      interruptConnection(this.conn!);
      try {
        await this.activeQuery;
      } catch {
        // interrupted or already rejected - expected
      }
      throw e;
    } finally {
      this.activeQuery = null;
    }
  }

  async cancel(): Promise<CancelOutcome> {
    if (this.conn === null) return { kind: "completed", latencyMs: 0, rowCount: 0 };
    const started = Date.now();
    interruptConnection(this.conn);
    return { kind: "cancelled", latencyMs: Date.now() - started };
  }

  async shutdown(): Promise<void> {
    this.close?.();
    this.conn = null;
    this.close = null;
  }

  private requireReady(): void {
    if (this.conn === null || this.config === null) {
      throw new Error("direct topology not initialized");
    }
  }
}
