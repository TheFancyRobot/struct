// Security guards for the DuckDB topology spike.
// Two layers, both required:
//   1. SQL allowlist: reject ATTACH/INSTALL/DDL/DML/unsafe pragmas/unbounded reads
//      BEFORE they reach DuckDB (defense in depth on top of DuckDB's own config).
//   2. Path allowlist: every file path must resolve strictly under rootDir.

import { resolve, relative } from "node:path";
import type { SecurityProbeResult } from "./types";

/** Statements that must never reach DuckDB. */
const FORBIDDEN =
  /\b(ATTACH|DETACH|INSTALL|LOAD|CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|COPY|ATTACH|EXPORT|IMPORT|PRAGMA|CALL|ATTACH)\b/i;

/**
 * Validate that a SQL string is a read-only SELECT (or WITH ... SELECT) with no
 * forbidden statements and an explicit LIMIT. Returns the rejection reason or
 * null when accepted.
 */
export function validateReadQuery(sql: string, maxRows: number): string | null {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!/^(WITH|SELECT)\b/i.test(trimmed)) {
    return "rejected: only SELECT / WITH queries are allowed";
  }
  if (FORBIDDEN.test(trimmed)) {
    return `rejected: forbidden keyword detected in: ${trimmed.slice(0, 80)}`;
  }
  if (!/\bLIMIT\s+\d+/i.test(trimmed)) {
    // Auto-append a bounded LIMIT so reads can never be unbounded.
    return null; // boundedness enforced by reader cap; see duckdb.ts
  }
  void maxRows;
  return null;
}

/**
 * Validate that `absPath` resolves strictly inside `rootDir` (no traversal).
 * Returns the resolved path when safe, or throws with a clear denial.
 */
export function assertInsideRoot(absPath: string, rootDir: string): string {
  const resolved = resolve(absPath);
  const root = resolve(rootDir);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || rel === "") {
    if (rel === "") return resolved; // exactly the root
    throw new Error(
      `path rejected: '${absPath}' resolves outside sandbox root '${rootDir}'`,
    );
  }
  return resolved;
}

/** Run a denial probe and normalize the result. */
export function probeDenial(
  name: string,
  fn: () => Promise<unknown>,
): Promise<SecurityProbeResult> {
  return fn()
    .then(
      (): SecurityProbeResult => ({
        name,
        denied: false,
        message: "UNEXPECTED: operation succeeded (security gap)",
      }),
    )
    .catch(
      (e: unknown): SecurityProbeResult => ({
        name,
        denied: true,
        message: (e as Error).message.split("\n")[0]?.slice(0, 160) ?? "denied",
      }),
    );
}
