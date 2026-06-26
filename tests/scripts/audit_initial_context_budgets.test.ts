/**
 * Token-saving Phase 8 — the always-loaded budget gate's pass/fail logic
 * (`evaluate_budgets` in src/scripts/audit_initial_context.ts).
 */
import { describe, expect, it } from "vitest";

import { BUDGETS, evaluate_budgets } from "../../src/scripts/audit_initial_context.js";

describe("audit_initial_context — evaluate_budgets", () => {
  it("passes when every surface is under its cap (current shape)", () => {
    const checks = {
      "rules.gpt": 74_456,
      "skill_catalog.gpt": 10_999,
      "command_catalog.gpt": 5_005,
      "mcp_schemas.gpt": 2_942,
    };
    expect(evaluate_budgets(checks, BUDGETS)).toEqual([]);
  });

  it("fails a synthetic over-budget always-scanned skill-description surface", () => {
    const checks = { "skill_catalog.gpt": 99_999 };
    const breaches = evaluate_budgets(checks, BUDGETS);
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatch(/^skill_catalog\.gpt 99999 > budget 12500$/);
  });

  it("a null/advisory cap never breaches (rules.gpt is owned by check_always_budget)", () => {
    expect(evaluate_budgets({ "rules.gpt": 10_000_000 }, BUDGETS)).toEqual([]);
  });

  it("exactly at the cap is not a breach (strict >)", () => {
    expect(evaluate_budgets({ "skill_catalog.gpt": 12_500 }, BUDGETS)).toEqual([]);
    expect(evaluate_budgets({ "skill_catalog.gpt": 12_501 }, BUDGETS)).toHaveLength(1);
  });

  it("reports every breached surface", () => {
    const breaches = evaluate_budgets(
      { "skill_catalog.gpt": 13_000, "command_catalog.gpt": 6_000, "mcp_schemas.gpt": 4_000 },
      BUDGETS,
    );
    expect(breaches).toHaveLength(3);
  });

  it("the shipped skill-description surface budget is the provisional Phase-8 cap", () => {
    expect(BUDGETS["skill_catalog.gpt"]).toBe(12_500);
  });
});
