#!/usr/bin/env node
/**
 * bench_prose_tells_fp — per-rule false-positive count for the prose-tell
 * registry, measured over a clean corpus.
 *
 * The seeded corpus in `tests/fixtures/ai-tells/{en,de}/` can only answer
 * "does the rule fire on text written to make it fire". This bench answers the
 * other half: how often each rule in `ai_tells_rules.ts` fires on prose that
 * was never written for it. Pre-registration:
 * `internal/bench/corpora/prose-tells-fp-PREREG.md` — read it before reading a
 * number from this tool.
 *
 * Counting is PER FILE, not per hit: a rule matching six lines of one file is
 * one false positive, because the unit a writer experiences is "this rule
 * flagged this file". Reported alongside, never instead: the count of rules
 * with a non-zero M1, and how many clean files the shipped thresholds reject
 * outright.
 *
 * Every run prints a corpus SHA-256 over the sorted `<path>:<sha256>` list. A
 * number quoted without its corpus hash is not comparable to any other number.
 *
 * Usage:
 *   npx tsx src/scripts/bench_prose_tells_fp.ts            # table + pin
 *   npx tsx src/scripts/bench_prose_tells_fp.ts --json
 *   npx tsx src/scripts/bench_prose_tells_fp.ts --gate tell-x tell-y
 *
 * `--gate <rule-id...>` is the Phase-2 promotion gate: exit 1 when any named
 * rule has a non-zero clean-corpus count, naming the files that hit. Promotion
 * of a family is refused while its count is above zero.
 *
 * Exit codes: 0 report-only or gate clean · 1 gate failed · 2 usage / no corpus.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeText, exceedsThresholds } from "./detect_ai_tells.js";
import {
  ALL_TELL_RULES,
  DEFAULT_MAX_CLUSTER_SCORE,
  DEFAULT_MAX_DASH_DENSITY,
  DEFAULT_MAX_HARD,
} from "./ai_tells_rules.js";

const REPO = join(fileURLToPath(import.meta.url), "..", "..", "..");
export const CLEAN_DIR = join(REPO, "tests", "fixtures", "ai-tells", "clean");

const THRESHOLDS = {
  maxHard: DEFAULT_MAX_HARD,
  maxScore: DEFAULT_MAX_CLUSTER_SCORE,
  maxDashDensity: DEFAULT_MAX_DASH_DENSITY,
};

export interface CleanFile {
  path: string;
  language: "en" | "de";
  text: string;
}

/** Every file in the clean corpus, sorted, with its language from the folder. */
export function loadCleanCorpus(dir: string = CLEAN_DIR): CleanFile[] {
  const out: CleanFile[] = [];
  for (const language of ["en", "de"] as const) {
    let names: string[] = [];
    try {
      names = readdirSync(join(dir, language)).filter((f) => f.endsWith(".md")).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      const full = join(dir, language, name);
      out.push({
        path: relative(REPO, full),
        language,
        text: readFileSync(full, "utf8"),
      });
    }
  }
  return out;
}

/** SHA-256 over the sorted `<relative path>:<sha256 of contents>` list. */
export function corpusPin(files: CleanFile[]): string {
  const lines = files
    .map((f) => `${f.path}:${createHash("sha256").update(f.text).digest("hex")}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export interface RuleFp {
  id: string;
  language: string;
  severity: string;
  /** M1 — number of clean files on which the rule produced at least one match. */
  files: number;
  /** Which files, so a non-zero count is actionable rather than a number. */
  hits: string[];
}

export interface FpReport {
  corpus_pin: string;
  files: number;
  per_rule: RuleFp[];
  rules_with_findings: number;
  /** Clean files the shipped thresholds would reject outright. */
  rejected_files: Array<{ path: string; reasons: string[] }>;
}

export function measure(files: CleanFile[]): FpReport {
  const byRule = new Map<string, string[]>();
  const rejected: Array<{ path: string; reasons: string[] }> = [];

  for (const f of files) {
    const report = analyzeText(f.text, f.language);
    for (const [id, count] of Object.entries(report.per_pattern)) {
      if (count > 0) byRule.set(id, [...(byRule.get(id) ?? []), f.path]);
    }
    const reasons = exceedsThresholds(report, THRESHOLDS);
    if (reasons.length > 0) rejected.push({ path: f.path, reasons });
  }

  const perRule: RuleFp[] = ALL_TELL_RULES.map((r) => ({
    id: r.id,
    language: r.language,
    severity: r.severity,
    files: (byRule.get(r.id) ?? []).length,
    hits: byRule.get(r.id) ?? [],
  })).sort((a, b) => b.files - a.files || a.id.localeCompare(b.id));

  return {
    corpus_pin: corpusPin(files),
    files: files.length,
    per_rule: perRule,
    rules_with_findings: perRule.filter((r) => r.files > 0).length,
    rejected_files: rejected,
  };
}

function render(r: FpReport): string {
  const lines: string[] = [];
  lines.push(`prose-tell false-positive count — ${r.files} clean files`);
  lines.push(`corpus pin: ${r.corpus_pin}`);
  lines.push("");
  lines.push("| Rule | Lang | Severity | M1 (files) |");
  lines.push("|---|---|---|---|");
  for (const rule of r.per_rule) {
    lines.push(`| ${rule.id} | ${rule.language} | ${rule.severity} | ${rule.files} |`);
  }
  lines.push("");
  lines.push(`rules with a non-zero M1: ${r.rules_with_findings} / ${r.per_rule.length}`);
  lines.push(`clean files the shipped thresholds reject: ${r.rejected_files.length} / ${r.files}`);
  for (const f of r.rejected_files) lines.push(`  ❌ ${f.path} — ${f.reasons.join("; ")}`);
  for (const rule of r.per_rule.filter((x) => x.files > 0)) {
    lines.push(`  · ${rule.id} hit: ${rule.hits.join(", ")}`);
  }
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const gateAt = args.indexOf("--gate");
  const gated = gateAt === -1 ? [] : args.slice(gateAt + 1).filter((a) => !a.startsWith("--"));

  const files = loadCleanCorpus();
  if (files.length === 0) {
    console.error(`no clean corpus at ${CLEAN_DIR} — nothing to measure`);
    process.exit(2);
  }
  const report = measure(files);
  process.stdout.write((json ? JSON.stringify(report, null, 2) : render(report)) + "\n");

  if (gated.length > 0) {
    const known = new Set(ALL_TELL_RULES.map((r) => r.id));
    const unknown = gated.filter((g) => !known.has(g));
    if (unknown.length > 0) {
      console.error(`--gate names no such rule: ${unknown.join(", ")}`);
      process.exit(2);
    }
    const failing = report.per_rule.filter((r) => gated.includes(r.id) && r.files > 0);
    if (failing.length > 0) {
      for (const f of failing) {
        console.error(
          `promotion refused: ${f.id} has ${f.files} clean-corpus false positive(s) — ${f.hits.join(", ")}`,
        );
      }
      process.exit(1);
    }
    process.stdout.write(`promotion gate clean for: ${gated.join(", ")}\n`);
  }
  process.exit(0);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (invokedDirectly) main();
