/**
 * Tests for the token-regression gate's pure verdict logic
 * (`src/scripts/check_token_regression.ts::evaluate`).
 */
import { describe, expect, it } from "vitest";

import { evaluate } from "../../src/scripts/check_token_regression.js";

const METHOD = "tokens_gpt: exact (tiktoken cl100k_base); tokens_claude: proxy (chars/3.6)";

function metrics(over: Record<string, number> = {}) {
  return {
    token_method: METHOD,
    metrics: {
      eager_rule_load: 74317,
      thin_rule_load: 14147,
      skill_descriptions: 10999,
      command_descriptions: 4998,
      mcp_schemas: 2942,
      ...over,
    },
  };
}

describe("token-regression evaluate()", () => {
  it("warmup when no baseline exists", () => {
    const r = evaluate(metrics(), null, 0.05);
    expect(r.status).toBe("warmup");
    expect(r.rows).toEqual([]);
  });

  it("ok when current equals baseline", () => {
    const r = evaluate(metrics(), metrics(), 0.05);
    expect(r.status).toBe("ok");
    expect(r.rows.every((row) => !row.regressed)).toBe(true);
  });

  it("ok when growth is within tolerance (+4% < 5%)", () => {
    const current = metrics({ eager_rule_load: Math.round(74317 * 1.04) });
    const r = evaluate(current, metrics(), 0.05);
    expect(r.status).toBe("ok");
  });

  it("regression when a metric grows beyond tolerance (+6% > 5%)", () => {
    const current = metrics({ eager_rule_load: Math.round(74317 * 1.06) });
    const r = evaluate(current, metrics(), 0.05);
    expect(r.status).toBe("regression");
    const row = r.rows.find((x) => x.id === "eager_rule_load");
    expect(row?.regressed).toBe(true);
    // rows are sorted by descending pct — the regressor leads.
    expect(r.rows[0]?.id).toBe("eager_rule_load");
  });

  it("a shrink never regresses (negative pct)", () => {
    const current = metrics({ thin_rule_load: Math.round(14147 * 0.8) });
    const r = evaluate(current, metrics(), 0.05);
    expect(r.status).toBe("ok");
    const row = r.rows.find((x) => x.id === "thin_rule_load");
    expect(row?.pct).toBeLessThan(0);
    expect(row?.regressed).toBe(false);
  });

  it("a token_method switch is a legitimate reset, never a regression", () => {
    const proxyBaseline = {
      token_method: "tokens_gpt: proxy (chars/4.0, tiktoken not installed); tokens_claude: proxy (chars/3.6)",
      metrics: metrics().metrics,
    };
    // Exact counts are ~16% higher than the proxy — would trip the gate, but
    // the method changed, so it must report `method-changed`, not regression.
    const current = metrics({ eager_rule_load: Math.round(74317 * 1.16) });
    const r = evaluate(current, proxyBaseline, 0.05);
    expect(r.status).toBe("method-changed");
    expect(r.rows.every((row) => !row.regressed)).toBe(true);
  });
});
