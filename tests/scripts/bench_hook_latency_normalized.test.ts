/**
 * Tests for the control-normalization and cap-posture helpers in
 * `src/scripts/bench_hook_latency.ts` (road-to-hook-latency-gate-noise).
 *
 * Context these assertions defend, because it is the reason the code exists:
 * the absolute `pre_tool_use` cap of 150 ms sat INSIDE its own metric's
 * measured spread — one unchanged commit read 107 / 152 / 152 / 187 ms across
 * four CI runs on 2026-08-19 — so it decided builds on runner load. The cap is
 * now advisory and the normalized excess is the instrument meant to replace it.
 *
 * The load-bearing test in this file is the LAST one: making the tight cap
 * advisory must not drop `pre_tool_use` out of the blocking gate. That is the
 * one way this change could silently remove coverage instead of relocating it.
 */
import { describe, expect, it } from "vitest";

import {
  type Budget,
  capFor,
  capsFor,
  normalizedRows,
} from "../../src/scripts/bench_hook_latency.js";

function row(event: string, p95: number) {
  return { event, runs: 50, p50_ms: p95 - 5, p95_ms: p95, max_ms: p95 + 3 };
}

const control = row("control_node_start", 100);

/** The posture this change ships: tight cap advisory, shared cap blocking. */
const budget: Budget = {
  budgets_ms: {
    pre_tool_use: { p95_ci: 150, blocking: false },
    any_hook_event: { p95_ci: 250, blocking: true },
  },
  regression_gate: { max_regression_pct: 200 },
};

/** A config predating the posture split — neither entry carries `blocking`. */
const legacyBudget: Budget = {
  budgets_ms: {
    pre_tool_use: { p95_ci: 150 },
    any_hook_event: { p95_ci: 250 },
  },
  regression_gate: { max_regression_pct: 200 },
};

describe("normalizedRows", () => {
  it("reports the excess over the same run's control, not the raw reading", () => {
    const rows = normalizedRows([row("pre_tool_use", 152)], control);
    expect(rows[0]?.excess_ms).toBe(52);
  });

  it("keeps a loaded runner's excess stable while the raw reading moves", () => {
    // The 2026-08-19 pair: 107 ms on a quiet runner, 152 ms on a loaded one.
    // If the control moves with the runner, the excess is what stays put —
    // that invariance is the entire argument for gating on it later.
    const quiet = normalizedRows([row("pre_tool_use", 107)], row("c", 55));
    const loaded = normalizedRows([row("pre_tool_use", 152)], row("c", 100));
    expect(quiet[0]?.excess_ms).toBe(52);
    expect(loaded[0]?.excess_ms).toBe(52);
    // …while the raw p95 the old gate read differs by 45 ms across the two.
    expect((loaded[0] as { p95_ms: number }).p95_ms - (quiet[0] as { p95_ms: number }).p95_ms).toBe(45);
  });

  it("reports the ratio alongside, rounded to two decimals", () => {
    expect(normalizedRows([row("pre_tool_use", 150)], control)[0]?.ratio).toBe(1.5);
  });

  it("never divides by a zero control", () => {
    const rows = normalizedRows([row("pre_tool_use", 120)], row("c", 0));
    expect(rows[0]?.ratio).toBe(0);
    expect(Number.isFinite(rows[0]?.ratio as number)).toBe(true);
  });

  it("carries every measured slot through, so no slot silently loses its row", () => {
    const rows = normalizedRows(
      [row("pre_tool_use", 120), row("stop", 190), row("session_end", 95)],
      control,
    );
    expect(rows.map((r) => r.event)).toEqual([
      "pre_tool_use",
      "stop",
      "session_end",
    ]);
  });
});

describe("capsFor", () => {
  it("applies only the shared cap to an ordinary slot", () => {
    expect(capsFor(budget, "stop")).toEqual([
      { name: "any_hook_event", cap_ms: 250, blocking: true },
    ]);
  });

  it("returns caps tightest-first so capFor can take the head", () => {
    expect(capsFor(budget, "pre_tool_use").map((c) => c.cap_ms)).toEqual([150, 250]);
    expect(capFor(budget, "pre_tool_use")).toBe(150);
  });

  it("treats a config without `blocking` as blocking, not as advisory", () => {
    // Fail-closed on an older or hand-edited budget file: the absent-key
    // default must never be the permissive one.
    expect(capsFor(legacyBudget, "pre_tool_use").every((c) => c.blocking)).toBe(true);
    expect(capsFor(legacyBudget, "stop")[0]?.blocking).toBe(true);
  });

  it("honours the advisory downgrade on the slot-specific cap", () => {
    const specific = capsFor(budget, "pre_tool_use").find(
      (c) => c.name === "pre_tool_use",
    );
    expect(specific?.blocking).toBe(false);
  });

  it("STILL covers pre_tool_use with a blocking cap once the tight one is advisory", () => {
    // The regression this change could plausibly introduce: relocating the
    // tight cap's enforcement must not leave the slot ungated. A reading that
    // clears the advisory 150 but breaches the blocking 250 must still fail.
    const applied = capsFor(budget, "pre_tool_use");
    expect(applied.some((c) => c.blocking)).toBe(true);

    const blocking = applied.filter((c) => c.blocking);
    const catastrophic = 1600; // the 9.8.0 pre-optimization p50
    expect(blocking.some((c) => catastrophic > c.cap_ms)).toBe(true);
  });
});
