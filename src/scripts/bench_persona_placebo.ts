#!/usr/bin/env tsx
/**
 * Persona-placebo benchmark (road-to-opt-council-deliberation Phase 4).
 *
 * Settles Source G's centerpiece claim by MEASUREMENT: does a famous-figure
 * identity framing add judged quality beyond the method text it wraps?
 *
 * Three arms per fixture × provider (pre-registered):
 *   method — one of the five shipped advisor personas as the system prompt;
 *   figure — the SAME persona text, only the identity framing swapped to a
 *            (deceased) famous figure — text constant, identity varies;
 *   bare   — a neutral advisor system prompt, no persona.
 * Providers: anthropic (sonnet) + openai (gpt-4o) — the cross-provider axis;
 * the per-provider split of the same data is the single-provider replication.
 *
 * Blind judging: the judge (opus) scores each answer 1–10 against the
 * fixture's pre-registered rubric and NEVER sees arm labels or persona names.
 *
 * Pre-registered hypotheses:
 *   H1: method ≈ figure on judged quality (identity adds nothing);
 *   H2: provider diversity moves scores more than persona identity.
 *
 * CLI: --dry-run | [--max-usd N] [--limit N] [--output PATH]
 * Exit: 0 wrote report · 1 error · 2 budget abort.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'js-yaml';

import { signTestP } from './second_brain_retrieval.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'internal/bench/corpora/persona-placebo.yaml');
const PERSONA_DIR = path.join(REPO_ROOT, 'src/agent-src/personas/advisors');
const OUT = path.join(REPO_ROOT, 'internal/bench/reports/persona-placebo.json');

export const ARMS = ['method', 'figure', 'bare'] as const;
export type Arm = (typeof ARMS)[number];

/** Persona → deceased famous figure (identity swap for the `figure` arm). */
export const FIGURE_MAP: Record<string, string> = {
  'first-principles': 'Richard Feynman',
  contrarian: 'Charlie Munger',
  executor: 'Grace Hopper',
  expansionist: 'Ada Lovelace',
  outsider: 'Alan Turing',
};

const PRICES: Array<{ needle: string; in_usd: number; out_usd: number }> = [
  { needle: 'opus', in_usd: 15.0, out_usd: 75.0 },
  { needle: 'sonnet', in_usd: 3.0, out_usd: 15.0 },
  { needle: 'gpt-4o', in_usd: 2.5, out_usd: 10.0 },
];
export function price_usd(model: string, i: number, o: number): number {
  const p = PRICES.find((x) => model.includes(x.needle));
  return p === undefined ? 0 : (i / 1e6) * p.in_usd + (o / 1e6) * p.out_usd;
}

export interface Fixture {
  id: string;
  prompt: string;
  rubric: string;
}

export function load_fixtures(file = CORPUS): Fixture[] {
  const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as { fixtures?: unknown[] };
  return (Array.isArray(doc?.fixtures) ? doc.fixtures : []).map((f) => {
    const r = f as Record<string, unknown>;
    return { id: String(r.id), prompt: String(r.prompt), rubric: String(r.rubric) };
  });
}

export function load_personas(dir = PERSONA_DIR): Array<{ name: string; text: string }> {
  return Object.keys(FIGURE_MAP)
    .sort()
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, `${name}.md`), 'utf-8') }));
}

/** Arm system prompts — `figure` holds the method text CONSTANT, swapping only identity. */
export function system_for(arm: Arm, persona: { name: string; text: string }): string {
  if (arm === 'bare') {
    return 'You are a senior engineering advisor. Answer the decision question with a firm recommendation.';
  }
  if (arm === 'method') {
    return `You are an advisor working strictly by the following method:\n\n${persona.text}\n\nAnswer the decision question with a firm recommendation.`;
  }
  const figure = FIGURE_MAP[persona.name] as string;
  return `You are ${figure}. Answer as ${figure} would, working strictly by the following method:\n\n${persona.text}\n\nAnswer the decision question with a firm recommendation.`;
}

export function judge_prompt(rubric: string, answer: string): string {
  return (
    `Score the answer below against this rubric on a 1-10 scale (10 = fully satisfies).\n` +
    `Judge ONLY rubric satisfaction — ignore style, length, and who might have written it.\n\n` +
    `Rubric: ${rubric}\n\n--- ANSWER ---\n${answer}\n\n` +
    `Reply with exactly one line: "SCORE: <1-10>".`
  );
}

export function parse_score(reply: string): number | null {
  const m = /SCORE:\s*(\d{1,2})/i.exec(reply);
  if (!m) return null;
  const v = Number(m[1]);
  return v >= 1 && v <= 10 ? v : null;
}

export function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

interface Args {
  dryRun: boolean;
  limit: number | null;
  maxUsd: number;
  output: string;
}

function parse_args(argv: string[]): Args | number {
  const a: Args = { dryRun: false, limit: null, maxUsd: 50, output: OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--limit') a.limit = Number(argv[(i += 1)]);
    else if (arg === '--max-usd') a.maxUsd = Number(argv[(i += 1)]);
    else if (arg === '--output') a.output = String(argv[(i += 1)] ?? a.output);
    else if (arg === '-h' || arg === '--help') {
      process.stdout.write('usage: bench_persona_placebo [--dry-run] [--limit N] [--max-usd X] [--output PATH]\n');
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

  let fixtures = load_fixtures();
  if (args.limit !== null && Number.isInteger(args.limit) && args.limit > 0) fixtures = fixtures.slice(0, args.limit);
  const personas = load_personas();

  let spent = 0;
  const guard = (model: string, i: number, o: number): void => {
    spent += price_usd(model, i, o);
    if (spent > args.maxUsd) {
      process.stderr.write(`\n❌  budget abort: $${spent.toFixed(2)} > cap $${args.maxUsd}\n`);
      process.exit(2);
    }
  };

  const GEN_MODELS: Array<{ provider: string; model: string }> = [
    { provider: 'anthropic', model: 'claude-sonnet-4-5' },
    { provider: 'openai', model: 'gpt-4o' },
  ];
  const JUDGE_MODEL = 'claude-opus-4-8';

  let clients: Map<string, AskClient>;
  let judge: AskClient;
  if (args.dryRun) {
    let n = 0;
    const mk = (): AskClient => ({
      ask: (_s: string, u: string) => ({
        text: /SCORE/.test(u) || /ANSWER/.test(u) ? `SCORE: ${5 + ((n += 1) % 3)}` : `mock answer ${(n += 1)}`,
        input_tokens: 200,
        output_tokens: 100,
      }),
    });
    clients = new Map(GEN_MODELS.map((g) => [g.provider, mk()]));
    judge = mk();
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
    clients = new Map([
      ['anthropic', new c.AnthropicClient({ model: 'claude-sonnet-4-5', api_key: akey }) as AskClient],
      ['openai', new c.OpenAIClient({ model: 'gpt-4o', api_key: c.load_openai_key() }) as AskClient],
    ]);
    judge = new c.AnthropicClient({ model: JUDGE_MODEL, api_key: akey });
    process.stdout.write(
      `Live run: ${fixtures.length} fixtures × 3 arms × ${GEN_MODELS.length} providers (+ blind judge). Cap $${args.maxUsd}.\n`,
    );
  }

  // ── Generate + blind-judge every (fixture × provider × arm) cell ──────────
  interface Cell {
    fixture: string;
    provider: string;
    arm: Arm;
    persona: string;
    score: number | null;
  }
  const cells: Cell[] = [];
  fixtures.forEach((fx, i) => {
    const persona = personas[i % personas.length] as { name: string; text: string };
    for (const g of GEN_MODELS) {
      const client = clients.get(g.provider) as AskClient;
      for (const arm of ARMS) {
        const r = client.ask(system_for(arm, persona), fx.prompt);
        guard(g.model, r.input_tokens, r.output_tokens);
        const j = judge.ask('You are a strict rubric judge.', judge_prompt(fx.rubric, r.text));
        guard(JUDGE_MODEL, j.input_tokens, j.output_tokens);
        cells.push({ fixture: fx.id, provider: g.provider, arm, persona: persona.name, score: parse_score(j.text) });
      }
      process.stdout.write(`  ${fx.id} × ${g.provider} done ($${spent.toFixed(2)})\n`);
    }
  });

  // ── Stats (pre-registered) ─────────────────────────────────────────────────
  const scores = (arm: Arm, provider?: string): number[] =>
    cells
      .filter((c) => c.arm === arm && c.score !== null && (provider === undefined || c.provider === provider))
      .map((c) => c.score as number);
  const arm_means: Record<string, number> = {};
  for (const arm of ARMS) {
    arm_means[arm] = mean(scores(arm));
    for (const g of GEN_MODELS) arm_means[`${arm}:${g.provider}`] = mean(scores(arm, g.provider));
  }
  // H1: paired method-vs-figure per (fixture × provider)
  let mfWins = 0;
  let mfLosses = 0;
  for (const fx of fixtures) {
    for (const g of GEN_MODELS) {
      const m = cells.find((c) => c.fixture === fx.id && c.provider === g.provider && c.arm === 'method')?.score;
      const f = cells.find((c) => c.fixture === fx.id && c.provider === g.provider && c.arm === 'figure')?.score;
      if (typeof m === 'number' && typeof f === 'number' && m !== f) {
        if (m > f) mfWins += 1;
        else mfLosses += 1;
      }
    }
  }
  const h1_p = signTestP(mfWins, mfLosses);
  const identity_delta = Math.abs((arm_means['method'] as number) - (arm_means['figure'] as number));
  const provider_delta = mean(
    ARMS.map((a) => Math.abs((arm_means[`${a}:anthropic`] as number) - (arm_means[`${a}:openai`] as number))),
  );
  const h2_holds = provider_delta > identity_delta;
  const persona_lift = Math.max(
    (arm_means['method'] as number) - (arm_means['bare'] as number),
    (arm_means['figure'] as number) - (arm_means['bare'] as number),
  );

  const verdict =
    h1_p >= 0.05 && identity_delta < 0.5
      ? `honest-null: identity framing adds nothing beyond the method text (Δ=${identity_delta.toFixed(2)}, p=${h1_p.toFixed(3)}); provider diversity ${h2_holds ? 'dominates' : 'does NOT dominate'} persona identity (provider Δ=${provider_delta.toFixed(2)})`
      : `signal: method-vs-figure differ (Δ=${identity_delta.toFixed(2)}, p=${h1_p.toFixed(3)}) — inspect per-arm means before any adoption`;

  const payload = {
    generated_by: 'bench_persona_placebo',
    dry_run: args.dryRun,
    preregistered: {
      hypotheses: ['H1: method ≈ figure (identity adds nothing beyond method text)', 'H2: provider diversity > persona identity'],
      fixtures: fixtures.length,
      arms: ARMS,
      providers: GEN_MODELS.map((g) => g.provider),
      judge: JUDGE_MODEL,
      blind: 'judge never sees arm labels or persona names',
    },
    arm_means,
    h1: { method_wins: mfWins, figure_wins: mfLosses, sign_p: h1_p, identity_delta },
    h2: { provider_delta, identity_delta, holds: h2_holds },
    persona_lift_vs_bare: persona_lift,
    cells,
    cost_usd_actual: Number(spent.toFixed(4)),
    verdict,
  };
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(payload, null, 2) + '\n');
  process.stdout.write(
    `\n→ wrote ${path.relative(REPO_ROOT, args.output)}\n` +
      `   means: method=${(arm_means['method'] as number).toFixed(2)} figure=${(arm_means['figure'] as number).toFixed(2)} bare=${(arm_means['bare'] as number).toFixed(2)} · H1 p=${h1_p.toFixed(3)} · $${spent.toFixed(2)}\n` +
      `   VERDICT: ${verdict}\n`,
  );
  return 0;
}

function _isCliEntry(): boolean {
  if (process.argv[1] === undefined) return false;
  if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
  } catch {
    return false;
  }
}
if (_isCliEntry()) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
