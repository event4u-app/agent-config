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
    // Halted before the judge loop → no per-pair "judged …" line on stdout.
    expect(r.stdout).not.toMatch(/judged /);
  });
});
