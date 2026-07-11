import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SCRIPT = join(ROOT, "src", "scripts", "bench_humanizer_eval.ts");

function run(args: string[]) {
  return spawnSync("npx", ["tsx", SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
}

/**
 * Phase 3 spend gate: `--judge` fires billable API calls, so it must halt
 * (exit 2) with an estimate unless `--confirm-spend` authorizes it — never an
 * implicit spend. Verified without a network round-trip: the gate returns
 * before the judge loop.
 */
describe("bench_humanizer_eval spend gate", () => {
  it("--judge without --confirm-spend halts (exit 2) and estimates, no network call", () => {
    const r = run(["--judge"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/billable API call/i);
    expect(r.stderr).toMatch(/--confirm-spend/);
    // Structural "no network" proof: the gate returns via process.exit(2)
    // BEFORE the judge loop and BEFORE any report is emitted. The API client
    // is only constructed inside judgePair(), which the loop never reaches —
    // so absence of both the per-pair "judged …" line AND the report header
    // means no billable call could have fired.
    expect(r.stdout).not.toMatch(/judged /);
    expect(r.stdout).not.toMatch(/Humanizer paired eval/);
    expect((r.stdout ?? "").trim()).toBe("");
  });
});
