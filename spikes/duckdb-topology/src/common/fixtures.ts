// DETERMINISTIC test fixtures for the DuckDB topology spike.
// Uses a seeded mulberry32 PRNG (NOT Math.random) so every run is reproducible
// and result hashes are stable across machines and runs.

import { createHash } from "node:crypto";

/** A row of the smoke fixture. */
export interface SmokeRow {
  readonly id: number;
  readonly name: string;
  readonly age: number;
  readonly department: string;
  readonly amount: number;
}

/** A row of the scale fixture. */
export interface ScaleRow {
  readonly id: number;
  readonly name: string;
  readonly age: number;
  readonly department: string;
  readonly salary: number;
  readonly hireDate: string;
  readonly active: boolean;
}

/** Seeded PRNG (mulberry32): deterministic given the same seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEPTS = ["Engineering", "Marketing", "Sales", "HR", "Finance"] as const;

/** Small (5-row) smoke fixture, fully deterministic. */
export function smokeRows(): readonly SmokeRow[] {
  return [
    { id: 1, name: "Alice", age: 30, department: "Engineering", amount: 100.5 },
    { id: 2, name: "Bob", age: 25, department: "Marketing", amount: 50.25 },
    { id: 3, name: "Cara", age: 35, department: "Engineering", amount: 200.0 },
    { id: 4, name: "Dan", age: 28, department: "Sales", amount: 75.0 },
    { id: 5, name: "Eve", age: 32, department: "HR", amount: 42.5 },
  ];
}

/**
 * Scale fixture (~25,000 rows) generated deterministically from `seed`.
 * The same seed always yields the same rows in the same order.
 */
export function scaleRows(count: number = 25000, seed: number = 0x5eed): readonly ScaleRow[] {
  const rand = mulberry32(seed);
  const rows: ScaleRow[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const dept = DEPTS[Math.floor(rand() * DEPTS.length)] ?? "Engineering";
    const month = String(Math.floor(rand() * 12) + 1).padStart(2, "0");
    const day = String(Math.floor(rand() * 28) + 1).padStart(2, "0");
    rows[i] = {
      id: i,
      name: `User${i % 1000}`,
      age: Math.floor(rand() * 50) + 20,
      department: dept,
      salary: Math.floor(rand() * 100000) + 40000,
      hireDate: `2020-${month}-${day}`,
      active: rand() > 0.1,
    };
  }
  return rows;
}

/** Deterministic sha256 over the canonical JSON of a value (BigInt-safe). */
export function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value, bigIntReplacer)).digest("hex");
}

/** BigInt-safe JSON replacer: serializes BigInt as a plain number string. */
function bigIntReplacer(_k: string, v: unknown): unknown {
  return typeof v === "bigint" ? Number(v) : v;
}

/** Canonical JSON for a set of rows, sorted by id for stable comparison. */
export function canonicalRowsJson(rows: readonly Readonly<Record<string, unknown>>[]): string {
  const sorted = [...rows].sort((a, b) => {
    const ai = a["id"];
    const bi = b["id"];
    const an = typeof ai === "number" ? ai : -1;
    const bn = typeof bi === "number" ? bi : -1;
    return an - bn;
  });
  return JSON.stringify(sorted, bigIntReplacer);
}
