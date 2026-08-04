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
 */
const TIER2_MATRIX_FLOOR = 72;

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
  it("every tier-1 rule has a matrix file (hard floor)", () => {
    const covered = new Set(files.map((f) => path.basename(f, ".yaml")));
    const missing = ROUTER.tier_1.map((r) => r.id).filter((id) => !covered.has(id));
    expect(missing, `tier-1 rules without a routing matrix: ${missing.join(", ")}`).toEqual([]);
  });

  it("tier-2 matrix count only ratchets up", () => {
    const tier2Ids = new Set(ROUTER.tier_2.map((r) => r.id));
    const tier2Covered = files.filter((f) => tier2Ids.has(path.basename(f, ".yaml")));
    expect(tier2Covered.length).toBeGreaterThanOrEqual(TIER2_MATRIX_FLOOR);
  });
});
