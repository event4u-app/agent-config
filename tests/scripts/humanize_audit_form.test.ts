import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeText } from "../../src/scripts/detect_ai_tells.js";

const ROOT = join(__dirname, "..", "..");
const SRC = readFileSync(
  join(ROOT, "src", "domains", "gtm-marketing", "humanize", "command.md"),
  "utf8",
);
const PROJECTED = readFileSync(
  join(ROOT, "dist", "agent-src", "commands", "humanize.md"),
  "utf8",
);

describe("/humanize audit-only form", () => {
  for (const [label, doc] of [
    ["source", SRC],
    ["projection", PROJECTED],
  ] as const) {
    it(`${label}: declares --audit in the argument hint`, () => {
      expect(doc).toContain("--audit");
      expect(doc).toMatch(/argument-hint:.*--audit/);
    });

    it(`${label}: the audit form locates and does not rewrite`, () => {
      expect(doc).toContain("locate, do not rewrite");
      expect(doc).toMatch(/No rewrite, and no suggested wording/i);
      expect(doc).toContain("line:column");
    });

    it(`${label}: the default form is still the rewrite`, () => {
      expect(doc).toContain("the final rewrite");
      expect(doc).toContain("The default form is unchanged");
    });

    it(`${label}: the disclosure-footer rule covers both forms`, () => {
      expect(doc).toContain("reproduced verbatim");
      expect(doc).toMatch(/holds in \*\*both\*\* forms/);
    });

    it(`${label}: the audit form is never selected on its own`, () => {
      expect(doc).toMatch(/never selects it on its own/);
    });
  }
});

describe("the detector supplies what the audit form promises", () => {
  const text =
    "Let's dive in. The data tells a story about the tapestry of the evolving landscape.\n" +
    "\nIn today's fast-paced world, one thing is clear.\n";

  it("every finding carries a line and a column", () => {
    const r = analyzeText(text, "en");
    const hits = [...r.hard_hits, ...r.cluster_hits];
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.occurrences.length, `${h.id} reports no occurrences`).toBe(h.count);
      for (const o of h.occurrences) {
        expect(o.line).toBeGreaterThanOrEqual(1);
        expect(o.column).toBeGreaterThanOrEqual(1);
        expect(o.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("a location resolves to the text it claims to point at", () => {
    const r = analyzeText(text, "en");
    const lines = text.split("\n");
    for (const h of [...r.hard_hits, ...r.cluster_hits]) {
      for (const o of h.occurrences) {
        const line = lines[o.line - 1] ?? "";
        expect(
          line.slice(o.column - 1, o.column - 1 + o.text.length),
          `${h.id} at ${o.line}:${o.column} does not point at "${o.text}"`,
        ).toBe(o.text);
      }
    }
  });
});

describe("a consistently used pattern is intent, not N tells", () => {
  const uniform =
    "The rollout is not just a release — it's a commitment.\n\n" +
    "We ship on Friday and we review on Monday, and the cadence has held for " +
    "eleven weeks without one exception anyone has had to explain.\n\n" +
    "The runbook is not just a document — it's the contract with whoever is on call.\n\n" +
    "Every alert carries an owner and a first diagnostic step, and the two that " +
    "did not carry one were rewritten in March after the incident.\n\n" +
    "The review is not just a meeting — it's where the decision gets made.\n";

  it("reports the pattern as uniform and charges it once", () => {
    const r = analyzeText(uniform, "en");
    const hit = r.cluster_hits.find((h) => h.id === "tell-negative-parallelism");
    expect(hit, "the probe no longer trips the pattern it is probing").toBeDefined();
    expect(hit!.count).toBeGreaterThanOrEqual(3);
    expect(hit!.consistency).toBe("uniform");
    expect(hit!.scored_count).toBe(1);
    expect(r.cluster_score).toBe(hit!.weight);
  });

  it("a local repetition is NOT uniform — the discount needs real spread", () => {
    const clustered =
      "It's not just a release, but a commitment. It's not just a document, but a contract. " +
      "It's not just a meeting, but a decision.\n\n" +
      "The rest of this note is about the deploy window and says nothing about " +
      "releases, documents or meetings, at any point, for several sentences, so " +
      "the three hits above sit in the first fifth of the text and nowhere else. " +
      "The window opens on Tuesday and closes on Thursday and the freeze is " +
      "unchanged from the previous quarter, which is what everyone expected.\n";
    const hit = analyzeText(clustered, "en").cluster_hits.find(
      (h) => h.id === "tell-negative-parallelism",
    );
    expect(hit?.consistency).toBe("scattered");
    expect(hit?.scored_count).toBe(hit?.count);
  });

  it("a hard rule is never discounted, however uniformly it repeats", () => {
    const chatty =
      "I hope this helps with the migration.\n\n" +
      "The queue drained at four in the morning and the backlog cleared by five, " +
      "which is inside the target the runbook names for a cold start.\n\n" +
      "I hope this helps with the rollback too.\n\n" +
      "The database limit and the application limit now live in one file, so the " +
      "two cannot disagree the way they did in March.\n\n" +
      "I hope this helps with the next one.\n";
    const r = analyzeText(chatty, "en");
    const hit = r.hard_hits.find((h) => h.id === "tell-chat-artifact");
    expect(hit!.count).toBe(3);
    expect(hit!.consistency).toBe("uniform");
    expect(hit!.scored_count, "a hard hit must never be discounted").toBe(3);
    expect(r.hard_total).toBe(3);
  });
});
