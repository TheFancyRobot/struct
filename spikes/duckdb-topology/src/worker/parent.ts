// Topology 2: isolated child-process worker.
// The parent spawns a child running worker.ts, talks JSON over stdio, and
// recovers if the child exits before responding (crash containment).

import { spawn, type ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CancelOutcome,
  QueryResult,
  RuntimeConfig,
  Topology,
} from "../common/types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const here = dirname(fileURLToPath(import.meta.url));
const isBun = (globalThis as { Bun?: unknown }).Bun !== undefined;

export class WorkerTopology implements Topology {
  readonly name = "worker";
  readonly isolation = "process" as const;
  private child: ChildProcess | null = null;
  private config: RuntimeConfig | null = null;
  private nextId = 1;
  private pending = new Map<number, (res: WorkerResponse) => void>();
  private buffer = "";
  private crashCount = 0;

  async initialize(config: RuntimeConfig): Promise<void> {
    this.config = config;
    await this.spawnChild();
    await this.send({ id: this.next(), op: "init", args: config });
  }

  async importJSON(absPath: string, table: string): Promise<void> {
    await this.send({ id: this.next(), op: "importJSON", args: { absPath, table } });
  }

  async importCSV(absPath: string, table: string): Promise<void> {
    await this.send({ id: this.next(), op: "importCSV", args: { absPath, table } });
  }

  async exportParquet(sql: string, absPath: string): Promise<void> {
    await this.send({ id: this.next(), op: "exportParquet", args: { sql, absPath } });
  }

  async query(sql: string): Promise<QueryResult> {
    const res = await this.send({ id: this.next(), op: "query", args: { sql } });
    return res.result as QueryResult;
  }

  async cancel(): Promise<CancelOutcome> {
    const res = await this.send({ id: this.next(), op: "cancel" });
    return res.result as CancelOutcome;
  }

  async shutdown(): Promise<void> {
    if (this.child !== null && this.child.exitCode === null) {
      await this.send({ id: this.next(), op: "shutdown" }).catch(() => undefined);
    }
    this.killChild();
  }

  /** Probe hook: force the worker to crash, then recover and retry one op. */
  async crashAndRecover(retry: WorkerRequest): Promise<WorkerResponse> {
    await this.send({ id: this.next(), op: "crash" }).catch(() => undefined);
    // Wait for the child to actually exit.
    await this.waitForExit();
    this.crashCount++;
    await this.spawnChild();
    await this.send({ id: this.next(), op: "init", args: this.config! });
    return this.send(retry);
  }

  /** Number of crashes recovered so far (for probes/tests). */
  get recoveredCrashes(): number {
    return this.crashCount;
  }

  private next(): number {
    return this.nextId++;
  }

  private spawnChild(): Promise<void> {
    const workerPath = join(here, "worker.ts");
    const runner = isBun ? "bun" : "node";
    const args = isBun ? ["run", workerPath] : [workerPath];
    this.child = spawn(runner, args, {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env },
    });
    this.child.stdout?.setEncoding("utf8");
    this.child.stdout?.on("data", (chunk: string) => this.onStdout(chunk));
    this.child.on("exit", () => {
      // Reject any still-pending requests: the child died before answering.
      for (const resolve of this.pending.values()) {
        resolve({ id: -1, ok: false, error: "worker exited before responding" });
      }
      this.pending.clear();
    });
    return new Promise((resolve, reject) => {
      const onSpawn = () => resolve();
      const onError = (e: Error) => reject(new Error(`failed to spawn worker: ${e.message}`));
      this.child!.once("spawn", onSpawn);
      this.child!.once("error", onError);
    });
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (line.trim() === "") continue;
      let res: WorkerResponse;
      try {
        res = JSON.parse(line) as WorkerResponse;
      } catch {
        continue;
      }
      const resolve = this.pending.get(res.id);
      if (resolve !== undefined) {
        this.pending.delete(res.id);
        resolve(res);
      }
    }
  }

  private send(req: WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      if (this.child === null || this.child.stdin === null || this.child.exitCode !== null) {
        reject(new Error("worker not running"));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        reject(new Error(`worker timeout after ${this.config!.timeoutMs}ms (op=${req.op})`));
      }, this.config!.timeoutMs);
      this.pending.set(req.id, (res) => {
        clearTimeout(timer);
        if (res.ok) resolve(res);
        else reject(new Error(res.error ?? "worker error"));
      });
      this.child.stdin.write(`${JSON.stringify(req)}\n`);
    });
  }

  private waitForExit(): Promise<void> {
    if (this.child === null || this.child.exitCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
      this.child!.once("exit", () => resolve());
    });
  }

  private killChild(): void {
    if (this.child !== null) {
      this.child.kill("SIGKILL");
      this.child = null;
    }
  }
}
