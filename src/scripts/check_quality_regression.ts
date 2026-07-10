#!/usr/bin/env tsx
/**
 * Length-controlled paired judge + quality-regression gate (token-saving Phase 0).
 *
 * Proves OUTPUT QUALITY is held constant when a token lever changes the
 * projection (thin vs eager). Hand-rolled on the suite's existing Wilcoxon
 * layer (`bench_ab_v2_stats.wilcoxon`) — no `promptfoo` dependency (council
 * 2026-06-26: the bias controls are custom either way; the package is lean).
 *
 * Bias controls (the part that makes an LLM judge trustworthy):
 *   - **Position**: every pair is judged in BOTH orders (thin-first AND
 *     eager-first). A verdict that does not survive the swap is `inconsistent`
 *     and excluded — this is the "reject the judge if it flips" control, and it
 *     subsumes order-randomisation (we are position-balanced by construction).
 *   - **Length / verbosity**: per decisive win we record whether the winner was
 *     also the LONGER answer; the aggregate surfaces the length-confound rate so
 *     a win driven by verbosity bias (measured +17.3% in LLM judges) is visible.
 *
 * Two layers:
 *   LIBRARY (here, unit-tested with a mock judge): `evaluatePair` / `aggregate`
 *   / `gateVerdict` — the deterministic harness an operator's live runner calls.
 *   GATE (CLI): reads a completed run report and fails if thin's win-rate < the
 *   threshold (default 0.48). The live run (generate thin+eager answers, call a
 *   judge model) is the operator/cost step — until its report exists the gate is
 *   INERT (exit 0), so CI stays green.
 *
 * quality-run.json (produced by the operator's live runner via this library):
 *   { "threshold": 0.48, "judge_model": "...",
 *     "results": [ { "id", "winner": thin|eager|tie|inconsistent,
 *                    "length_delta": <int>, "winner_is_longer": bool|null } ] }
 *
 * CLI:
 *   ./scripts-run src/scripts/check_quality_regression            # gate (inert w/o run data)
 *   ./scripts-run src/scripts/check_quality_regression --json
 *   ./scripts-run src/scripts/check_quality_regression --threshold 0.48
 *   ./scripts-run src/scripts/check_quality_regression --as-flip-gate
 *
 * Flip-gate hardening (token-proof-and-story Phase 0):
 *   - A report with `dry_run: true` is NEVER an unlock — exit 2 in every mode.
 *     A mock report must not be indistinguishable from a pass in a script chain.
 *   - `--as-flip-gate` (used by the falsification checklist / the thin/scoped
 *     flip decision): "no report" and "no decisive pairs — inconclusive" are
 *     NOT unlocks → exit 2. Without the flag the CI-inert path keeps exit 0.
 *
 * Exit codes: 0 ok / inert · 1 file error · 2 quality regression, dry-run
 * report, or (under --as-flip-gate) missing/inconclusive report.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { wilcoxon } from './bench_ab_v2_stats.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const RUN_REPORT = path.join(REPO_ROOT, 'internal/bench/reports/quality-run.json');
const DEFAULT_THRESHOLD = 0.48;

export type Arm = 'thin' | 'eager';
/** A judge's preference between the two PRESENTED answers (order-relative). */
export type JudgeVerdict = 'first' | 'second' | 'tie';
/** The pluggable judge — a mock in tests, a model call in the live runner. */
export type JudgeFn = (
  ctx: { id: string; rubric: string },
  first: string,
  second: string,
) => JudgeVerdict;

export type PairWinner = 'thin' | 'eager' | 'tie' | 'inconsistent';

export interface PairResult {
  id: string;
  winner: PairWinner;
  length_delta: number; // chars(thin) - chars(eager)
  winner_is_longer: boolean | null; // null when tie/inconsistent
}

/**
 * Judge one (thin, eager) answer pair in BOTH orders and resolve the winner.
 * A verdict that flips with order is `inconsistent` (position bias → excluded).
 */
export function evaluatePair(
  task: { id: string; rubric: string },
  answerThin: string,
  answerEager: string,
  judge: JudgeFn,
): PairResult {
  const v1 = judge(task, answerThin, answerEager); // first=thin, second=eager
  const v2 = judge(task, answerEager, answerThin); // first=eager, second=thin
  const w1: PairWinner = v1 === 'first' ? 'thin' : v1 === 'second' ? 'eager' : 'tie';
  const w2: PairWinner = v2 === 'second' ? 'thin' : v2 === 'first' ? 'eager' : 'tie';

  const length_delta = answerThin.length - answerEager.length;
  let winner: PairWinner;
  if (w1 === 'tie' && w2 === 'tie') {
    winner = 'tie';
  } else if (w1 === w2) {
    winner = w1; // consistent decisive win (thin or eager)
  } else {
    winner = 'inconsistent'; // flipped or one-tie-one-decisive → not robust
  }

  let winner_is_longer: boolean | null = null;
  if (winner === 'thin') winner_is_longer = length_delta > 0;
  else if (winner === 'eager') winner_is_longer = length_delta < 0;

  return { id: task.id, winner, length_delta, winner_is_longer };
}

/**
 * Cohen's Kappa — chance-corrected agreement between two raters over the same
 * categorical labels (road-to-retrieval-substrate-hardening B7b). 1 = perfect,
 * 0 = chance-level, <0 = worse than chance. `NaN` when there is no data.
 */
export function cohensKappa(labelsA: readonly string[], labelsB: readonly string[]): number {
  const n = Math.min(labelsA.length, labelsB.length);
  if (n === 0) return Number.NaN;
  const cats = new Set<string>();
  for (let i = 0; i < n; i++) {
    cats.add(labelsA[i] as string);
    cats.add(labelsB[i] as string);
  }
  let observedAgree = 0;
  const countA = new Map<string, number>();
  const countB = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const a = labelsA[i] as string;
    const b = labelsB[i] as string;
    if (a === b) observedAgree += 1;
    countA.set(a, (countA.get(a) ?? 0) + 1);
    countB.set(b, (countB.get(b) ?? 0) + 1);
  }
  const po = observedAgree / n;
  let pe = 0;
  for (const c of cats) pe += ((countA.get(c) ?? 0) / n) * ((countB.get(c) ?? 0) / n);
  if (pe === 1) return 1; // both raters unanimous on one label → perfect by convention
  return Math.round(((po - pe) / (1 - pe)) * 10000) / 10000;
}

/**
 * Second-independent-judge validation: Cohen's Kappa over the two judges'
 * per-pair winner labels (aligned by task id). A LOW kappa means the win-rate
 * verdict rests on an unreliable grader — the trustworthiness gap the
 * token-saving live run surfaced (33% judge-inconsistency), distinct from the
 * effect-significance the Wilcoxon/McNemar gates already test.
 */
export function judgeKappa(resultsA: readonly PairResult[], resultsB: readonly PairResult[]): number {
  const byIdB = new Map(resultsB.map((r) => [r.id, r.winner]));
  const a: string[] = [];
  const b: string[] = [];
  for (const r of resultsA) {
    const bw = byIdB.get(r.id);
    if (bw !== undefined) {
      a.push(r.winner);
      b.push(bw);
    }
  }
  return cohensKappa(a, b);
}

export interface QualityAggregate {
  total: number;
  thin_wins: number;
  eager_wins: number;
  ties: number;
  inconsistent: number;
  decisive: number;
  thin_win_rate: number | null; // thin_wins / decisive
  inconsistency_rate: number | null; // inconsistent / total (judge-reliability health)
  length_confound_rate: number | null; // share of decisive wins where winner was longer
  wilcoxon_p: number | null;
  verdict: 'ok' | 'regression' | 'no-data';
}

/** Aggregate per-pair results into a win-rate + bias diagnostics + Wilcoxon. */
export function aggregate(results: PairResult[], threshold = DEFAULT_THRESHOLD): QualityAggregate {
  const total = results.length;
  let thin_wins = 0;
  let eager_wins = 0;
  let ties = 0;
  let inconsistent = 0;
  let longerWins = 0;
  const diffs: number[] = [];
  for (const r of results) {
    if (r.winner === 'thin') {
      thin_wins += 1;
      diffs.push(1);
      if (r.winner_is_longer) longerWins += 1;
    } else if (r.winner === 'eager') {
      eager_wins += 1;
      diffs.push(-1);
      if (r.winner_is_longer) longerWins += 1;
    } else if (r.winner === 'tie') {
      ties += 1;
      diffs.push(0);
    } else {
      inconsistent += 1;
      diffs.push(0);
    }
  }
  const decisive = thin_wins + eager_wins;
  const thin_win_rate = decisive > 0 ? thin_wins / decisive : null;
  const wil = wilcoxon(diffs);
  const verdict: QualityAggregate['verdict'] =
    thin_win_rate === null ? 'no-data' : thin_win_rate < threshold ? 'regression' : 'ok';
  return {
    total,
    thin_wins,
    eager_wins,
    ties,
    inconsistent,
    decisive,
    thin_win_rate,
    inconsistency_rate: total > 0 ? inconsistent / total : null,
    length_confound_rate: decisive > 0 ? longerWins / decisive : null,
    wilcoxon_p: wil.n > 0 ? wil.p : null,
    verdict,
  };
}

/** Gate exit code from an aggregate. */
export function gateVerdict(agg: QualityAggregate): 0 | 2 {
  return agg.verdict === 'regression' ? 2 : 0;
}

interface RunReport {
  threshold?: number;
  dry_run?: boolean;
  results?: PairResult[];
}

function main(argv: string[]): number {
  let asJson = false;
  let asFlipGate = false;
  let threshold = DEFAULT_THRESHOLD;
  let reportPath = RUN_REPORT;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') asJson = true;
    else if (a === '--as-flip-gate') asFlipGate = true;
    else if (a === '--report') {
      const v = argv[(i += 1)];
      if (!v) {
        process.stderr.write('error: --report requires a path\n');
        return 1;
      }
      reportPath = path.resolve(v);
    } else if (a === '--threshold') {
      const v = Number(argv[(i += 1)]);
      if (!Number.isFinite(v) || v < 0 || v > 1) {
        process.stderr.write('error: --threshold must be in [0,1]\n');
        return 1;
      }
      threshold = v;
    } else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'usage: check_quality_regression [--json] [--threshold F] [--as-flip-gate] [--report PATH]\n',
      );
      return 0;
    } else {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
  }

  if (!fs.existsSync(reportPath)) {
    if (asFlipGate) {
      const msg =
        `❌  flip gate: no quality-run report (${path.relative(REPO_ROOT, reportPath)}) — ` +
        'a flip requires a real judge run. NOT an unlock.';
      if (asJson) process.stdout.write(JSON.stringify({ verdict: 'no-data', flip_gate: true, unlock: false }, null, 2) + '\n');
      else process.stdout.write(msg + '\n');
      return 2;
    }
    const msg =
      `⚠️  no quality-run report (${path.relative(REPO_ROOT, reportPath)}) — ` +
      'gate inert. Produce it with a thin-vs-eager judge run (operator/cost gate).';
    if (asJson) process.stdout.write(JSON.stringify({ verdict: 'no-data', inert: true }, null, 2) + '\n');
    else process.stdout.write(msg + '\n');
    return 0;
  }

  let report: RunReport;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as RunReport;
  } catch (e) {
    process.stderr.write(`error: cannot parse ${path.relative(REPO_ROOT, reportPath)}: ${(e as Error).message}\n`);
    return 1;
  }

  if (report.dry_run === true) {
    const msg =
      '❌  quality-run report is a DRY-RUN mock (`dry_run: true`) — a mock is never an unlock.\n' +
      '   Re-run the judge live (bench_quality_run without --dry-run) or delete the mock report.';
    if (asJson) process.stdout.write(JSON.stringify({ verdict: 'dry-run', unlock: false }, null, 2) + '\n');
    else process.stdout.write(msg + '\n');
    return 2;
  }

  const results = Array.isArray(report.results) ? report.results : [];
  const thr = typeof report.threshold === 'number' ? report.threshold : threshold;
  const agg = aggregate(results, thr);

  if (asJson) {
    process.stdout.write(JSON.stringify({ ...agg, threshold: thr, flip_gate: asFlipGate }, null, 2) + '\n');
  } else {
    process.stdout.write(
      `quality run: ${agg.total} pairs · thin ${agg.thin_wins} / eager ${agg.eager_wins} / ` +
        `tie ${agg.ties} / inconsistent ${agg.inconsistent}\n` +
        `  thin win-rate ${agg.thin_win_rate === null ? 'n/a' : (agg.thin_win_rate * 100).toFixed(1) + '%'} ` +
        `(threshold ${(thr * 100).toFixed(0)}%) · ` +
        `length-confound ${agg.length_confound_rate === null ? 'n/a' : (agg.length_confound_rate * 100).toFixed(0) + '%'} · ` +
        `inconsistency ${agg.inconsistency_rate === null ? 'n/a' : (agg.inconsistency_rate * 100).toFixed(0) + '%'}\n`,
    );
    if (agg.verdict === 'regression') {
      process.stdout.write(`❌  quality regression: thin win-rate below ${(thr * 100).toFixed(0)}%.\n`);
    } else if (agg.verdict === 'no-data') {
      if (asFlipGate) {
        process.stdout.write(`❌  flip gate: no decisive pairs — inconclusive is NOT an unlock.\n`);
      } else {
        process.stdout.write(`⚠️  no decisive pairs — inconclusive.\n`);
      }
    } else {
      process.stdout.write(`✅  quality held: thin win-rate within tolerance.\n`);
    }
  }
  const code = gateVerdict(agg);
  if (code === 0 && asFlipGate && agg.verdict === 'no-data') return 2;
  return code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _IS_MAIN =
  _isCliEntry();

if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
