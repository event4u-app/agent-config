import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeText, type TellReport } from "../../src/scripts/detect_ai_tells.js";
import { ALL_TELL_RULES } from "../../src/scripts/ai_tells_rules.js";

/**
 * The bound table in `anti-aiisms.md` said "the deterministic subset is enforced
 * by detect_ai_tells.ts" over five bounds, three of which were implemented
 * nowhere. This test is what stops that recurring: it reads the shipped table
 * and probes the scanner for every row, so a bound whose attribution the code
 * does not honour fails the suite rather than sitting in a reference file.
 */
const TABLE = readFileSync(
  join(__dirname, "..", "..", "src", "skills", "humanizer", "references", "anti-aiisms.md"),
  "utf8",
);

interface BoundRow {
  bound: string;
  /** The Default column — the number the bound is stated against. */
  stated: string;
  signal: string;
  appliedBy: string;
}

/**
 * Denominators the scanner does not segment. A bound stated against one of
 * these cannot be machine-applied however good its signal is, which is the
 * whole reason two rows are eye-checked rather than scanner-applied.
 */
const UNCOMPUTED_UNITS = ["per claim", "per 100 words"];

function parseTable(md: string): BoundRow[] {
  const rows: BoundRow[] = [];
  for (const line of md.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== 5) continue;
    if (cells[0] === "Bound" || /^-+$/.test(cells[0] ?? "")) continue;
    rows.push({
      bound: cells[0] ?? "",
      stated: cells[1] ?? "",
      signal: (cells[2] ?? "").replace(/`/g, ""),
      appliedBy: cells[3] ?? "",
    });
  }
  return rows;
}

/**
 * A probe per bound: text the scanner must react to, and text it must not.
 * Declared here rather than derived, so a new table row with no probe fails on
 * the coverage assertion instead of passing silently.
 */
const FILLER =
  "The team reviewed the plan on Monday and agreed to keep the current cadence. ";

const PROBES: Record<string, { fires: string; quiet: string }> = {
  "Em/en-dash density": {
    fires:
      "Not a tool — a system, and not a product — a promise, and not a plan — a habit. " +
      FILLER.repeat(4),
    quiet: FILLER.repeat(10),
  },
  "Consecutive staccato fragments": {
    fires: "The build broke. We rolled back. The team shipped. Users noticed.",
    quiet: "The build broke. We rolled back. The team shipped for the first time in a week.",
  },
  "Uniform-shape bullets": {
    fires: [
      "- **attempts** — how many times a job retries.",
      "- **backoff** — seconds between attempts.",
      "- **timeout** — how long one attempt may run.",
      "- **jitter** — random spread across the window.",
    ].join("\n"),
    quiet: [
      "- **attempts** — how many times a job retries.",
      "- **backoff** — seconds between attempts.",
      "- **timeout** — how long one attempt may run.",
    ].join("\n"),
  },
  "Hedge stack": {
    fires: "This could potentially work. " + FILLER.repeat(4),
    quiet: "This works. " + FILLER.repeat(4),
  },
  "Stock-vocabulary density": {
    fires: "The team delves into the tapestry of the evolving landscape. " + FILLER.repeat(4),
    quiet: FILLER.repeat(10),
  },
};

const METRIC_KEYS: Array<keyof TellReport> = [
  "dash_density_per_500",
  "cluster_score_per_500",
  "hard_total",
];

const rows = parseTable(TABLE);

describe("anti-aiisms bound table matches the scanner", () => {
  it("the table parses and carries all five bounds", () => {
    expect(rows.length).toBe(5);
  });

  it("every bound has a probe declared — a new row without one fails here", () => {
    for (const r of rows) expect(PROBES[r.bound], `no probe for "${r.bound}"`).toBeDefined();
  });

  it("every mechanical signal resolves to a rule id or a report metric", () => {
    const ruleIds = new Set(ALL_TELL_RULES.map((x) => x.id));
    for (const r of rows) {
      const resolved = ruleIds.has(r.signal) || (METRIC_KEYS as string[]).includes(r.signal);
      expect(resolved, `"${r.signal}" for "${r.bound}" resolves to nothing in the scanner`).toBe(true);
    }
  });

  it("every declared signal actually reacts to its own probe", () => {
    const ruleIds = new Set(ALL_TELL_RULES.map((x) => x.id));
    for (const r of rows) {
      const probe = PROBES[r.bound]!;
      const fired = analyzeText(probe.fires, "en");
      const quiet = analyzeText(probe.quiet, "en");
      if (ruleIds.has(r.signal)) {
        expect(
          fired.per_pattern[r.signal] ?? 0,
          `"${r.bound}" claims ${r.signal} but it does not fire on its probe`,
        ).toBeGreaterThan(0);
        expect(
          quiet.per_pattern[r.signal] ?? 0,
          `"${r.bound}": ${r.signal} fires on the counter-probe too`,
        ).toBe(0);
      } else {
        const key = r.signal as keyof TellReport;
        expect(Number(fired[key] ?? 0), `${r.signal} did not move on its probe`).toBeGreaterThan(
          Number(quiet[key] ?? 0),
        );
      }
    }
  });

  it("`bound applied by` is one of exactly two declared values", () => {
    for (const r of rows) expect(["scanner", "step-3 eye-check"]).toContain(r.appliedBy);
  });

  it("only bounds stated in a unit the scanner computes may say `scanner`", () => {
    for (const r of rows) {
      const uncomputed = UNCOMPUTED_UNITS.some((u) => r.stated.includes(u));
      if (r.appliedBy === "scanner") {
        expect(
          uncomputed,
          `"${r.bound}" says scanner but is stated ${UNCOMPUTED_UNITS.find((u) => r.stated.includes(u))}, which the scanner does not segment`,
        ).toBe(false);
      } else {
        expect(
          uncomputed,
          `"${r.bound}" is eye-checked but its bound uses a unit the scanner does compute — say scanner, or restate the bound`,
        ).toBe(true);
      }
    }
  });

  it("a scanner-applied bound is one the gate can actually reject on", () => {
    // `scanner` means the threshold is machine-applied, so the signal has to be
    // reachable from `exceedsThresholds` — either a gated metric or a rule that
    // feeds the cluster score. An eye-checked row carries no such obligation.
    const clusterFeeding = new Set(
      ALL_TELL_RULES.filter((x) => x.severity === "cluster" && x.weight > 0).map((x) => x.id),
    );
    for (const r of rows.filter((x) => x.appliedBy === "scanner")) {
      const gated =
        (METRIC_KEYS as string[]).includes(r.signal) || clusterFeeding.has(r.signal);
      expect(gated, `"${r.bound}" says scanner but ${r.signal} reaches no threshold`).toBe(true);
    }
  });
});
