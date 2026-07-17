// JSON-over-stdio IPC protocol shared by the worker child and its parent.

export type WorkerOp =
  | "init"
  | "importJSON"
  | "importCSV"
  | "exportParquet"
  | "query"
  | "cancel"
  | "shutdown"
  | "crash"; // probe-only: force the worker process to exit non-zero

/** Parent -> child request. */
export interface WorkerRequest {
  readonly id: number;
  readonly op: WorkerOp;
  readonly args?: unknown;
}

/** Child -> parent response. */
export interface WorkerResponse {
  readonly id: number;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

/** Serialize a value as a single JSON line. */
export function encode(value: unknown): string {
  return JSON.stringify(value);
}

/** Parse a single JSON line. Returns null on empty input. */
export function decode(line: string): unknown | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;
  return JSON.parse(trimmed);
}
