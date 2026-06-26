/**
 * Tests for the on-demand rule-load latency bench's pure helpers
 * (`src/scripts/bench_rule_load_latency.ts`).
 */
import { describe, expect, it } from "vitest";

import {
  on_demand_rule_ids,
  percentile,
  summarize,
} from "../../src/scripts/bench_rule_load_latency.js";

describe("on_demand_rule_ids", () => {
  it("excludes kernel; includes tier_1 + tier_2 (strings + objects)", () => {
    const ids = on_demand_rule_ids({
      kernel: ["k1", "k2"],
      tier_1: [{ id: "t1a", triggers: [] }, { id: "t1b" }],
      tier_2: ["t2a", { id: "t2b" }],
    });
    expect(ids).toEqual(["t1a", "t1b", "t2a", "t2b"]);
    expect(ids).not.toContain("k1");
  });

  it("tolerates missing tiers", () => {
    expect(on_demand_rule_ids({ kernel: ["k"] })).toEqual([]);
  });
});

describe("percentile (nearest-rank)", () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it("p50 / p95 / p99 / p100 by nearest rank", () => {
    expect(percentile(sorted, 50)).toBe(5); // ceil(0.5*10)=5 → idx 4
    expect(percentile(sorted, 95)).toBe(10); // ceil(9.5)=10 → idx 9
    expect(percentile(sorted, 99)).toBe(10);
    expect(percentile(sorted, 100)).toBe(10);
  });
  it("empty sample → 0", () => {
    expect(percentile([], 95)).toBe(0);
  });
});

describe("summarize", () => {
  it("computes count/mean/min/max/percentiles", () => {
    const s = summarize([4, 2, 8, 6, 10]);
    expect(s.count).toBe(5);
    expect(s.min_ms).toBe(2);
    expect(s.max_ms).toBe(10);
    expect(s.mean_ms).toBe(6); // (4+2+8+6+10)/5
    expect(s.p50_ms).toBe(6); // sorted [2,4,6,8,10], ceil(2.5)=3 → idx 2 = 6
  });
  it("empty → all zero", () => {
    expect(summarize([])).toMatchObject({ count: 0, p99_ms: 0 });
  });
});
