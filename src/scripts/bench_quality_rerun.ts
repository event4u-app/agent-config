#!/usr/bin/env tsx
/**
 * Length-neutral thin-vs-eager judge RERUN (road-to-opt-measurement-unblock
 * Phase 1; design: docs/design/length-neutral-judge-rerun.md).
 *
 * The 2026-07-09/11 runs were untrustworthy on three recorded failure modes;
 * this rerun fixes each BY CONSTRUCTION:
 *   (a) length confound — pairs outside a ±15% output-token band are DROPPED
 *       (reported, never silently discarded) AND a Spearman-ρ win-vs-length
 *       diagnostic flags residual leakage (|ρ| ≥ 0.3 → verdict withheld);
 *   (b) judge inconsistency — TWO arm-blind judges from different provider
 *       families (strongest Anthropic tier + OpenAI), each judging both orders
 *       (reject-on-flip), reported as Cohen's κ with a ≥ 0.60 admissibility
 *       floor (`judgeKappa` — its first production caller);
 *   (c) underpowered — n is PRE-REGISTERED as the full labelled corpus before
 *       the first billable call; the achievable power at the corpus size is
 *       stated honestly in the report (corpus-limited, not grown post-hoc).
 *
 * Budget: --max-usd guard — cumulative actual spend (usage × PRICES) aborts
 * the run before the call that would breach the cap.
 *
 * CLI:
 *   ./scripts-run src/scripts/bench_quality_rerun --dry-run
 *   ./scripts-run src/scripts/bench_quality_rerun --max-usd 250 [--limit N]
 *     [--gen-model claude-sonnet-4-5] [--judge1 claude-opus-4-8] [--judge2 gpt-4o]
 *
 * Exit codes: 0 wrote report · 1 error · 2 budget abort.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  assemble_contexts,
  judge_prompt,
  load_golden,
  parse_verdict,
  type GoldenTask,
} from './bench_quality_run.js';
import {
  evaluatePair,
  judgeKappa,
  type JudgeFn,
  type PairResult,
} from './check_quality_regression.js';
import { signTestP } from './second_brain_retrieval.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const OUT = path.join(REPO_ROOT, 'internal/bench/reports/quality-rerun-length-neutral.json');

/** Pre-registered analysis constants — fixed BEFORE the first billable call. */
export const PAIR_BAND = 0.15; // ±15% output-token band
export const KAPPA_FLOOR = 0.6;
export const SPEARMAN_FLAG = 0.3; // |ρ| at or above → length-confounded
export const EFFECT_FLOOR_PP = 10; // smallest effect worth shipping (pp from 50%)

/** USD per 1M tokens (mirrors internal/bench/pricing.yaml + public OpenAI). */
const PRICES: Array<{ needle: string; in_usd: number; out_usd: number }> = [
  { needle: 'opus', in_usd: 15.0, out_usd: 75.0 },
  { needle: 'sonnet', in_usd: 3.0, out_usd: 15.0 },
  { needle: 'haiku', in_usd: 0.25, out_usd: 1.25 },
  { needle: 'gpt-4o', in_usd: 2.5, out_usd: 10.0 },
];

export function price_usd(model: string, in_tok: number, out_tok: number): number {
  const p = PRICES.find((x) => model.includes(x.needle));
  if (p === undefined) return 0;
  return (in_tok / 1e6) * p.in_usd + (out_tok / 1e6) * p.out_usd;
}

/** ±band pairing filter on output tokens. */
export function within_band(thinTok: number, eagerTok: number, band = PAIR_BAND): boolean {
  const mx = Math.max(thinTok, eagerTok);
  if (mx === 0) return true;
  return Math.abs(thinTok - eagerTok) / mx <= band;
}

/** Spearman rank correlation (average-rank ties). */
export function spearman(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const rank = (v: readonly number[]): number[] => {
    const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && (idx[j + 1] as [number, number])[0] === (idx[i] as [number, number])[0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[(idx[k] as [number, number])[1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs.slice(0, n));
  const ry = rank(ys.slice(0, n));
  const mean = (n + 1) / 2;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = (rx[i] as number) - mean;
    const b = (ry[i] as number) - mean;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export interface RerunVerdictInput {
  kappa: number;
  rho: number;
  agreed_thin: number;
  agreed_eager: number;
}

/** Pre-registered verdict logic (pure). */
export function decide_verdict(v: RerunVerdictInput): string {
  if (!Number.isFinite(v.kappa) || v.kappa < KAPPA_FLOOR) {
    return `inconclusive-low-kappa (κ=${v.kappa.toFixed(2)} < ${KAPPA_FLOOR})`;
  }
  if (Math.abs(v.rho) >= SPEARMAN_FLAG) {
    return `inconclusive-length-confounded (|ρ|=${Math.abs(v.rho).toFixed(2)} ≥ ${SPEARMAN_FLAG})`;
  }
  const n = v.agreed_thin + v.agreed_eager;
  if (n === 0) return 'inconclusive-no-decisive-pairs';
  const p = signTestP(v.agreed_thin, v.agreed_eager);
  const rate = v.agreed_thin / n;
  const pp = Math.abs(rate - 0.5) * 100;
  if (p < 0.05 && pp >= EFFECT_FLOOR_PP) {
    return rate > 0.5
      ? `ships-lift (thin wins ${(rate * 100).toFixed(1)}%, p=${p.toFixed(4)})`
      : `honest-null-thin-loses (thin ${(rate * 100).toFixed(1)}%, p=${p.toFixed(4)})`;
  }
  return `inconclusive-underpowered (p=${p.toFixed(4)}, effect ${pp.toFixed(1)}pp, n=${n})`;
}

interface Args {
  dryRun: boolean;
  genModel: string;
  judge1: string;
  judge2: string;
  limit: number | null;
  maxUsd: number;
  output: string;
}

function parse_args(argv: string[]): Args | number {
  const a: Args = {
    dryRun: false,
    genModel: 'claude-sonnet-4-5',
    judge1: 'claude-opus-4-8',
    judge2: 'gpt-4o',
    limit: null,
    maxUsd: 250,
    output: OUT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--gen-model') a.genModel = String(argv[(i += 1)] ?? a.genModel);
    else if (arg === '--judge1') a.judge1 = String(argv[(i += 1)] ?? a.judge1);
    else if (arg === '--judge2') a.judge2 = String(argv[(i += 1)] ?? a.judge2);
    else if (arg === '--output') a.output = String(argv[(i += 1)] ?? a.output);
    else if (arg === '--limit') a.limit = Number(argv[(i += 1)]);
    else if (arg === '--max-usd') a.maxUsd = Number(argv[(i += 1)]);
    else if (arg === '-h' || arg === '--help') {
      process.stdout.write(
        'usage: bench_quality_rerun [--dry-run] [--gen-model M] [--judge1 M] [--judge2 M] [--limit N] [--max-usd X] [--output PATH]\n',
      );
      return 0;
    } else {
      process.stderr.write(`error: unknown argument: ${arg}\n`);
      return 1;
    }
  }
  return a;
}

interface AskClient {
  ask(system: string, user: string): { text: string; input_tokens: number; output_tokens: number };
}

function main(argv: string[]): number {
  const parsed = parse_args(argv);
  if (typeof parsed === 'number') return parsed;
  const args = parsed;

  let tasks = load_golden();
  if (args.limit !== null && Number.isInteger(args.limit) && args.limit > 0) {
    tasks = tasks.slice(0, args.limit);
  }
  const preregistered_n = tasks.length;
  const contexts = assemble_contexts();

  let spent = 0;
  const guard = (model: string, in_tok: number, out_tok: number): void => {
    spent += price_usd(model, in_tok, out_tok);
    if (spent > args.maxUsd) {
      process.stderr.write(`\n❌  budget abort: cumulative $${spent.toFixed(2)} > cap $${args.maxUsd}\n`);
      process.exit(2);
    }
  };

  let gen: AskClient;
  let j1: AskClient;
  let j2: AskClient;
  if (args.dryRun) {
    let flip = 0;
    const mk = (): AskClient => ({
      ask: (_s: string, u: string) => ({
        text: /VERDICT/.test(u) || /ANSWER A/.test(u) ? 'VERDICT: TIE' : `mock answer ${(flip += 1)}`,
        input_tokens: 100,
        output_tokens: 50,
      }),
    });
    gen = mk();
    j1 = mk();
    j2 = mk();
    process.stdout.write('⚠️  --dry-run: deterministic mock, no API.\n');
  } else {
    const require = createRequire(import.meta.url);
    const c = require('./ai_council/clients.js') as {
      AnthropicClient: new (o: { model: string; api_key: string }) => AskClient;
      OpenAIClient: new (o: { model: string; api_key: string }) => AskClient;
      load_anthropic_key: () => string;
      load_openai_key: () => string;
    };
    const akey = c.load_anthropic_key();
    gen = new c.AnthropicClient({ model: args.genModel, api_key: akey });
    j1 = new c.AnthropicClient({ model: args.judge1, api_key: akey });
    j2 = new c.OpenAIClient({ model: args.judge2, api_key: c.load_openai_key() });
    process.stdout.write(
      `Live rerun: n=${preregistered_n} (pre-registered) × 2 arms; judges ${args.judge1} + ${args.judge2}; cap $${args.maxUsd}.\n`,
    );
  }

  // ── Generation (thin + eager per task, output tokens recorded) ────────────
  const SYS =
    'You are an AI coding agent governed by the following always-loaded package rules. ' +
    'Answer the user request as that agent would, honouring these rules:\n\n';
  interface Gen {
    task: GoldenTask;
    thin: string;
    eager: string;
    thin_tok: number;
    eager_tok: number;
  }
  const gens: Gen[] = [];
  for (const task of tasks) {
    const rt = gen.ask(SYS + contexts.thin, task.prompt);
    guard(args.genModel, rt.input_tokens, rt.output_tokens);
    const re = gen.ask(SYS + contexts.eager, task.prompt);
    guard(args.genModel, re.input_tokens, re.output_tokens);
    gens.push({ task, thin: rt.text, eager: re.text, thin_tok: rt.output_tokens, eager_tok: re.output_tokens });
    process.stdout.write(`  gen ${task.id} (thin ${rt.output_tokens}t / eager ${re.output_tokens}t) $${spent.toFixed(2)}\n`);
  }

  // ── Pairing filter (±band on output tokens) ───────────────────────────────
  const surviving = gens.filter((g) => within_band(g.thin_tok, g.eager_tok));
  const dropped = gens.filter((g) => !within_band(g.thin_tok, g.eager_tok));
  process.stdout.write(`pairing: ${surviving.length} surviving / ${dropped.length} dropped (±${PAIR_BAND * 100}% band)\n`);

  // ── Two blind judges, both orders each ────────────────────────────────────
  const judgeWith = (client: AskClient, model: string): PairResult[] =>
    surviving.map((g) => {
      const fn: JudgeFn = (_ctx, first, second) => {
        const r = client.ask('You are a strict, length-neutral answer judge.', judge_prompt(g.task, first, second));
        guard(model, r.input_tokens, r.output_tokens);
        return parse_verdict(r.text);
      };
      return evaluatePair(g.task, g.thin, g.eager, fn);
    });
  const r1 = judgeWith(j1, args.judge1);
  const r2 = judgeWith(j2, args.judge2);

  // ── Stats (pre-registered) ─────────────────────────────────────────────────
  const kappa = judgeKappa(r1, r2);
  const byId2 = new Map(r2.map((r) => [r.id, r.winner]));
  const agreed = r1.filter(
    (r) => (r.winner === 'thin' || r.winner === 'eager') && byId2.get(r.id) === r.winner,
  );
  const agreed_thin = agreed.filter((r) => r.winner === 'thin').length;
  const agreed_eager = agreed.filter((r) => r.winner === 'eager').length;
  const tokDelta = new Map(surviving.map((g) => [g.task.id, g.thin_tok - g.eager_tok]));
  const rho = spearman(
    agreed.map((r) => tokDelta.get(r.id) ?? 0),
    agreed.map((r) => (r.winner === 'thin' ? 1 : -1)),
  );
  const p = signTestP(agreed_thin, agreed_eager);
  const verdict = decide_verdict({ kappa, rho, agreed_thin, agreed_eager });

  const payload = {
    generated_by: 'bench_quality_rerun',
    design: 'docs/design/length-neutral-judge-rerun.md',
    dry_run: args.dryRun,
    gen_model: args.genModel,
    judges: [args.judge1, args.judge2],
    preregistered: {
      n: preregistered_n,
      pair_band: PAIR_BAND,
      kappa_floor: KAPPA_FLOOR,
      spearman_flag: SPEARMAN_FLAG,
      effect_floor_pp: EFFECT_FLOOR_PP,
      power_note:
        'n is corpus-limited (all labelled golden tasks); 80% power at ≥10pp needs ~190 decisive pairs — achievable power at this n is lower and stated rather than grown post-hoc.',
    },
    pairing: {
      surviving: surviving.length,
      dropped: dropped.length,
      dropped_ids: dropped.map((g) => g.task.id),
    },
    judge_agreement: { kappa, kappa_floor: KAPPA_FLOOR },
    length_diagnostic: { spearman_rho: rho, flag_at: SPEARMAN_FLAG, flagged: Math.abs(rho) >= SPEARMAN_FLAG },
    result: {
      agreed_decisive: agreed.length,
      agreed_thin,
      agreed_eager,
      sign_test_p: p,
      thin_win_rate: agreed.length > 0 ? agreed_thin / agreed.length : null,
    },
    judge1_results: r1,
    judge2_results: r2,
    cost_usd_actual: Number(spent.toFixed(4)),
    verdict,
  };
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(payload, null, 2) + '\n');
  process.stdout.write(
    `\n→ wrote ${path.relative(REPO_ROOT, args.output)}\n` +
      `   κ=${Number.isFinite(kappa) ? kappa.toFixed(3) : 'NaN'} · ρ=${rho.toFixed(3)} · agreed thin ${agreed_thin} / eager ${agreed_eager} · p=${p.toFixed(4)} · $${spent.toFixed(2)}\n` +
      `   VERDICT: ${verdict}\n`,
  );
  return 0;
}

function _isCliEntry(): boolean {
  if (process.argv[1] === undefined) return false;
  if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
  try {
    return (
      fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]))
    );
  } catch {
    return false;
  }
}
if (_isCliEntry()) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
