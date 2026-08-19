// Per-turn injection aggregate (road-to-standing-context-40k Phase 4 step 4.1).
//
// The load-bearing case is the UNRESOLVED one: a composite derived over a subset
// of its counted slots reads LOW, and low is the direction that makes a ceiling
// look met. The latency twin's `perTurnComposite` returns null for exactly this
// reason; this asserts the injection half behaves the same way.
import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { perTurnAggregate } from "../../src/scripts/bench_hook_injection.js";

const CONFIG = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "config",
  "hook-token-budget.json",
);

const cfg = {
  tool_calls: 10,
  slots_counted: ["user_prompt_submit", "pre_tool_use", "post_tool_use", "stop"],
  ceiling_bytes: 47104,
  gate_on_ceiling: false,
};

function sums(over: Record<string, number>): Record<string, { bytes: number }> {
  const base: Record<string, number> = {
    user_prompt_submit: 0,
    pre_tool_use: 0,
    post_tool_use: 0,
    stop: 0,
  };
  const merged = { ...base, ...over };
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, { bytes: v }]),
  );
}

describe("perTurnAggregate", () => {
  it("returns null when the budget carries no row", () => {
    expect(perTurnAggregate(sums({}), undefined)).toBeNull();
  });

  it("multiplies the per-call slots by tool_calls and adds the once-per-turn ones", () => {
    const agg = perTurnAggregate(
      sums({ user_prompt_submit: 900, pre_tool_use: 100, post_tool_use: 50, stop: 200 }),
      cfg,
    );
    // 900 + (100 + 50) * 10 + 200
    expect(agg?.bytes).toBe(2600);
  });

  it("does not multiply user_prompt_submit or stop", () => {
    const agg = perTurnAggregate(sums({ user_prompt_submit: 1000, stop: 1000 }), cfg);
    expect(agg?.bytes).toBe(2000);
  });

  it("reads UNRESOLVED, not a low number, when a counted slot produced nothing", () => {
    const partial: Record<string, { bytes: number }> = {
      user_prompt_submit: { bytes: 900 },
      pre_tool_use: { bytes: 100 },
      stop: { bytes: 200 },
      // post_tool_use absent — the slot never ran.
    };
    const agg = perTurnAggregate(partial, cfg);
    expect(agg?.bytes).toBeNull();
    expect(agg?.unresolved).toBe("post_tool_use");
    // Unarmed: nothing to breach, because the row is not gating yet.
    expect(agg?.breach).toBe(false);
  });

  // The R2 review found the previous version of this pinned a false green: with
  // the row ARMED, an unresolved composite returned breach:false, so the gate
  // would have exited 0 over a measurement that does not exist — the exact
  // direction the module header calls load-bearing.
  it("an UNRESOLVED composite BREACHES once the row is armed", () => {
    const armed = { ...cfg, gate_on_ceiling: true };
    const agg = perTurnAggregate({ user_prompt_submit: { bytes: 10 } }, armed);
    expect(agg?.bytes).toBeNull();
    expect(agg?.breach).toBe(true);
  });

  it("treats a slot marked unresolved by the bench as unresolved, not as its partial sum", () => {
    const armed = { ...cfg, gate_on_ceiling: true };
    const agg = perTurnAggregate(
      {
        user_prompt_submit: { bytes: 900 },
        pre_tool_use: { bytes: 0, unresolved: true },
        post_tool_use: { bytes: 50 },
        stop: { bytes: 200 },
      },
      armed,
    );
    expect(agg?.bytes).toBeNull();
    expect(agg?.unresolved).toBe("pre_tool_use");
    expect(agg?.breach).toBe(true);
  });

  it("does not breach while the row is unarmed, even over the ceiling", () => {
    const agg = perTurnAggregate(sums({ user_prompt_submit: 999_999 }), cfg);
    expect(agg?.bytes).toBe(999_999);
    expect(agg?.gated).toBe(false);
    expect(agg?.breach).toBe(false);
  });

  it("breaches once the row is armed and the reading is over", () => {
    const armed = { ...cfg, gate_on_ceiling: true };
    expect(perTurnAggregate(sums({ user_prompt_submit: 999_999 }), armed)?.breach).toBe(true);
    expect(perTurnAggregate(sums({ user_prompt_submit: 100 }), armed)?.breach).toBe(false);
  });
});

describe("the committed row", () => {
  const row = (
    JSON.parse(fs.readFileSync(CONFIG, "utf-8")) as {
      per_turn_aggregate_bytes?: Record<string, unknown>;
      per_slot_sum_caps_bytes: Record<string, number | string>;
    }
  );

  it("exists and carries an owner and a review date", () => {
    const r = row.per_turn_aggregate_bytes;
    expect(r).toBeDefined();
    expect(r?.["owner"]).toBeTypeOf("string");
    expect(r?.["review_by"]).toBeTypeOf("string");
  });

  it("excludes session_start by name — the step's own carve-out", () => {
    expect(row.per_turn_aggregate_bytes?.["excluded_slots"]).toContain("session_start");
  });

  it("derives its ceiling from the per-slot rows rather than inventing a number", () => {
    const slot = (k: string): number => {
      const v = row.per_slot_sum_caps_bytes[k];
      return typeof v === "number" ? v : 0;
    };
    const r = row.per_turn_aggregate_bytes as { tool_calls: number; ceiling_bytes: number };
    const derived =
      slot("user_prompt_submit") +
      (slot("pre_tool_use") + slot("post_tool_use")) * r.tool_calls +
      slot("stop");
    expect(r.ceiling_bytes).toBe(derived);
  });

  it("shares its tool_calls definition with the latency twin", () => {
    const latency = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "..", "..", "src", "config", "hook-latency-budget.json"),
        "utf-8",
      ),
    ) as { per_turn_composite?: { tool_calls?: number } };
    // Asserted, not skipped. A conditional `return` here made the test pass
    // silently if the twin row disappeared — which is the exact drift it exists
    // to catch, turned into a green run. (R2 review, 2026-08-19.)
    const twin = latency.per_turn_composite?.tool_calls;
    expect(twin).toBeTypeOf("number");
    expect(row.per_turn_aggregate_bytes?.["tool_calls"]).toBe(twin);
  });
});
