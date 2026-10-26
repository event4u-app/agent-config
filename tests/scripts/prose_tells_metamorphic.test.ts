// Metamorphic relations — the no-import answer to OQ-20
// (road-to-tells-a-near-miss-can-refute 5.1): a rewrite that cannot change what
// a draft says must not change what the prose detector counts. They test the
// detector against itself, so they find brittleness; a blind spot the corpus
// authors share stays invisible to them.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadCleanCorpus } from "../../src/scripts/bench_prose_tells_fp.js";
import { analyzeText } from "../../src/scripts/detect_ai_tells.js";

const PAIRS = join("tests", "fixtures", "ai-tells");

const REWRITES: Record<string, (text: string) => string> = {
  "CRLF line endings": (t) => t.replace(/\n/g, "\r\n"),
  "a trailing space on every line": (t) => t.split("\n").map((l) => `${l} `).join("\n"),
  "a doubled blank line between paragraphs": (t) => t.replace(/\n\n/g, "\n\n\n"),
  "trailing blank lines": (t) => `${t}\n\n\n`,
  "soft-wrapped paragraphs joined": (t) =>
    t.split("\n\n").map((p) => (/^(#|>|[-*] |\d+\. |```|\|)/m.test(p) ? p : p.replace(/\n/g, " "))).join("\n\n"),
  // Red before detect_ai_tells normalised it: 22 of 55 files counted differently.
  "no-break spaces for spaces": (t) => t.replace(/ /g, " "),
};

const counts = (text: string, language: "en" | "de") =>
  Object.fromEntries(Object.entries(analyzeText(text, language).per_pattern).filter(([, n]) => n > 0));

const drafts = ["en", "de"].flatMap((language) =>
  readdirSync(join(PAIRS, language))
    .filter((f) => f.endsWith(".before.md"))
    .map((f) => ({ path: `${language}/${f}`, language: language as "en" | "de", text: readFileSync(join(PAIRS, language, f), "utf8") })),
);

// The clean corpus carries a few sub-threshold cluster hits on purpose (its
// near-misses), so the relation is "unchanged", not "empty".
describe("metamorphic: rewrites keep every count on the clean corpus", () => {
  const files = loadCleanCorpus();

  it("reads the whole clean corpus", () => {
    expect(files.length).toBeGreaterThanOrEqual(30);
  });

  for (const [name, rewrite] of Object.entries(REWRITES)) {
    it(name, () => {
      for (const f of files) expect(counts(rewrite(f.text), f.language), f.path).toEqual(counts(f.text, f.language));
    });
  }
});

describe("metamorphic: rewrites keep every count on the AI drafts", () => {
  it("reads drafts in both languages, each with findings", () => {
    expect(drafts.some((d) => d.language === "en")).toBe(true);
    expect(drafts.some((d) => d.language === "de")).toBe(true);
    for (const d of drafts) expect(Object.keys(counts(d.text, d.language)).length, d.path).toBeGreaterThan(0);
  });

  for (const [name, rewrite] of Object.entries(REWRITES)) {
    it(name, () => {
      for (const d of drafts) expect(counts(rewrite(d.text), d.language), d.path).toEqual(counts(d.text, d.language));
    });
  }
});
