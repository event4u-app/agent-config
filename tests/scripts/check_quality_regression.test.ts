/**
 * Tests for the length-controlled paired judge + quality-regression gate
 * (`src/scripts/check_quality_regression.ts`). The judge is mocked so the
 * bias-control + aggregation logic is verified deterministically (no live API).
 */
import { describe, expect, it } from "vitest";

import {
  aggregate,
  evaluatePair,
  gateVerdict,
  type JudgeFn,
  type PairResult,
} from "../../src/scripts/check_quality_regression.js";

const task = { id: "tq-x-01", rubric: "r" };

// Mock judges
const pickThin: JudgeFn = (_c, first) => (first === "THIN" ? "first" : "second");
const pickEager: JudgeFn = (_c, first) => (first === "EAGER" ? "first" : "second");
const alwaysFirst: JudgeFn = () => "first"; // pure position bias
const alwaysTie: JudgeFn = () => "tie";
const preferLonger: JudgeFn = (_c, first, second) => (first.length >= second.length ? "first" : "second");

describe("evaluatePair — bias controls", () => {
  it("consistent thin win survives the swap", () => {
    const r = evaluatePair(task, "THIN", "EAGER", pickThin);
    expect(r.winner).toBe("thin");
  });

  it("consistent eager win survives the swap", () => {
    const r = evaluatePair(task, "THIN", "EAGER", pickEager);
    expect(r.winner).toBe("eager");
  });

  it("a position-biased judge (always picks first) is rejected as inconsistent", () => {
    const r = evaluatePair(task, "A", "B", alwaysFirst);
    expect(r.winner).toBe("inconsistent");
  });

  it("a tie in both orders is a tie", () => {
    expect(evaluatePair(task, "A", "B", alwaysTie).winner).toBe("tie");
  });

  it("flags the winner as longer (length-confound signal)", () => {
    const r = evaluatePair(task, "LONG ANSWER HERE", "short", preferLonger);
    expect(r.winner).toBe("thin");
    expect(r.length_delta).toBeGreaterThan(0);
    expect(r.winner_is_longer).toBe(true);
  });
});

function mk(winner: PairResult["winner"], longer: boolean | null = null): PairResult {
  return { id: "t", winner, length_delta: longer ? 1 : -1, winner_is_longer: longer };
}

describe("aggregate + gate", () => {
  it("ok when thin win-rate ≥ threshold", () => {
    const results = [...Array(6)].map(() => mk("thin")).concat([...Array(4)].map(() => mk("eager")));
    const agg = aggregate(results, 0.48);
    expect(agg.decisive).toBe(10);
    expect(agg.thin_win_rate).toBeCloseTo(0.6);
    expect(agg.verdict).toBe("ok");
    expect(gateVerdict(agg)).toBe(0);
  });

  it("regression when thin win-rate < threshold", () => {
    const results = [...Array(4)].map(() => mk("thin")).concat([...Array(6)].map(() => mk("eager")));
    const agg = aggregate(results, 0.48);
    expect(agg.thin_win_rate).toBeCloseTo(0.4);
    expect(agg.verdict).toBe("regression");
    expect(gateVerdict(agg)).toBe(2);
  });

  it("no-data when there are no decisive pairs", () => {
    const agg = aggregate([mk("tie"), mk("inconsistent")], 0.48);
    expect(agg.thin_win_rate).toBeNull();
    expect(agg.verdict).toBe("no-data");
    expect(gateVerdict(agg)).toBe(0); // inert, never fails CI on no data
  });

  it("computes inconsistency + length-confound rates", () => {
    const results = [mk("thin", true), mk("thin", false), mk("eager", true), mk("inconsistent"), mk("tie")];
    const agg = aggregate(results, 0.48);
    expect(agg.decisive).toBe(3); // 2 thin + 1 eager
    expect(agg.inconsistency_rate).toBeCloseTo(1 / 5);
    expect(agg.length_confound_rate).toBeCloseTo(2 / 3); // 2 of 3 decisive winners were longer
  });

  it("wires Wilcoxon over signed diffs (non-null with decisive pairs)", () => {
    const results = [...Array(8)].map(() => mk("thin")).concat([...Array(2)].map(() => mk("eager")));
    expect(aggregate(results, 0.48).wilcoxon_p).not.toBeNull();
  });
});
