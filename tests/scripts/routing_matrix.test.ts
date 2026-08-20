// Data-driven per-rule routing matrices (road-to-tested-routing Phase 2).
//
// Executes every fixture under tests/eval/routing-matrix/ against the REAL
// matcher (router_telemetry.trigger_matches) and the REAL compiled trigger
// sets (dist/router.json): every positive prompt must route to its rule,
// every pinned near-miss must stay silent. Generalizes the pattern
// design_fidelity_routing.test.ts pioneered for one rule to the whole
// tier-1 set, plus a coverage floor so a new tier-1 rule cannot ship
// without a matrix.
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { trigger_matches } from "../../src/scripts/router_telemetry.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MATRIX_DIR = path.join(REPO_ROOT, "tests", "eval", "routing-matrix");
const ROUTER = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "dist", "router.json"), "utf-8"),
) as {
  tier_1: Array<{ id: string; triggers: Array<Record<string, string>> }>;
  tier_2: Array<{ id: string; triggers: Array<Record<string, string>> }>;
};

interface MatrixCase {
  prompt: string;
  open_files?: string[];
  command?: string;
}
interface MatrixFile {
  rule: string;
  positives: MatrixCase[];
  near_misses: MatrixCase[];
}

/**
 * Tier-2 matrices are a presence RATCHET: the count may only rise. Raise
 * this floor in the same change that adds new tier-2 matrix files.
 * 2026-08-03: full tier-2 coverage landed (73/73).
 * 2026-08-04: 73 → 72 — brand-consistency merged into brand-source-of-truth
 * (rule hygiene); its matrix positives were absorbed, coverage stays full.
 * 2026-08-17: 72 → 74 — `design-review-after-ui-write` and
 * `settings-ask-protocol` gained matrices (road-to-mixed-trigger-activation-cost
 * step 1.1). Both belong to the nineteen rules that flipped from path-scoped to
 * always-on at 12.1.0, and they were the only two of those nineteen with no
 * matrix at all — the two whose keyword reach nothing pinned, which is the
 * evidence the Phase-2 scoping decision is taken against. Coverage is NOT full:
 * four tier-2 rules still have none (council-availability,
 * evaluator-independence, missing-skill-recovery, self-repair-loop). None of the
 * four is in the flipped nineteen, so they sit outside that roadmap's scope and
 * are named here rather than left as an unexplained gap between 74 and 78.
 */
// Counted over tier-2 rules that HAVE triggers, not over all of them. A rule
// with no trigger makes no routing decision, so demanding a matrix for it demands
// a fiction — and a fiction is what turned this file red on 2026-08-20, when
// road-to-single-delivery Phase 5.1 removed the path triggers from four rules so
// they survive `/compact` (ADR-236 + ADR-227). Three were tier-1, one tier-2.
//
// The ratchet is NOT weakened by that narrowing, and the reason is a different
// gate: `check_rule_activation_census` pins the scoped / mixed rule-ID SETS by
// identity, so moving a rule out of the triggered set is a stated, reviewed change
// with a `baseline_history` reason — it cannot be used to quietly shrink this
// denominator. The floor still only ratchets up over the population it describes.
const TIER2_MATRIX_FLOOR = 73;

const files = fs
  .readdirSync(MATRIX_DIR)
  .filter((f) => f.endsWith(".yaml"))
  .sort();

const byId = new Map<string, Array<Record<string, string>>>();
for (const entry of [...ROUTER.tier_1, ...ROUTER.tier_2]) {
  byId.set(entry.id, entry.triggers);
}

function matchesRule(c: MatrixCase, triggers: Array<Record<string, string>>): boolean {
  return triggers.some((t) =>
    trigger_matches(t, c.prompt, c.open_files ?? [], c.command ?? ""),
  );
}

describe("routing matrices — fixture integrity", () => {
  it("every matrix file names a rule that exists in the router with triggers", () => {
    for (const f of files) {
      const parsed = parseYaml(
        fs.readFileSync(path.join(MATRIX_DIR, f), "utf-8"),
      ) as MatrixFile;
      expect(parsed.rule, `${f}: rule field`).toBe(path.basename(f, ".yaml"));
      expect(byId.has(parsed.rule), `${f}: unknown rule id ${parsed.rule}`).toBe(true);
    }
  });

  it("every file carries the floor: ≥3 positives and ≥2 near-misses", () => {
    for (const f of files) {
      const parsed = parseYaml(
        fs.readFileSync(path.join(MATRIX_DIR, f), "utf-8"),
      ) as MatrixFile;
      expect(parsed.positives.length, `${f}: positives`).toBeGreaterThanOrEqual(3);
      expect(parsed.near_misses.length, `${f}: near_misses`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("routing matrices — matcher verdicts", () => {
  for (const f of files) {
    const parsed = parseYaml(
      fs.readFileSync(path.join(MATRIX_DIR, f), "utf-8"),
    ) as MatrixFile;
    const triggers = byId.get(parsed.rule) ?? [];

    it(`${parsed.rule}: every positive routes`, () => {
      for (const c of parsed.positives) {
        expect(
          matchesRule(c, triggers),
          `positive did not route: "${c.prompt}"`,
        ).toBe(true);
      }
    });

    it(`${parsed.rule}: every near-miss stays silent`, () => {
      for (const c of parsed.near_misses) {
        expect(
          matchesRule(c, triggers),
          `near-miss routed: "${c.prompt}"`,
        ).toBe(false);
      }
    });
  }
});

describe("routing matrices — coverage floors", () => {
  /** A rule that declares no trigger makes no routing decision to pin. */
  const hasTriggers = (id: string): boolean => (byId.get(id) ?? []).length > 0;

  it("every TRIGGERED tier-1 rule has a matrix file (hard floor)", () => {
    const covered = new Set(files.map((f) => path.basename(f, ".yaml")));
    const missing = ROUTER.tier_1
      .map((r) => r.id)
      .filter((id) => hasTriggers(id) && !covered.has(id));
    expect(missing, `triggered tier-1 rules without a routing matrix: ${missing.join(", ")}`).toEqual([]);
  });

  it("a triggerless rule carries NO matrix — the floor must not be satisfiable by a fiction", () => {
    // The other direction, and it is the half that keeps the narrowing honest: a
    // matrix left behind on a rule whose triggers were removed would assert
    // routing behaviour the rule no longer has, and would pass the floor above
    // while testing nothing. Deleting it is the record; keeping it is a lie that
    // reads as coverage.
    const stale = files
      .map((f) => path.basename(f, ".yaml"))
      .filter((id) => byId.has(id) && !hasTriggers(id));
    expect(stale, `matrices for triggerless rules: ${stale.join(", ")}`).toEqual([]);
  });

  it("tier-2 matrix count only ratchets up", () => {
    const tier2Ids = new Set(ROUTER.tier_2.filter((r) => hasTriggers(r.id)).map((r) => r.id));
    const tier2Covered = files.filter((f) => tier2Ids.has(path.basename(f, ".yaml")));
    expect(tier2Covered.length).toBeGreaterThanOrEqual(TIER2_MATRIX_FLOOR);
  });
});
