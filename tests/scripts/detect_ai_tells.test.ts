import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeText,
  exceedsThresholds,
  stripExempt,
} from "../../src/scripts/detect_ai_tells.js";
import {
  DEFAULT_MAX_CLUSTER_SCORE,
  DEFAULT_MAX_DASH_DENSITY,
  DEFAULT_MAX_HARD,
} from "../../src/scripts/ai_tells_rules.js";

const THRESHOLDS = {
  maxHard: DEFAULT_MAX_HARD,
  maxScore: DEFAULT_MAX_CLUSTER_SCORE,
  maxDashDensity: DEFAULT_MAX_DASH_DENSITY,
};

function fixtureDir(lang: string): string {
  return join(__dirname, "..", "fixtures", "ai-tells", lang);
}

function pairs(lang: string): string[] {
  try {
    return readdirSync(fixtureDir(lang))
      .filter((f) => f.endsWith(".before.md"))
      .map((f) => f.replace(/\.before\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}

function load(lang: string, name: string, side: "before" | "after"): string {
  return readFileSync(join(fixtureDir(lang), `${name}.${side}.md`), "utf8");
}

describe("detect_ai_tells fixture corpus (en)", () => {
  const names = pairs("en");

  it("has at least 10 before/after pairs", () => {
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  for (const name of pairs("en")) {
    it(`${name}: before exceeds thresholds`, () => {
      const report = analyzeText(load("en", name, "before"), "en");
      const reasons = exceedsThresholds(report, THRESHOLDS);
      expect(reasons.length, JSON.stringify(report.per_pattern)).toBeGreaterThan(0);
    });

    it(`${name}: after passes thresholds (0 false positives)`, () => {
      const report = analyzeText(load("en", name, "after"), "en");
      const reasons = exceedsThresholds(report, THRESHOLDS);
      expect(reasons, JSON.stringify(report.per_pattern)).toEqual([]);
    });
  }
});

describe("detect_ai_tells fixture corpus (de)", () => {
  for (const name of pairs("de")) {
    it(`${name}: before exceeds thresholds`, () => {
      const report = analyzeText(load("de", name, "before"), "de");
      expect(exceedsThresholds(report, THRESHOLDS).length).toBeGreaterThan(0);
    });

    it(`${name}: after passes thresholds`, () => {
      const report = analyzeText(load("de", name, "after"), "de");
      const reasons = exceedsThresholds(report, THRESHOLDS);
      expect(reasons, JSON.stringify(report.per_pattern)).toEqual([]);
    });
  }
});

describe("hard-tell detection", () => {
  it("flags chat artifacts as hard hits", () => {
    const r = analyzeText("Great overview. I hope this helps! Let me know if you'd like more.", "en");
    expect(r.hard_total).toBeGreaterThan(0);
    expect(r.per_pattern["tell-chat-artifact"]).toBeGreaterThan(0);
  });

  it("flags knowledge-cutoff disclaimers", () => {
    const r = analyzeText("As of my last update, the company appears to maintain a low profile.", "en");
    expect(r.per_pattern["tell-knowledge-cutoff"]).toBeGreaterThan(0);
  });

  it("flags emoji headings", () => {
    const r = analyzeText("## 🚀 Launch Phase\n\nThe product launches in Q3.", "en");
    expect(r.per_pattern["tell-emoji-heading"]).toBeGreaterThan(0);
  });

  it("flags spaced double hyphens", () => {
    const r = analyzeText("The changes -- long overdue -- take effect now.", "en");
    expect(r.per_pattern["tell-double-hyphen-aside"]).toBeGreaterThan(0);
  });
});

describe("density + cluster mechanics", () => {
  it("counts em/en dashes per 500 words", () => {
    const text = "Alpha — beta — gamma — delta. " + "word ".repeat(96);
    const r = analyzeText(text, "en");
    expect(r.dash_count).toBe(3);
    expect(r.dash_density_per_500).toBeGreaterThan(DEFAULT_MAX_DASH_DENSITY);
  });

  it("a single em dash in long prose stays under the density cap (no hard-zero)", () => {
    const text = "One dash — used deliberately. " + "plain word filler here. ".repeat(80);
    const r = analyzeText(text, "en");
    expect(exceedsThresholds(r, THRESHOLDS)).toEqual([]);
  });

  it("isolated low-weight cluster hits do not trip the gate", () => {
    const text = "The report is thorough. " + "plain filler text. ".repeat(50) + "It has “one” curly quote pair.";
    const r = analyzeText(text, "en");
    expect(exceedsThresholds(r, THRESHOLDS)).toEqual([]);
  });
});

describe("write-engine step 4b gate (ghostwriter fixture)", () => {
  const FOOTER = "\n\nWritten in the style of Vera Holmwood, not by them.\n";

  it("a deliberately AI-ism-seeded draft fails the 4b thresholds", () => {
    const report = analyzeText(load("en", "10-ghostwriter-draft", "before"), "en");
    expect(exceedsThresholds(report, THRESHOLDS).length).toBeGreaterThan(0);
  });

  it("the humanized fixture-voice draft passes the 4b thresholds", () => {
    const report = analyzeText(load("en", "10-ghostwriter-draft", "after"), "en");
    expect(exceedsThresholds(report, THRESHOLDS)).toEqual([]);
  });

  it("appending the literal disclosure footer never flips the verdict (footer exemption)", () => {
    const clean = load("en", "10-ghostwriter-draft", "after");
    const withFooter = analyzeText(clean + FOOTER, "en");
    expect(exceedsThresholds(withFooter, THRESHOLDS)).toEqual([]);
  });
});

describe("exemption handling (secondhand-text guard)", () => {
  it("never scans fenced code, inline code, blockquotes, or quoted spans", () => {
    const text = [
      "Real prose without tells.",
      "",
      "```",
      "delve into the vibrant tapestry — showcase",
      "```",
      "",
      "> Quoted: this serves as a testament to the evolving landscape.",
      "",
      'The critic wrote "a vibrant tapestry of pivotal moments" about the film.',
      "",
      "Inline `let's dive in` stays code.",
    ].join("\n");
    const r = analyzeText(text, "en");
    expect(r.cluster_score).toBe(0);
    expect(r.hard_total).toBe(0);
    expect(r.dash_count).toBe(0);
  });

  it("strips YAML frontmatter", () => {
    const { base } = stripExempt("---\ntitle: vibrant tapestry\n---\nPlain body.\n");
    expect(base).not.toContain("tapestry");
  });
});
