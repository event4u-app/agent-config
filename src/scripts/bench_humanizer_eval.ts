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
 *   npx tsx src/scripts/bench_humanizer_eval.ts                          # objective only (free)
 *   npx tsx src/scripts/bench_humanizer_eval.ts --judge --confirm-spend  # + blind preference (billable)
 *
 * `--judge` without `--confirm-spend` estimates the billable call count and
 * halts (exit 2) — the spend is opt-in, never fired implicitly.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeText, type TellReport } from "./detect_ai_tells.js";

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "tests", "fixtures", "ai-tells");
const REPORT_DIR = join(ROOT, "internal", "bench", "reports");
const LENGTH_TOLERANCE = 0.25;
const SPLITS_FILE = join(FIXTURES, "SPLITS.json");

export type Split = "tune" | "holdout";

/**
 * Tune / holdout membership, declared in `tests/fixtures/ai-tells/SPLITS.json`.
 *
 * Before this existed `loadPairs()` returned one array, so a rule tuned against
 * the twenty pairs was measured against the same twenty pairs and overfitting
 * was excluded by construction — of the measurement, not of the rule. Every
 * figure this bench prints now names the half it came from, and a number that
 * mixes the halves is not produced at all.
 */
export function loadSplits(file: string = SPLITS_FILE): Record<Split, string[]> {
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const pick = (k: Split): string[] => {
    const v = raw[k];
    if (!Array.isArray(v)) throw new Error(`SPLITS.json: "${k}" is not an array`);
    return v as string[];
  };
  return { tune: pick("tune"), holdout: pick("holdout") };
}

interface PairResult {
  name: string;
  split: Split;
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

export interface LoadedPair {
  name: string;
  split: Split;
  language: "en" | "de";
  before: string;
  after: string;
}

export function loadPairs(splits: Record<Split, string[]> = loadSplits()): LoadedPair[] {
  const assigned = new Map<string, Split>();
  for (const s of ["tune", "holdout"] as const) {
    for (const key of splits[s]) {
      if (assigned.has(key)) throw new Error(`SPLITS.json: ${key} is in both halves`);
      assigned.set(key, s);
    }
  }
  const out: LoadedPair[] = [];
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
      const split = assigned.get(`${language}/${name}`);
      if (split === undefined) {
        // Silence here would let a new pair join the tune half by default,
        // which is the failure the split exists to prevent.
        throw new Error(`SPLITS.json assigns no half to ${language}/${name}`);
      }
      out.push({
        name,
        split,
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
  const confirmSpend = process.argv.includes("--confirm-spend");
  const pairs = loadPairs();
  if (pairs.length < 20) {
    console.error(`corpus too small: ${pairs.length} pairs (< 20)`);
    process.exit(2);
  }

  // Spend gate: --judge fires one billable API call per length-controlled
  // pair (via the council client's curl transport). Estimate + halt unless
  // --confirm-spend is passed — mirrors council:run's explicit-confirm model,
  // never an interactive prompt. The objective-only default path is free.
  if (runJudge && !confirmSpend) {
    const controlledCount = pairs.filter((p) => {
      const b = analyzeText(p.before, p.language).words;
      const a = analyzeText(p.after, p.language).words;
      return Math.abs(1 - a / b) <= LENGTH_TOLERANCE;
    }).length;
    process.stderr.write(
      `--judge makes ${controlledCount} billable API call(s) (one per length-controlled pair). ` +
        `Re-run with --confirm-spend to authorize the spend. ` +
        `The objective-only run (no --judge) is free.\n`,
    );
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
      split: p.split,
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
      process.stdout.write(`  judged ${p.name}: prefers ${row.judge.preferred} (${row.judge.order})\n`);
    }
    results.push(row);
  }

  const mean = (xs: number[]) =>
    Math.round((xs.reduce((s, x) => s + x, 0) / Math.max(xs.length, 1)) * 100) / 100;
  /**
   * A density is `null` when the text sits under the detector's word floor, so
   * the rate was never computed. Averaging those as zero would report "measured
   * clean" for text nobody measured; they are dropped and the surviving
   * denominator is published beside the mean.
   */
  const meanDefined = (xs: Array<number | null>): { value: number | null; n: number } => {
    const defined = xs.filter((x): x is number => x !== null);
    return { value: defined.length === 0 ? null : mean(defined), n: defined.length };
  };
  const show = (m: { value: number | null; n: number }): string =>
    m.value === null ? `not evaluated (n=0)` : `${m.value} (n=${m.n})`;
  const aggregateOver = (rows: PairResult[]) => {
    const judgedRows = rows.filter((r) => r.judge);
    return {
      pairs: rows.length,
      length_controlled_pairs: rows.filter((r) => r.length_controlled).length,
      mean_hard_before: mean(rows.map((r) => r.before.hard_total)),
      mean_hard_after: mean(rows.map((r) => r.after.hard_total)),
      mean_cluster_before: meanDefined(rows.map((r) => r.before.cluster_score_per_500)),
      mean_cluster_after: meanDefined(rows.map((r) => r.after.cluster_score_per_500)),
      mean_dash_before: meanDefined(rows.map((r) => r.before.dash_density_per_500)),
      mean_dash_after: meanDefined(rows.map((r) => r.after.dash_density_per_500)),
      judged_pairs: judgedRows.length,
      prefers_after: judgedRows.filter((r) => r.judge!.preferred === "after").length,
      prefers_before: judgedRows.filter((r) => r.judge!.preferred === "before").length,
      judge_model: undefined as string | undefined,
    };
  };
  const agg = aggregateOver(results);
  const bySplit = {
    tune: aggregateOver(results.filter((r) => r.split === "tune")),
    holdout: aggregateOver(results.filter((r) => r.split === "holdout")),
  };
  if (runJudge) {
    const { DEFAULT_ANTHROPIC_MODEL } = await import("./ai_council/clients.js");
    agg.judge_model = DEFAULT_ANTHROPIC_MODEL as string;
    bySplit.tune.judge_model = agg.judge_model;
    bySplit.holdout.judge_model = agg.judge_model;
  }

  const iso = new Date().toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
  const payload = {
    generated: iso,
    corpus: "tests/fixtures/ai-tells",
    aggregate: agg,
    by_split: bySplit,
    results,
  };

  const md = [
    "# Humanizer paired eval — v1",
    "",
    `> Generated ${iso} · corpus \`tests/fixtures/ai-tells\` (${agg.pairs} before/after pairs, ` +
      `${agg.length_controlled_pairs} length-controlled ±${LENGTH_TOLERANCE * 100}%).`,
    "",
    "## Objective — AI-tell reduction (deterministic)",
    "",
    "Every figure names the split it came from. `tune` is the half a rule may be",
    "looked at while it is being written; `holdout` is scored and never read",
    "during authoring, so a gain that appears only in `tune` is overfitting and",
    "says so on its face. Split membership: `tests/fixtures/ai-tells/SPLITS.json`.",
    "",
    `| Metric (mean) | tune before (n=${bySplit.tune.pairs}) | tune after | holdout before (n=${bySplit.holdout.pairs}) | holdout after | both before (n=${agg.pairs}) | both after |`,
    "|---|---|---|---|---|---|---|",
    `| Hard hits | ${bySplit.tune.mean_hard_before} | ${bySplit.tune.mean_hard_after} | ` +
      `${bySplit.holdout.mean_hard_before} | ${bySplit.holdout.mean_hard_after} | ` +
      `${agg.mean_hard_before} | ${agg.mean_hard_after} |`,
    `| Cluster score /500w | ${show(bySplit.tune.mean_cluster_before)} | ${show(bySplit.tune.mean_cluster_after)} | ` +
      `${show(bySplit.holdout.mean_cluster_before)} | ${show(bySplit.holdout.mean_cluster_after)} | ` +
      `${show(agg.mean_cluster_before)} | ${show(agg.mean_cluster_after)} |`,
    `| Dash density /500w | ${show(bySplit.tune.mean_dash_before)} | ${show(bySplit.tune.mean_dash_after)} | ` +
      `${show(bySplit.holdout.mean_dash_before)} | ${show(bySplit.holdout.mean_dash_after)} | ` +
      `${show(agg.mean_dash_before)} | ${show(agg.mean_dash_after)} |`,
    "",
    "## Blind preference (length-controlled)",
    "",
    agg.judged_pairs > 0
      ? `Judge ${agg.judge_model}: prefers the humanized text in **${agg.prefers_after}/${agg.judged_pairs}** ` +
        `pairs across both halves — **${bySplit.tune.prefers_after}/${bySplit.tune.judged_pairs}** on tune, ` +
        `**${bySplit.holdout.prefers_after}/${bySplit.holdout.judged_pairs}** on holdout — ` +
        `(randomized A/B order, deterministic seed). An honest null here keeps the detector as a ` +
        `hygiene gate; the claim ledger only carries what this table shows.`
      : "_Not run (objective-only invocation)._",
    "",
    "## Scope note",
    "",
    "This eval measures the package's own pattern counts and a blind prose-quality preference.",
    'It never measures third-party "AI detector" outcomes — that claim class is banned',
    "(unfalsifiable from our side; see roadmap non-goals).",
    "",
    "## Open question — real-draft lift is unmeasured",
    "",
    "The `before` fixtures were **deliberately tell-seeded**, so a perfect score",
    "measures seeded-tell removal on a self-constructed corpus — NOT that real",
    "ghostwriter drafts get better. Real-world lift stays **unmeasured** until",
    "write-engine step 4b has processed real `/ghostwriter:write` drafts and those",
    "have been paired-evaluated (the `road-to-humanizer-hardening` live-usage",
    "blocker). The claim ledger is scoped to \"on the fixture corpus\" accordingly.",
    "",
  ].join("\n");

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, "humanizer-v1.json"), JSON.stringify(payload, null, 2));
  writeFileSync(join(REPORT_DIR, "humanizer-v1.md"), md);
  writeFileSync(join(REPORT_DIR, `${iso}-humanizer-v1.json`), JSON.stringify(payload, null, 2));
  writeFileSync(join(REPORT_DIR, `${iso}-humanizer-v1.md`), md);
  process.stdout.write(md + "\n");
}

main().catch((err) => {
  console.error(String(err));
  process.exit(2);
});
