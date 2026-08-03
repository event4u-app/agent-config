// Budget-relation matrix for docs/contracts/budget-routing.md
// (road-to-tested-routing Phase 7). Pins the binding relation:
// cheapest adequate tier WITH budget; cheap exhausted + strong funded →
// strong; all exhausted → session model + notice; never downshift below
// classifier adequacy; ask-switch asks; off-switch = today's behavior.
// Plus the atomic permit (reserve accounting, lock busy, race) and the
// 429 cool-down state.
//
// RESERVE-LIFECYCLE ACCEPTANCE CRITERIA — pre-registered before the
// lifecycle fix was implemented (external review 2026-08-03, Finding 1):
//   AC1 no double counting — a reserve older than the shared TTL is
//       IGNORED by acquireBudgetPermit (the ledger alone carries real
//       spend), so a completed dispatch cannot count twice.
//   AC2 one window — acquireBudgetPermit and `budget.mjs tier` read the
//       SAME TTL from src/config/budget-routing.json; a fixture with
//       mixed fresh/expired reserves yields the same reserved_usd from
//       both readers (asserted, not manually checked).
//   AC3 bounded file — compaction on write drops expired + settled
//       entries; after N acquires the file holds only live entries.
//   AC4 stale-lock breakage — a .lock older than lock_break_ms is broken
//       and the permit still succeeds; a FRESH lock still denies.
//   AC5 settlePermit removes one live pending entry of the tier and is
//       purely optional (TTL remains the backstop).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { execFileSync } from "node:child_process";
import {
  DEFAULT_COOLDOWN_MS,
  RESERVE_FILE,
  acquireBudgetPermit,
  pickTier,
  readCooldowns,
  reserveTtlMs,
  settlePermit,
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

describe("reserve lifecycle — pre-registered acceptance criteria", () => {
  const TTL = reserveTtlMs();

  function writeReserve(dir: string, entries: Array<Record<string, unknown>>): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, RESERVE_FILE),
      entries.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf-8",
    );
  }

  it("AC1: a reserve older than the TTL is ignored — no double counting after a dispatch settles into the ledger", () => {
    const dir = tmpDir();
    // A completed dispatch: its $6 reserve is now expired, its real $6 cost
    // lives in the ledger (spent_usd). Ceiling 10, next request $3:
    // 6 (spent) + 0 (expired reserve ignored) + 3 <= 10 → GRANT.
    writeReserve(dir, [{ ts_ms: NOW - TTL - 1, tier: "cheap", est_usd: 6, status: "pending" }]);
    const r = acquireBudgetPermit({
      tracking_dir: dir, tier: "cheap", estimated_cost_usd: 3, ceiling_usd: 10, spent_usd: 6, now_ms: NOW,
    });
    expect(r.granted).toBe(true);
  });

  it("AC2: both readers apply the SAME TTL on a mixed fresh/expired fixture", () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, "agents", "cost-tracking"), { recursive: true });
    const tracking = path.join(dir, "agents", "cost-tracking");
    const nowMs = Date.now(); // budget.mjs uses the wall clock — feed it real timestamps
    writeReserve(tracking, [
      { ts_ms: nowMs - 1000, tier: "cheap", est_usd: 2, status: "pending" }, // fresh
      { ts_ms: nowMs - TTL - 1000, tier: "cheap", est_usd: 5, status: "pending" }, // expired
    ]);
    fs.writeFileSync(path.join(tracking, "sessions.jsonl"), "", "utf-8");
    fs.writeFileSync(
      path.join(dir, ".agent-settings.yml"),
      "cost:\n  budgets:\n    daily: 0\n    per_tier:\n      cheap: 10\n      medium: null\n      strong: null\n",
      "utf-8",
    );
    const REPO = path.resolve(__dirname, "..", "..");
    const out = JSON.parse(
      execFileSync("node", [path.join(REPO, "src", "scripts", "cost", "budget.mjs"), "tier", "cheap"], {
        cwd: dir,
        encoding: "utf-8",
      }),
    ) as { reserved_usd: number; reserve_ttl_ms: number };
    // budget.mjs must see ONLY the fresh $2 — same verdict the permit path
    // reaches with the shared TTL. Asserted, not manually checked.
    expect(out.reserved_usd).toBe(2);
    expect(out.reserve_ttl_ms).toBe(TTL);
    const denyProbe = acquireBudgetPermit({
      tracking_dir: tracking, tier: "cheap", estimated_cost_usd: 9, ceiling_usd: 10, spent_usd: 0, now_ms: nowMs,
    });
    // 0 spent + 2 fresh-reserved + 9 > 10 → denied; the expired 5 is ignored
    // by the permit path exactly as budget.mjs ignored it.
    expect(denyProbe.granted).toBe(false);
    expect(denyProbe.reason).toContain("reserved 2");
  });

  it("AC3: compaction bounds the file — expired entries are dropped on write", () => {
    const dir = tmpDir();
    const stale = Array.from({ length: 50 }, (_, i) => ({
      ts_ms: NOW - TTL - 1000 - i, tier: "cheap", est_usd: 1, status: "pending",
    }));
    writeReserve(dir, stale);
    acquireBudgetPermit({
      tracking_dir: dir, tier: "cheap", estimated_cost_usd: 1, ceiling_usd: null, spent_usd: 0, now_ms: NOW,
    });
    const lines = fs.readFileSync(path.join(dir, RESERVE_FILE), "utf-8").trim().split("\n");
    expect(lines.length).toBe(1); // only the new live reserve survives
  });

  it("AC4: a stale lock is broken and the permit succeeds; a fresh lock still denies", () => {
    const dir = tmpDir();
    fs.mkdirSync(dir, { recursive: true });
    const lock = path.join(dir, `${RESERVE_FILE}.lock`);
    fs.writeFileSync(lock, "", "utf-8");
    const past = new Date(Date.now() - 120_000);
    fs.utimesSync(lock, past, past); // crash leftover, 2 min old
    const r = acquireBudgetPermit({
      tracking_dir: dir, tier: "cheap", estimated_cost_usd: 1, ceiling_usd: 10, spent_usd: 0, now_ms: Date.now(),
    });
    expect(r.granted).toBe(true);
    // Fresh lock (mtime now) → still conservative deny.
    fs.writeFileSync(lock, "", "utf-8");
    const denied = acquireBudgetPermit({
      tracking_dir: dir, tier: "cheap", estimated_cost_usd: 1, ceiling_usd: 10, spent_usd: 0, now_ms: Date.now(),
    });
    expect(denied.granted).toBe(false);
    fs.rmSync(lock, { force: true });
  });

  it("AC5: settlePermit removes exactly one live pending entry of the tier", () => {
    const dir = tmpDir();
    writeReserve(dir, [
      { ts_ms: NOW - 1000, tier: "cheap", est_usd: 2, status: "pending" },
      { ts_ms: NOW - 500, tier: "cheap", est_usd: 3, status: "pending" },
      { ts_ms: NOW - 500, tier: "strong", est_usd: 7, status: "pending" },
    ]);
    expect(settlePermit({ tracking_dir: dir, tier: "cheap", now_ms: NOW })).toBe(true);
    const lines = fs
      .readFileSync(path.join(dir, RESERVE_FILE), "utf-8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { tier: string; est_usd: number });
    expect(lines.length).toBe(2);
    expect(lines.filter((e) => e.tier === "cheap")).toHaveLength(1);
    expect(settlePermit({ tracking_dir: dir, tier: "medium", now_ms: NOW })).toBe(false);
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
