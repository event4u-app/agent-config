import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeText } from "../../src/scripts/detect_ai_tells.js";
import { familyDelta, loadPairs } from "../../src/scripts/bench_humanizer_eval.js";

const SEEDED =
  "In today's fast-paced landscape, the platform delves into the tapestry of " +
  "analytics, automation, and collaboration. One thing is clear. The future " +
  "looks bright.";
const HUMAN =
  "The platform reports on three things: how often jobs run, how often they " +
  "fail, and who fixed the last failure. That is the whole feature.";

describe("attribution vector", () => {
  it("names which families the pass removed, not just that something changed", () => {
    const delta = familyDelta(analyzeText(SEEDED, "en"), analyzeText(HUMAN, "en"));
    expect(Object.keys(delta).length).toBeGreaterThan(1);
    expect(delta["tell-ai-vocabulary"]).toBeGreaterThan(0);
    expect(delta["tell-throat-clearing"]).toBeGreaterThan(0);
  });

  it("counts only what was removed — a family the pass left alone is absent", () => {
    const same = familyDelta(analyzeText(SEEDED, "en"), analyzeText(SEEDED, "en"));
    expect(same).toEqual({});
  });

  it("disabling a family removes it from the scan, not merely from the table", () => {
    const full = analyzeText(SEEDED, "en");
    const without = analyzeText(SEEDED, "en", {
      exclude: new Set(["tell-ai-vocabulary"]),
    });
    expect(full.per_pattern["tell-ai-vocabulary"]).toBeGreaterThan(0);
    expect(without.per_pattern["tell-ai-vocabulary"]).toBeUndefined();
    // The metric moves with it — that is what makes the disabled run evidence
    // about the family rather than a redacted report.
    expect(without.cluster_score).toBeLessThan(full.cluster_score);
  });

  it("disabling changes the attribution vector for a real fixture pair", () => {
    const pair = loadPairs().find((p) => p.language === "en")!;
    const before = analyzeText(pair.before, "en");
    const after = analyzeText(pair.after, "en");
    const full = familyDelta(before, after);
    const disabled = new Set(Object.keys(full).slice(0, 1));
    const trimmed = familyDelta(
      analyzeText(pair.before, "en", { exclude: disabled }),
      analyzeText(pair.after, "en", { exclude: disabled }),
    );
    expect(Object.keys(trimmed)).not.toEqual(Object.keys(full));
    for (const id of disabled) expect(trimmed[id]).toBeUndefined();
  });
});

describe("the canonical report keeps the evidence its claim cites", () => {
  const report = readFileSync(
    join(__dirname, "..", "..", "internal", "bench", "reports", "humanizer-v1.md"),
    "utf8",
  );

  it("carries the anchor `claim:humanizer-tell-reduction` resolves against", () => {
    // check_claims resolves `humanizer-v1.md#prefers the humanized text`. An
    // objective-only re-run used to overwrite this file with a "Not run"
    // placeholder, which unbacked a backed claim for free and announced nothing.
    expect(report).toContain("prefers the humanized text");
  });

  it("a carried-forward preference names the run it came from", () => {
    if (!report.includes("Carried forward from the judged run of")) return;
    expect(report).toMatch(/Carried forward from the judged run of \*\*[0-9T:\-Z]+\*\*/);
    expect(report).toContain("NOT a measurement of the current register");
  });

  it("names its splits, so a figure cannot be read as held-out when it is not", () => {
    expect(report).toContain("holdout before");
    expect(report).toContain("SPLITS.json");
  });
});
