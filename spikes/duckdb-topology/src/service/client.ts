// Topology 3: narrow local service client.
// Spawns server.ts as its own process, discovers its port from stdout, and
// issues JSON HTTP requests to 127.0.0.1. Recovers if the service process dies.

import { spawn, type ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as http from "node:http";
import type {
  CancelOutcome,
  QueryResult,
  RuntimeConfig,
  Topology,
} from "../common/types";

const here = dirname(fileURLToPath(import.meta.url));
const isBun = (globalThis as { Bun?: unknown }).Bun !== undefined;

interface ApiResponse {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

export class ServiceTopology implements Topology {
  readonly name = "service";
  readonly isolation = "service" as const;
  private child: ChildProcess | null = null;
  private port = 0;
  private config: RuntimeConfig | null = null;
  private crashCount = 0;

  async initialize(config: RuntimeConfig): Promise<void> {
    this.config = config;
    await this.spawnServer();
    await this.post("/init", config);
  }

  async importJSON(absPath: string, table: string): Promise<void> {
    await this.post("/import-json", { absPath, table });
  }

  async importCSV(absPath: string, table: string): Promise<void> {
    await this.post("/import-csv", { absPath, table });
  }

  async exportParquet(sql: string, absPath: string): Promise<void> {
    await this.post("/export-parquet", { sql, absPath });
  }

  async query(sql: string): Promise<QueryResult> {
    const res = await this.post("/query", { sql });
    return res.result as QueryResult;
  }

  async cancel(): Promise<CancelOutcome> {
    const res = await this.post("/cancel", {});
    return res.result as CancelOutcome;
  }

  async shutdown(): Promise<void> {
    if (this.child !== null && this.child.exitCode === null) {
      await this.post("/shutdown", {}).catch(() => undefined);
    }
    this.kill();
  }

  /** Probe hook: crash the service, then recover and retry one request. */
  async crashAndRecover(path: string, body: unknown): Promise<ApiResponse> {
    await this.post("/crash", {}).catch(() => undefined);
    await this.waitForExit();
    this.crashCount++;
    await this.spawnServer();
    await this.post("/init", this.config!);
    return this.post(path, body);
  }

  get recoveredCrashes(): number {
    return this.crashCount;
  }

  private async spawnServer(): Promise<void> {
    const serverPath = join(here, "server.ts");
    const runner = isBun ? "bun" : "node";
    const args = isBun ? ["run", serverPath] : [serverPath];
    this.child = spawn(runner, args, {
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env },
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("service startup timeout")),
        this.config!.timeoutMs,
      );
      const onData = (chunk: string) => {
        const m = /PORT=(\d+)/.exec(chunk);
        if (m !== null) {
          this.port = Number(m[1]);
          clearTimeout(timer);
          this.child!.stdout?.removeListener("data", onData);
          resolve();
        }
      };
      this.child!.stdout?.setEncoding("utf8");
      this.child!.stdout?.on("data", onData);
      this.child!.once("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`service spawn failed: ${e.message}`));
      });
    });
  }

  private post(path: string, body: unknown): Promise<ApiResponse> {
    return new Promise((resolve, reject) => {
      if (this.port === 0) {
        reject(new Error("service not running"));
        return;
      }
      const json = JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port: this.port,
          path,
          method: "POST",
          headers: { "content-type": "application/json", "content-length": Buffer.byteLength(json) },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as ApiResponse);
            } catch (e) {
              reject(new Error(`bad service response: ${(e as Error).message}`));
            }
          });
        },
      );
      req.on("error", (e) => reject(new Error(`service request failed: ${e.message}`)));
      req.setTimeout(this.config!.timeoutMs, () => {
        req.destroy(new Error(`service timeout after ${this.config!.timeoutMs}ms`));
      });
      req.write(json);
      req.end();
    });
  }

  private waitForExit(): Promise<void> {
    if (this.child === null || this.child.exitCode !== null) return Promise.resolve();
    return new Promise((resolve) => this.child!.once("exit", () => resolve()));
  }

  private kill(): void {
    if (this.child !== null) {
      this.child.kill("SIGKILL");
      this.child = null;
      this.port = 0;
    }
  }
}
