// Real shared types and contracts for the DuckDB topology spike.
// No fabricated imports: only types that genuinely exist in @duckdb/node-api.

/**
 * Isolation level of a topology candidate.
 * - "none"    : DuckDB runs in the controller process (direct).
 * - "process" : DuckDB runs in a forked child process (isolated worker).
 * - "service" : DuckDB runs behind a narrow localhost HTTP service.
 */
export type IsolationLevel = "none" | "process" | "service";

/**
 * Hardened runtime configuration proven against DuckDB 1.5.4-r.1.
 *
 * The security model (verified by probes) is:
 *   1. create the instance with external access ON (default) and community/
 *      unsigned extensions blocked at create time;
 *   2. `SET allowed_directories=['<rootDir>']` to carve out the allowlist;
 *   3. `SET enable_external_access=false` to lock everything except the carve-out.
 *
 * After step 3, local read_json_auto / read_csv_auto / COPY TO / read_parquet
 * inside rootDir work, while reads of arbitrary paths (e.g. /etc/passwd),
 * ATTACH, INSTALL, and writes outside rootDir are DENIED at the FS layer.
 */
export interface RuntimeConfig {
  /** Absolute path of the sandbox root. All data/temp/parquet live under here. */
  readonly rootDir: string;
  /** Memory limit forwarded to DuckDB (e.g. "256MB"). */
  readonly memoryLimit: string;
  /** Worker thread count forwarded to DuckDB (e.g. "1"). */
  readonly threads: string;
  /** Hard wall-clock timeout in ms for a single query/operation. */
  readonly timeoutMs: number;
  /** Maximum rows a bounded read-only query may return. */
  readonly maxRows: number;
  /** Maximum bytes a single Parquet/output artifact may occupy. */
  readonly maxOutputBytes: number;
}

/** Result of a bounded read-only query through a topology. */
export interface QueryResult {
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly rowCount: number;
  readonly truncated: boolean;
  /** sha256 of the canonical JSON of rows (deterministic). */
  readonly rowsHash: string;
}

/** Measurement of one operation against one topology. */
export interface Measurement {
  readonly topology: string;
  readonly operation: string;
  readonly durationMs: number;
  readonly peakRssBytes: number;
  readonly ok: boolean;
  readonly detail: string;
}

/** Terminal, typed outcome of a cancellation attempt. */
export type CancelOutcome =
  | { readonly kind: "cancelled"; readonly latencyMs: number }
  | { readonly kind: "completed"; readonly latencyMs: number; readonly rowCount: number }
  | { readonly kind: "timeout"; readonly latencyMs: number };

/** Result of a security rejection probe. */
export interface SecurityProbeResult {
  readonly name: string;
  readonly denied: boolean;
  readonly message: string;
}

/** The contract every topology candidate implements. */
export interface Topology {
  readonly name: string;
  readonly isolation: IsolationLevel;
  initialize(config: RuntimeConfig): Promise<void>;
  importJSON(absPath: string, table: string): Promise<void>;
  importCSV(absPath: string, table: string): Promise<void>;
  exportParquet(sql: string, absPath: string): Promise<void>;
  query(sql: string): Promise<QueryResult>;
  cancel(): Promise<CancelOutcome>;
  shutdown(): Promise<void>;
}
