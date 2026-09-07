import { readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPairs, loadSplits } from "../../src/scripts/bench_humanizer_eval.js";

const FIXTURES = join(__dirname, "..", "fixtures", "ai-tells");

function pairNames(): string[] {
  const out: string[] = [];
  for (const lang of ["en", "de"]) {
    for (const f of readdirSync(join(FIXTURES, lang))) {
      if (f.endsWith(".before.md")) out.push(`${lang}/${f.replace(/\.before\.md$/, "")}`);
    }
  }
  return out.sort();
}

describe("tune / holdout split", () => {
  const splits = loadSplits();

  it("both halves are non-empty", () => {
    expect(splits.tune.length).toBeGreaterThan(0);
    expect(splits.holdout.length).toBeGreaterThan(0);
  });

  it("the halves are disjoint by name", () => {
    const overlap = splits.tune.filter((n) => splits.holdout.includes(n));
    expect(overlap, `pairs in both halves: ${overlap.join(", ")}`).toEqual([]);
  });

  it("the halves cover every pair on disk, and name no pair that is not there", () => {
    const declared = [...splits.tune, ...splits.holdout].sort();
    expect(declared).toEqual(pairNames());
  });

  it("both languages appear in both halves — a one-sided language is uncomparable", () => {
    for (const half of ["tune", "holdout"] as const) {
      for (const lang of ["en", "de"]) {
        expect(
          splits[half].some((n) => n.startsWith(`${lang}/`)),
          `${half} carries no ${lang} pair`,
        ).toBe(true);
      }
    }
  });

  it("every loaded pair carries its half", () => {
    for (const p of loadPairs()) expect(["tune", "holdout"]).toContain(p.split);
  });

  it("a pair in neither half is a hard error, never a silent default", () => {
    const dir = mkdtempSync(join(tmpdir(), "splits-"));
    try {
      const file = join(dir, "SPLITS.json");
      writeFileSync(
        file,
        JSON.stringify({ tune: splits.tune, holdout: splits.holdout.slice(1) }),
      );
      expect(() => loadPairs(loadSplits(file))).toThrow(/assigns no half/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a pair in both halves is a hard error", () => {
    const first = splits.holdout[0]!;
    expect(() => loadPairs({ tune: [...splits.tune, first], holdout: splits.holdout })).toThrow(
      /both halves/,
    );
  });
});
