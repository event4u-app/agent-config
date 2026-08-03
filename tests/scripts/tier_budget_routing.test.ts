// Budget-relation matrix for docs/contracts/budget-routing.md
// (road-to-tested-routing Phase 7). Pins the binding relation:
// cheapest adequate tier WITH budget; cheap exhausted + strong funded →
// strong; all exhausted → session model + notice; never downshift below
// classifier adequacy; ask-switch asks; off-switch = today's behavior.
// Plus the atomic permit (reserve accounting, lock busy, race) and the
// 429 cool-down state.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_COOLDOWN_MS,
  RESERVE_FILE,
  acquireBudgetPermit,
  pickTier,
  readCooldowns,
  tripCooldown,
  type BudgetTier,
  type TierBudgetState,
} from "../../src/scripts/_lib/tier_budget_routing.js";

const NOW = 1_754_000_000_000;

function state(over: Partial<Record<BudgetTier, Partial<TierBudgetState>>> = {}): Record<BudgetTier, TierBudgetState> {
  const base = (): TierBudgetState => ({ ceiling_usd: null, spent_usd: 0, cooldown_until_ms: 0 });
  return {
    cheap: { ...base(), ...over.cheap },
    medium: { ...base(), ...over.medium },
    strong: { ...base(), ...over.strong },
  };
}

const tmpDirs: string[] = [];
function tmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "tier-budget-"));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("pickTier — the binding relation", () => {
  it("cheap-adequate + cheap budget available → cheap tier", () => {
    const d = pickTier({
      adequate_tier: "cheap",
      budgets: state({ cheap: { ceiling_usd: 10, spent_usd: 2 } }),
      routing_switch: "auto",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(d).toMatchObject({ route: "tier", tier: "cheap", action: "proceed", notice: "" });
  });

  it("cheap exhausted + strong funded → strong tier, work never blocked", () => {
    const d = pickTier({
      adequate_tier: "cheap",
      budgets: state({
        cheap: { ceiling_usd: 10, spent_usd: 10 },
        medium: { ceiling_usd: 5, spent_usd: 5 },
        strong: { ceiling_usd: 100, spent_usd: 1 },
      }),
      routing_switch: "auto",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(d.route).toBe("tier");
    expect(d.tier).toBe("strong");
    expect(d.notice).toContain("routed up");
  });

  it("all tier budgets exhausted → session model + surfaced notice (fail-open)", () => {
    const d = pickTier({
      adequate_tier: "cheap",
      budgets: state({
        cheap: { ceiling_usd: 1, spent_usd: 1 },
        medium: { ceiling_usd: 1, spent_usd: 1 },
        strong: { ceiling_usd: 1, spent_usd: 1 },
      }),
      routing_switch: "auto",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(d.route).toBe("session");
    expect(d.notice).toContain("work not blocked");
  });

  it("quality floor — a medium-adequate task never considers the cheap tier", () => {
    const d = pickTier({
      adequate_tier: "medium",
      budgets: state({ cheap: { ceiling_usd: 100, spent_usd: 0 } }),
      routing_switch: "auto",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(d.tier).toBe("medium");
  });

  it("a cooling tier is skipped like an exhausted one", () => {
    const d = pickTier({
      adequate_tier: "cheap",
      budgets: state({ cheap: { cooldown_until_ms: NOW + 1000 } }),
      routing_switch: "auto",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(d.tier).toBe("medium");
    expect(d.notice).toContain("cooling");
  });

  it("an expired cool-down no longer blocks the tier", () => {
    const d = pickTier({
      adequate_tier: "cheap",
      budgets: state({ cheap: { cooldown_until_ms: NOW - 1 } }),
      routing_switch: "auto",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(d.tier).toBe("cheap");
  });

  it("switch=ask asks on a budget-motivated route; switch=off is today's behavior", () => {
    const ask = pickTier({
      adequate_tier: "cheap",
      budgets: state(),
      routing_switch: "ask",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(ask.action).toBe("ask");
    const off = pickTier({
      adequate_tier: "cheap",
      budgets: state(),
      routing_switch: "off",
      estimated_cost_usd: 0.5,
      now_ms: NOW,
    });
    expect(off).toMatchObject({ route: "session", action: "proceed" });
  });

  it("null ceiling = no tier cap — routing works with only global ceilings", () => {
    const d = pickTier({
      adequate_tier: "cheap",
      budgets: state(),
      routing_switch: "auto",
      estimated_cost_usd: 100,
      now_ms: NOW,
    });
    expect(d.tier).toBe("cheap");
    expect(d.reason).toContain("no tier cap");
  });
});

describe("acquireBudgetPermit — atomic reserve", () => {
  it("grants and appends a pending reserve entry", () => {
    const dir = tmpDir();
    const r = acquireBudgetPermit({
      tracking_dir: dir,
      tier: "cheap",
      estimated_cost_usd: 1,
      ceiling_usd: 10,
      spent_usd: 2,
      now_ms: NOW,
    });
    expect(r.granted).toBe(true);
    const lines = fs.readFileSync(path.join(dir, RESERVE_FILE), "utf-8").trim().split("\n");
    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0] as string)).toMatchObject({ tier: "cheap", status: "pending" });
  });

  it("counts prior pending reserves — the race the council flagged", () => {
    const dir = tmpDir();
    // First request reserves $6 of a $10 ceiling with $2 already spent.
    expect(
      acquireBudgetPermit({
        tracking_dir: dir, tier: "cheap", estimated_cost_usd: 6, ceiling_usd: 10, spent_usd: 2, now_ms: NOW,
      }).granted,
    ).toBe(true);
    // Second concurrent request for $3 must be DENIED (2 spent + 6 reserved + 3 > 10)
    // even though the ledger alone (spent=2) would have allowed it.
    const second = acquireBudgetPermit({
      tracking_dir: dir, tier: "cheap", estimated_cost_usd: 3, ceiling_usd: 10, spent_usd: 2, now_ms: NOW,
    });
    expect(second.granted).toBe(false);
    expect(second.reason).toContain("reserved 6");
  });

  it("a busy lock denies conservatively instead of racing", () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, `${RESERVE_FILE}.lock`), "", "utf-8");
    const r = acquireBudgetPermit({
      tracking_dir: dir, tier: "cheap", estimated_cost_usd: 1, ceiling_usd: 10, spent_usd: 0, now_ms: NOW,
    });
    expect(r.granted).toBe(false);
    expect(r.reason).toContain("lock busy");
  });

  it("null ceiling grants without arithmetic", () => {
    const dir = tmpDir();
    const r = acquireBudgetPermit({
      tracking_dir: dir, tier: "strong", estimated_cost_usd: 50, ceiling_usd: null, spent_usd: 999, now_ms: NOW,
    });
    expect(r.granted).toBe(true);
  });
});

describe("cool-down state", () => {
  it("tripCooldown persists and readCooldowns round-trips", () => {
    const dir = tmpDir();
    const until = tripCooldown({ tracking_dir: dir, tier: "cheap", now_ms: NOW });
    expect(until).toBe(NOW + DEFAULT_COOLDOWN_MS);
    const map = readCooldowns(dir);
    expect(map.cheap).toBe(until);
    expect(map.medium).toBe(0);
  });

  it("missing state file → all tiers live", () => {
    expect(readCooldowns(tmpDir())).toEqual({ cheap: 0, medium: 0, strong: 0 });
  });
});
