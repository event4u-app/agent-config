import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLEAN_DIR,
  corpusPin,
  loadCleanCorpus,
  measure,
} from "../../src/scripts/bench_prose_tells_fp.js";

function tempCorpus(): string {
  const dir = mkdtempSync(join(tmpdir(), "prose-fp-"));
  mkdirSync(join(dir, "en"), { recursive: true });
  mkdirSync(join(dir, "de"), { recursive: true });
  return dir;
}

describe("clean corpus shape (pre-registration contract)", () => {
  const files = loadCleanCorpus();

  it("holds at least 30 files, per the pre-registration", () => {
    expect(files.length).toBeGreaterThanOrEqual(30);
  });

  it("covers both languages", () => {
    expect(files.some((f) => f.language === "en")).toBe(true);
    expect(files.some((f) => f.language === "de")).toBe(true);
  });

  it("every file opens with an exempt blockquote label saying why it is clean", () => {
    for (const f of files) {
      const first = f.text.split("\n").find((l) => l.trim().length > 0) ?? "";
      expect(first.trim().startsWith(">"), `${f.path} has no clean-by-construction label`).toBe(true);
      expect(first.toLowerCase(), `${f.path} label does not say clean`).toContain("clean");
    }
  });

  it("carries the near-misses the pre-registration requires", () => {
    const names = files.map((f) => f.path);
    for (const needle of [
      "list-of-three",      // rule-of-three near-miss
      "two-em-dashes",      // dash-density near-miss over a real denominator
      "four-word-line",     // density-floor near-miss
      "technical-vocabulary",
      "curled-quotes",
      "rhetorical-question",
    ]) {
      expect(names.some((n) => n.includes(needle)), `missing near-miss: ${needle}`).toBe(true);
    }
  });
});

describe("the measurement moves with the corpus", () => {
  it("adding a file changes the per-rule count and the corpus pin", () => {
    const dir = tempCorpus();
    try {
      writeFileSync(
        join(dir, "en", "01-base.md"),
        "> Clean by construction: control file with no tell.\n\nThe report ships on Friday and nobody has asked for a change.\n",
      );
      const before = measure(loadCleanCorpus(dir));
      expect(before.files).toBe(1);
      const roThenBefore = before.per_rule.find((r) => r.id === "tell-rule-of-three")?.files;
      expect(roThenBefore).toBe(0);

      writeFileSync(
        join(dir, "en", "02-added.md"),
        "> Clean by construction: label only — the body carries a forced abstract triplet.\n\nA platform for analytics, automation, and collaboration.\n",
      );
      const after = measure(loadCleanCorpus(dir));

      expect(after.files).toBe(2);
      expect(after.corpus_pin).not.toBe(before.corpus_pin);
      expect(
        after.per_rule.find((r) => r.id === "tell-rule-of-three")?.files,
        "adding a file that trips a rule must move that rule's count",
      ).toBeGreaterThan(roThenBefore ?? 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("counts per file, never per hit", () => {
    const dir = tempCorpus();
    try {
      // Three separate matches of the same rule inside ONE file.
      writeFileSync(
        join(dir, "en", "01-many.md"),
        "> Clean by construction: repeated near-miss inside one file.\n\n" +
          "A platform for analytics, automation, and collaboration. " +
          "A culture of curiosity, generosity, and collaboration.\n",
      );
      const r = measure(loadCleanCorpus(dir));
      const ro = r.per_rule.find((x) => x.id === "tell-rule-of-three");
      expect(ro?.files).toBe(1);
      expect(ro?.hits.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the pin is stable for unchanged content and order-independent", () => {
    const files = loadCleanCorpus();
    expect(corpusPin(files)).toBe(corpusPin([...files].reverse()));
  });
});

describe("the pre-registration exists and predates the numbers", () => {
  it("names M1 and the promotion ceiling", () => {
    const prereg = readFileSync(
      join(CLEAN_DIR, "..", "..", "..", "..", "internal", "bench", "corpora", "prose-tells-fp-PREREG.md"),
      "utf8",
    );
    expect(prereg).toContain("M1");
    expect(prereg).toContain("M1 = 0");
  });

  it("the corpus directory is the one the pre-registration names", () => {
    expect(readdirSync(CLEAN_DIR).sort()).toEqual(["de", "en"]);
  });
});
