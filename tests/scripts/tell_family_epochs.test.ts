import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeText } from "../../src/scripts/detect_ai_tells.js";
import { ALL_TELL_RULES } from "../../src/scripts/ai_tells_rules.js";
import { loadCleanCorpus, measure } from "../../src/scripts/bench_prose_tells_fp.js";

const ROOT = join(__dirname, "..", "..");
const LEDGER = readFileSync(
  join(ROOT, "internal", "bench", "corpora", "prose-tells-epochs.md"),
  "utf8",
);

/** Every `tell-*` id the ledger claims was promoted under the epoch gate. */
function ledgerFamilies(): string[] {
  const ids = new Set<string>();
  for (const line of LEDGER.split("\n")) {
    if (!line.startsWith("|")) continue;
    const m = /\|\s*`(tell-[\w-]+)`\s*\|/.exec(line);
    if (m?.[1]) ids.add(m[1]);
  }
  return [...ids].sort();
}

/**
 * Positive probe and negative counter-probe per promoted family. Declared here
 * rather than shipped as fixture files: the corpus that matters for these rules
 * is the CLEAN one, and a positive fixture authored for its own rule measures
 * that the rule is wired, not that it generalises. Saying so is the same
 * declaration the design-side instrument makes about its own recall figure.
 */
const PROBES: Record<string, { fires: string; quiet: string; lang: "en" | "de" }> = {
  "tell-staccato-run": {
    lang: "en",
    fires: "The build broke. We rolled back. The team shipped. Users noticed.",
    quiet: "The build broke. We rolled back. The team shipped a fix within the hour.",
  },
  "tell-uniform-bullet-run": {
    lang: "en",
    fires: [
      "- **attempts** — retries before the dead-letter table.",
      "- **backoff** — seconds between attempts.",
      "- **timeout** — how long one attempt may run.",
      "- **jitter** — random spread across the window.",
    ].join("\n"),
    quiet: [
      "- **attempts** — retries before the dead-letter table.",
      "- **backoff** — seconds between attempts.",
      "- **timeout** — how long one attempt may run.",
    ].join("\n"),
  },
  "tell-throat-clearing": {
    lang: "en",
    fires: "In today's fast-paced landscape, the queue drained at four.",
    quiet: "To be blunt about the cost: the queue drained at four.",
  },
  "tell-emphasis-crutch": {
    lang: "en",
    fires: "The impact of the change cannot be overstated.",
    quiet: "The change cut p99 latency from 2.1 seconds to 310 milliseconds.",
  },
  "tell-false-agency": {
    lang: "en",
    fires: "The data tells a story about the migration.",
    quiet: "The migration data shows two failed writes on Tuesday.",
  },
  "tell-narrator-distance": {
    lang: "en",
    fires: "One might argue the rollback was too slow.",
    quiet: "I think the rollback was too slow, and the runbook agrees.",
  },
  "tell-vague-declarative": {
    lang: "en",
    fires: "One thing is clear about the quarter.",
    quiet: "Two things changed this quarter: the deadline and the headcount.",
  },
  "tell-binary-contrast": {
    lang: "en",
    fires: "The problem is less about tooling than about handover.",
    quiet: "We chose the managed queue over running our own broker.",
  },
  "tell-de-throat-clearing": {
    lang: "de",
    fires: "Ehrlich gesagt hat der Import am Dienstag nicht funktioniert.",
    quiet: "Ganz direkt: der Import hat am Dienstag nicht funktioniert.",
  },
  "tell-de-signposting": {
    lang: "de",
    fires: "Lass uns eintauchen in die Zahlen des Quartals.",
    quiet: "Hier sind die Zahlen des Quartals, sortiert nach Region.",
  },
  "tell-de-vague-declarative": {
    lang: "de",
    fires: "Eines ist klar für das kommende Quartal.",
    quiet: "Klar ist: zwei Dinge haben sich im Quartal geändert.",
  },
  "tell-de-generic-conclusion": {
    lang: "de",
    fires: "Die Zukunft sieht rosig aus für das Team.",
    quiet: "Das Team plant den nächsten Schritt für den Februar.",
  },
  "tell-de-emphasis-crutch": {
    lang: "de",
    fires: "Die Wirkung lässt sich nicht hoch genug einschätzen.",
    quiet: "Die Wirkung war messbar: elf Minuten statt zwei Stunden.",
  },
  "tell-de-false-agency": {
    lang: "de",
    fires: "Die Zahlen sprechen für sich in diesem Quartal.",
    quiet: "Die Zahlen zeigen zwei fehlgeschlagene Schreibvorgänge.",
  },
  "tell-de-narrator-distance": {
    lang: "de",
    fires: "Man könnte argumentieren, dass die Rückabwicklung zu langsam war.",
    quiet: "Ich halte die Rückabwicklung für zu langsam, und das Handbuch auch.",
  },
  "tell-de-negative-parallelism": {
    lang: "de",
    fires: "Es geht hier nicht um Technik, sondern um Vertrauen.",
    quiet: "Es geht hier um Technik und um Vertrauen, in dieser Reihenfolge.",
  },
};

const families = ledgerFamilies();

describe("epoch ledger — one family per epoch, promoted at zero", () => {
  it("the ledger names families and they all exist in the registry", () => {
    expect(families.length).toBeGreaterThan(0);
    const ids = new Set(ALL_TELL_RULES.map((r) => r.id));
    for (const f of families) expect(ids.has(f), `${f} is in the ledger and not in the registry`).toBe(true);
  });

  it("every promoted family still records a zero clean-corpus count", () => {
    const report = measure(loadCleanCorpus());
    for (const f of families) {
      const row = report.per_rule.find((r) => r.id === f);
      expect(row, `${f} missing from the measurement`).toBeDefined();
      expect(row!.files, `${f} now hits clean files: ${row!.hits.join(", ")}`).toBe(0);
    }
  });

  it("every promoted family has a probe — a ledger row without one fails here", () => {
    for (const f of families) expect(PROBES[f], `no probe declared for ${f}`).toBeDefined();
  });

  it("every promoted family fires on its probe and stays quiet on the counter-probe", () => {
    for (const f of families) {
      const p = PROBES[f]!;
      expect(analyzeText(p.fires, p.lang).per_pattern[f] ?? 0, `${f} did not fire`).toBeGreaterThan(0);
      expect(
        analyzeText(p.quiet, p.lang).per_pattern[f] ?? 0,
        `${f} fired on its counter-probe`,
      ).toBe(0);
    }
  });
});

describe("the promotion gate refuses, and names the file", () => {
  it("exits 1 for a family with a non-zero clean-corpus count and names the hitting file", () => {
    // `tell-de-connector-stack` is a LEGACY rule measured at 2 — the refusal
    // path has to be exercised against something that really hits, or the gate
    // is only ever seen green.
    const r = spawnSync(
      "npx",
      ["tsx", join(ROOT, "src", "scripts", "bench_prose_tells_fp.ts"), "--gate", "tell-de-connector-stack"],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("promotion refused: tell-de-connector-stack");
    expect(r.stderr).toContain("de/01-konnektor.md");
  }, 60_000);

  it("exits 0 for a promoted family", () => {
    const r = spawnSync(
      "npx",
      ["tsx", join(ROOT, "src", "scripts", "bench_prose_tells_fp.ts"), "--gate", "tell-vague-declarative"],
      { cwd: ROOT, encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("promotion gate clean for: tell-vague-declarative");
  }, 60_000);
});
