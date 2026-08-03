// Outcome-baseline scorer — Iron-Law shape check on locked replies.
//
// Faithful TS port of the retired Python scorer (deleted in the py2ts
// sweep 09b554419 WITHOUT a replacement — the fixtures sat executor-less
// while two shipped artifacts still cited them as live contracts;
// road-to-tested-routing Phase 4 revives the executor). Same caps as the
// original Phase-2.3a binding: ≤ 50 LOC scoring logic, stdlib regex only,
// no AST, no model calls. Adding a 4th fixture needs the criteria in
// tests/golden/outcomes/README.md.
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const OUTCOMES_DIR = path.resolve(__dirname, "outcomes");

interface CounterSpec {
  pattern: string;
  op: "==" | "<=" | ">=";
  target: number;
}
interface Fixture {
  rule: string;
  baseline_reply: string;
  expected_patterns?: string[];
  forbidden_patterns?: string[];
  counters?: Record<string, CounterSpec>;
}

export function score(fixturePath: string): [boolean, string[]] {
  const fx = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as Fixture;
  const reply = fx.baseline_reply;
  const failures: string[] = [];
  for (const pat of fx.expected_patterns ?? []) {
    if (!new RegExp(pat, "m").test(reply)) {
      failures.push(`missing required pattern: ${JSON.stringify(pat)}`);
    }
  }
  for (const pat of fx.forbidden_patterns ?? []) {
    const m = new RegExp(pat, "m").exec(reply);
    if (m) {
      failures.push(`forbidden pattern matched at offset ${m.index}: ${JSON.stringify(pat)}`);
    }
  }
  for (const [name, spec] of Object.entries(fx.counters ?? {})) {
    const n = (reply.match(new RegExp(spec.pattern, "gm")) ?? []).length;
    const ok =
      (spec.op === "==" && n === spec.target) ||
      (spec.op === "<=" && n <= spec.target) ||
      (spec.op === ">=" && n >= spec.target);
    if (!ok) {
      failures.push(
        `counter ${JSON.stringify(name)} (${JSON.stringify(spec.pattern)}): got ${n}, expected ${spec.op} ${spec.target}`,
      );
    }
  }
  return [failures.length === 0, failures];
}

describe("outcome baselines — locked Iron-Law shape checks", () => {
  const fixtures = fs
    .readdirSync(OUTCOMES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  it("the three locked fixtures are present", () => {
    expect(fixtures).toEqual([
      "ask_when_uncertain.json",
      "direct_answers.json",
      "verify_before_complete.json",
    ]);
  });

  for (const f of fixtures) {
    it(`${f}: baseline reply satisfies its locked patterns`, () => {
      const [ok, failures] = score(path.join(OUTCOMES_DIR, f));
      expect(failures, failures.join("\n")).toEqual([]);
      expect(ok).toBe(true);
    });
  }
});
