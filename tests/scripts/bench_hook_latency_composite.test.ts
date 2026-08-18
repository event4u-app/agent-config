/**
 * Tests for the per-turn composite helper in
 * `src/scripts/bench_hook_latency.ts` (road-to-per-turn-hook-economy step 4.1).
 *
 * The composite is the D-1 row: the number one agentic turn costs, which no
 * per-slot budget can represent. Two properties matter and both are asserted
 * here rather than left to the bench's own green run:
 *
 *  - the arithmetic follows the budget file's `definition` exactly, including
 *    `tool_calls` coming from the file rather than from a constant;
 *  - a partial run returns null instead of a number, because a composite
 *    computed over a subset of the slots reads LOW, which is the direction that
 *    makes a ceiling look met when it is not.
 */
import { describe, expect, it } from "vitest";

import { perTurnComposite } from "../../src/scripts/bench_hook_latency.js";

function row(event: string, p50: number) {
  return { event, runs: 5, p50_ms: p50, p95_ms: p50, max_ms: p50 };
}

const full = [
  row("pre_tool_use", 80),
  row("post_tool_use", 90),
  row("user_prompt_submit", 70),
  row("stop", 120),
  row("session_start", 85),
  row("session_end", 75),
];

function without(event: string) {
  return full.filter((r) => r.event !== event);
}

describe("perTurnComposite", () => {
  it("applies (pre + post) * tool_calls + ups + stop", () => {
    expect(perTurnComposite(full, 10)?.ms).toBe(1890);
  });

  it("reads tool_calls from its argument, not a hardcoded 10", () => {
    expect(perTurnComposite(full, 3)?.ms).toBe(700);
  });

  it("reports the parts it summed, so a printed composite is auditable", () => {
    expect(perTurnComposite(full, 10)?.parts).toEqual({
      pre_tool_use: 80,
      post_tool_use: 90,
      user_prompt_submit: 70,
      stop: 120,
    });
  });

  it("ignores slots the definition does not name", () => {
    const trimmed = full.filter(
      (r) => r.event !== "session_start" && r.event !== "session_end",
    );
    expect(perTurnComposite(trimmed, 10)?.ms).toBe(perTurnComposite(full, 10)?.ms);
  });

  it("returns null when pre_tool_use is absent, never a low number", () => {
    expect(perTurnComposite(without("pre_tool_use"), 10)).toBeNull();
  });

  it("returns null when post_tool_use is absent, never a low number", () => {
    expect(perTurnComposite(without("post_tool_use"), 10)).toBeNull();
  });

  it("returns null when user_prompt_submit is absent, never a low number", () => {
    expect(perTurnComposite(without("user_prompt_submit"), 10)).toBeNull();
  });

  it("returns null when stop is absent, never a low number", () => {
    expect(perTurnComposite(without("stop"), 10)).toBeNull();
  });

  it("returns null on an empty run", () => {
    expect(perTurnComposite([], 10)).toBeNull();
  });
});
