#!/usr/bin/env node
/**
 * bench_humanizer_eval — paired eval for the humanizer feature.
 *
 * Two metrics over the before/after corpus in `tests/fixtures/ai-tells/`:
 *
 *   1. OBJECTIVE (free, deterministic): AI-tell reduction per pair via
 *      `detect_ai_tells.ts` — hard hits, cluster score/500w, dash density/500w.
 *   2. BLIND PREFERENCE (--judge, billable): an LLM judge sees each pair in
 *      randomized A/B order (deterministic LCG seed per pair) and picks which
 *      text reads more like a skilled human writer. LENGTH-CONTROLLED: pairs
 *      whose word counts differ by more than ±25% are excluded from the
 *      preference aggregate (the token program's verbosity-bias finding makes
 *      uncontrolled pairs unusable) — they still count for the objective metric.
 *
 * Reports follow docs/benchmarks.md naming:
 *   internal/bench/reports/humanizer-v1.{json,md}          (canonical pointer)
 *   internal/bench/reports/<ISO>-humanizer-v1.{json,md}    (immutable trail)
 *
 * Claims discipline: this eval backs `claim:humanizer-tell-reduction` in
 * docs/CLAIMS.md. It measures OUR pattern counts and a blind preference —
 * never third-party "AI detector" outcomes; that claim class stays banned.
 *
 * Usage:
 *   npx tsx src/scripts/bench_humanizer_eval.ts            # objective only
 *   npx tsx src/scripts/bench_humanizer_eval.ts --judge    # + blind preference (billable)
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeText, type TellReport } from "./detect_ai_tells.js";

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "tests", "fixtures", "ai-tells");
const REPORT_DIR = join(ROOT, "internal", "bench", "reports");
const LENGTH_TOLERANCE = 0.25;

interface PairResult {
  name: string;
  language: "en" | "de";
  words_before: number;
  words_after: number;
  length_ratio: number;
  length_controlled: boolean;
  before: Pick<TellReport, "hard_total" | "cluster_score_per_500" | "dash_density_per_500">;
  after: Pick<TellReport, "hard_total" | "cluster_score_per_500" | "dash_density_per_500">;
  judge?: { preferred: "after" | "before"; order: "after-first" | "before-first" };
}

function slim(r: TellReport) {
  return {
    hard_total: r.hard_total,
    cluster_score_per_500: r.cluster_score_per_500,
    dash_density_per_500: r.dash_density_per_500,
  };
}

/** Deterministic per-pair coin flip (LCG) so re-runs keep the same A/B order. */
function coin(seed: number): boolean {
  return ((seed * 1103515245 + 12345) >>> 16) % 2 === 0;
}

function loadPairs(): Array<{ name: string; language: "en" | "de"; before: string; after: string }> {
  const out: Array<{ name: string; language: "en" | "de"; before: string; after: string }> = [];
  for (const language of ["en", "de"] as const) {
    const dir = join(FIXTURES, language);
    let names: string[] = [];
    try {
      names = readdirSync(dir)
        .filter((f) => f.endsWith(".before.md"))
        .map((f) => f.replace(/\.before\.md$/, ""))
        .sort();
    } catch {
      continue;
    }
    for (const name of names) {
      out.push({
        name,
        language,
        before: readFileSync(join(dir, `${name}.before.md`), "utf8"),
        after: readFileSync(join(dir, `${name}.after.md`), "utf8"),
      });
    }
  }
  return out;
}

async function judgePair(
  pair: { name: string; before: string; after: string },
  index: number,
): Promise<{ preferred: "after" | "before"; order: "after-first" | "before-first" }> {
  const { AnthropicClient, load_anthropic_key } = await import("./ai_council/clients.js");
  const client = new AnthropicClient({ api_key: load_anthropic_key() });
  const afterFirst = coin(index + 1);
  const [a, b] = afterFirst ? [pair.after, pair.before] : [pair.before, pair.after];
  const system =
    "You judge writing quality blind. You will see two texts, A and B, covering the same content. " +
    "Pick the one that reads more like it was written by a skilled human writer for a real audience. " +
    "Judge prose quality only — not length, not topic. Reply with exactly one character: A or B.";
  const user = `Text A:\n\n${a}\n\n---\n\nText B:\n\n${b}\n\nWhich reads more like a skilled human writer? Reply A or B.`;
  const resp = client.ask(system, user, 8);
  const text = (resp.text ?? "").trim().toUpperCase();
  const pickedA = text.startsWith("A");
  const preferred = pickedA === afterFirst ? "after" : "before";
  return { preferred, order: afterFirst ? "after-first" : "before-first" };
}

async function main(): Promise<void> {
  const runJudge = process.argv.includes("--judge");
  const pairs = loadPairs();
  if (pairs.length < 20) {
    console.error(`corpus too small: ${pairs.length} pairs (< 20)`);
    process.exit(2);
  }

  const results: PairResult[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]!;
    const before = analyzeText(p.before, p.language);
    const after = analyzeText(p.after, p.language);
    const ratio = after.words / before.words;
    const controlled = Math.abs(1 - ratio) <= LENGTH_TOLERANCE;
    const row: PairResult = {
      name: p.name,
      language: p.language,
      words_before: before.words,
      words_after: after.words,
      length_ratio: Math.round(ratio * 100) / 100,
      length_controlled: controlled,
      before: slim(before),
      after: slim(after),
    };
    if (runJudge && controlled) {
      row.judge = await judgePair(p, i);
      console.log(`  judged ${p.name}: prefers ${row.judge.preferred} (${row.judge.order})`);
    }
    results.push(row);
  }

  const mean = (xs: number[]) =>
    Math.round((xs.reduce((s, x) => s + x, 0) / Math.max(xs.length, 1)) * 100) / 100;
  const agg = {
    pairs: results.length,
    length_controlled_pairs: results.filter((r) => r.length_controlled).length,
    mean_hard_before: mean(results.map((r) => r.before.hard_total)),
    mean_hard_after: mean(results.map((r) => r.after.hard_total)),
    mean_cluster_before: mean(results.map((r) => r.before.cluster_score_per_500)),
    mean_cluster_after: mean(results.map((r) => r.after.cluster_score_per_500)),
    mean_dash_before: mean(results.map((r) => r.before.dash_density_per_500)),
    mean_dash_after: mean(results.map((r) => r.after.dash_density_per_500)),
    judge_model: undefined as string | undefined,
    judged_pairs: 0,
    prefers_after: 0,
    prefers_before: 0,
  };
  const judged = results.filter((r) => r.judge);
  agg.judged_pairs = judged.length;
  agg.prefers_after = judged.filter((r) => r.judge!.preferred === "after").length;
  agg.prefers_before = judged.filter((r) => r.judge!.preferred === "before").length;
  if (runJudge) {
    const { DEFAULT_ANTHROPIC_MODEL } = await import("./ai_council/clients.js");
    agg.judge_model = DEFAULT_ANTHROPIC_MODEL as string;
  }

  const iso = new Date().toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
  const payload = { generated: iso, corpus: "tests/fixtures/ai-tells", aggregate: agg, results };

  const md = [
    "# Humanizer paired eval — v1",
    "",
    `> Generated ${iso} · corpus \`tests/fixtures/ai-tells\` (${agg.pairs} before/after pairs, ` +
      `${agg.length_controlled_pairs} length-controlled ±${LENGTH_TOLERANCE * 100}%).`,
    "",
    "## Objective — AI-tell reduction (deterministic)",
    "",
    "| Metric (mean) | Before | After |",
    "|---|---|---|",
    `| Hard hits | ${agg.mean_hard_before} | ${agg.mean_hard_after} |`,
    `| Cluster score /500w | ${agg.mean_cluster_before} | ${agg.mean_cluster_after} |`,
    `| Dash density /500w | ${agg.mean_dash_before} | ${agg.mean_dash_after} |`,
    "",
    "## Blind preference (length-controlled)",
    "",
    agg.judged_pairs > 0
      ? `Judge ${agg.judge_model}: prefers the humanized text in **${agg.prefers_after}/${agg.judged_pairs}** ` +
        `pairs (randomized A/B order, deterministic seed). An honest null here keeps the detector as a ` +
        `hygiene gate; the claim ledger only carries what this table shows.`
      : "_Not run (objective-only invocation)._",
    "",
    "## Scope note",
    "",
    "This eval measures the package's own pattern counts and a blind prose-quality preference.",
    'It never measures third-party "AI detector" outcomes — that claim class is banned',
    "(unfalsifiable from our side; see roadmap non-goals).",
    "",
  ].join("\n");

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, "humanizer-v1.json"), JSON.stringify(payload, null, 2));
  writeFileSync(join(REPORT_DIR, "humanizer-v1.md"), md);
  writeFileSync(join(REPORT_DIR, `${iso}-humanizer-v1.json`), JSON.stringify(payload, null, 2));
  writeFileSync(join(REPORT_DIR, `${iso}-humanizer-v1.md`), md);
  console.log(md);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(2);
});
