#!/usr/bin/env tsx
/**
 * Thin-vs-eager quality-run producer (token-saving Phase 0 EXIT).
 *
 * The missing RUNNER that produces `internal/bench/reports/quality-run.json` —
 * the report the `check_quality_regression` gate consumes. For each labelled
 * golden task it generates the agent's answer under the THIN rule context
 * (kernel bodies + non-kernel pointers) and the EAGER context (all rule bodies),
 * then judges the pair with the length-controlled paired judge
 * (`evaluatePair`: both orders → reject-on-flip).
 *
 * Model calls (answer generation + judging) go through the proven council
 * `AnthropicClient` (synchronous curl → Anthropic Messages API) — so this is
 * **API-gated**: a real run needs an Anthropic key and costs money proportional
 * to (golden tasks × 2 arms + 2 judge calls) × the rule-context size. Use
 * `--dry-run` (deterministic mock, no API) to prove the pipeline + see the
 * output shape first, and `--limit N` to bound a live run.
 *
 * CLI:
 *   ./scripts-run src/scripts/bench_quality_run --dry-run            # mock, no API
 *   ./scripts-run src/scripts/bench_quality_run --limit 5            # live, first 5 tasks
 *   ./scripts-run src/scripts/bench_quality_run --model claude-sonnet-4-5
 * Then gate on it: ./scripts-run src/scripts/check_quality_regression
 *
 * Exit codes: 0 wrote report · 1 error.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'js-yaml';

import { build_thin, RULES_SOURCE } from './project_thin_rules.js';
import { evaluatePair, type JudgeFn, type JudgeVerdict, type PairResult } from './check_quality_regression.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const GOLDEN = path.join(REPO_ROOT, 'internal/bench/corpora/token-quality-golden.yaml');
const OUT = path.join(REPO_ROOT, 'internal/bench/reports/quality-run.json');
const DEFAULT_THRESHOLD = 0.48;

export interface GoldenTask {
  id: string;
  rubric: string;
  prompt: string;
  must_include: string[];
  must_not: string[];
}

/** Load the labelled golden tasks (stubs are skipped — they have no real rubric). */
export function load_golden(file = GOLDEN): GoldenTask[] {
  const doc = yaml.load(fs.readFileSync(file, 'utf-8')) as { tasks?: unknown[] };
  const tasks = Array.isArray(doc?.tasks) ? doc.tasks : [];
  const out: GoldenTask[] = [];
  for (const t of tasks as Array<Record<string, unknown>>) {
    if (t.label_status !== 'labelled') continue;
    const exp = (t.expected ?? {}) as Record<string, unknown>;
    out.push({
      id: String(t.id),
      rubric: String(exp.rubric ?? ''),
      prompt: String(t.prompt ?? ''),
      must_include: Array.isArray(exp.must_include) ? exp.must_include.map(String) : [],
      must_not: Array.isArray(exp.must_not) ? exp.must_not.map(String) : [],
    });
  }
  return out;
}

/** Assemble the always-loaded rule context for each arm (eager bodies vs thin pointers). */
export function assemble_contexts(rulesDir = RULES_SOURCE): { eager: string; thin: string } {
  const thinMap = build_thin(rulesDir);
  const thin = [...thinMap.values()].join('\n\n');
  const eager = fs
    .readdirSync(rulesDir)
    .filter((n) => n.endsWith('.md'))
    .sort()
    .map((n) => fs.readFileSync(path.join(rulesDir, n), 'utf-8'))
    .join('\n\n');
  return { eager, thin };
}

/** A model that answers a task under a given rule context. */
export type AnswerFn = (armContext: string, task: GoldenTask) => string;

/** A judge that, given the FULL task (rubric + anchors) + two presented answers,
 * returns the order-relative verdict. Wrapped into evaluatePair's narrow JudgeFn. */
export type ModelJudgeFn = (task: GoldenTask, first: string, second: string) => JudgeVerdict;

/** Build the judge user-prompt — length-controlled (ignore verbosity). */
export function judge_prompt(task: GoldenTask, first: string, second: string): string {
  return (
    `Rubric: ${task.rubric}\n` +
    (task.must_include.length ? `Must satisfy: ${task.must_include.join('; ')}\n` : '') +
    (task.must_not.length ? `Must avoid: ${task.must_not.join('; ')}\n` : '') +
    `\nTwo answers to the same request. Judge ONLY which better satisfies the rubric —\n` +
    `IGNORE length and verbosity (a longer answer is not better).\n\n` +
    `--- ANSWER A ---\n${first}\n\n--- ANSWER B ---\n${second}\n\n` +
    `Reply with exactly one line: "VERDICT: A", "VERDICT: B", or "VERDICT: TIE".`
  );
}

/** Parse a judge reply into the order-relative verdict (default tie = inconclusive). */
export function parse_verdict(reply: string): JudgeVerdict {
  const m = /VERDICT:\s*(A|B|TIE)/i.exec(reply);
  if (!m) return 'tie';
  const v = (m[1] as string).toUpperCase();
  return v === 'A' ? 'first' : v === 'B' ? 'second' : 'tie';
}

/** Run every task through both arms + the paired judge. Pure given the injected fns. */
export function run_golden_judge(
  tasks: GoldenTask[],
  contexts: { eager: string; thin: string },
  answer: AnswerFn,
  judge: ModelJudgeFn,
): PairResult[] {
  return tasks.map((task) => {
    const thinAnswer = answer(contexts.thin, task);
    const eagerAnswer = answer(contexts.eager, task);
    // evaluatePair calls its JudgeFn with the narrow {id,rubric} ctx; capture
    // the full task here so the model judge gets the rubric + anchors.
    const judgeFn: JudgeFn = (_ctx, first, second) => judge(task, first, second);
    return evaluatePair(task, thinAnswer, eagerAnswer, judgeFn);
  });
}

// ── Mock model (--dry-run): deterministic, no API ───────────────────────────
function mock_answer(_ctx: string, task: GoldenTask): string {
  return `Answer to ${task.id}: ${(task.must_include[0] ?? 'addresses the request')}.`;
}
const mock_judge: ModelJudgeFn = () => 'tie'; // dry-run can't truly compare → all ties

interface Args {
  dryRun: boolean;
  model: string;
  limit: number | null;
  output: string;
}

function parse_args(argv: string[]): Args | number {
  const a: Args = { dryRun: false, model: 'claude-sonnet-4-5', limit: null, output: OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--model') a.model = String(argv[(i += 1)] ?? a.model);
    else if (arg === '--output') a.output = String(argv[(i += 1)] ?? a.output);
    else if (arg === '--limit') {
      const v = Number(argv[(i += 1)]);
      if (!Number.isInteger(v) || v < 1) {
        process.stderr.write('error: --limit must be a positive integer\n');
        return 1;
      }
      a.limit = v;
    } else if (arg === '-h' || arg === '--help') {
      process.stdout.write('usage: bench_quality_run [--dry-run] [--model M] [--limit N] [--output PATH]\n');
      return 0;
    } else {
      process.stderr.write(`error: unknown argument: ${arg}\n`);
      return 1;
    }
  }
  return a;
}

function main(argv: string[]): number {
  const parsed = parse_args(argv);
  if (typeof parsed === 'number') return parsed;
  const args = parsed;

  let tasks = load_golden();
  if (tasks.length === 0) {
    process.stderr.write('error: no labelled golden tasks — fill internal/bench/corpora/token-quality-golden.yaml\n');
    return 1;
  }
  if (args.limit !== null) tasks = tasks.slice(0, args.limit);
  const contexts = assemble_contexts();

  let answer: AnswerFn;
  let judge: ModelJudgeFn;
  let modelLabel: string;

  if (args.dryRun) {
    answer = mock_answer;
    judge = mock_judge;
    modelLabel = 'dry-run-mock';
    process.stdout.write(`⚠️  --dry-run: deterministic mock, no API. Output shape only.\n`);
  } else {
    // Live path — reuse the proven council AnthropicClient (sync curl). API-gated.
    let client: { ask(system: string, user: string): { text: string } };
    try {
      // Lazy import so --dry-run + tests never touch the council key path.
      const require = createRequire(import.meta.url);
      const clients = require('./ai_council/clients.js') as {
        AnthropicClient: new (o: { model: string; api_key: string }) => { ask(s: string, u: string): { text: string } };
        load_anthropic_key: () => string;
      };
      client = new clients.AnthropicClient({ model: args.model, api_key: clients.load_anthropic_key() });
    } catch (e) {
      process.stderr.write(
        `error: live model unavailable (${(e as Error).message}). ` +
          `Set an Anthropic key (see install-anthropic-key) or use --dry-run.\n`,
      );
      return 1;
    }
    const SYS =
      'You are an AI coding agent governed by the following always-loaded package rules. ' +
      'Answer the user request as that agent would, honouring these rules:\n\n';
    answer = (ctx, task) => client.ask(SYS + ctx, task.prompt).text;
    judge = (task, first, second) =>
      parse_verdict(
        client.ask('You are a strict, length-neutral answer judge.', judge_prompt(task, first, second)).text,
      );
    modelLabel = args.model;
    process.stdout.write(
      `Live run: ${tasks.length} tasks × 2 arms + 2 judge calls each via ${args.model}. This costs API $.\n`,
    );
  }

  let results: PairResult[];
  try {
    results = run_golden_judge(tasks, contexts, answer, judge);
  } catch (e) {
    process.stderr.write(`error: run failed: ${(e as Error).message}\n`);
    return 1;
  }

  const payload = {
    generated_by: 'bench_quality_run',
    judge_model: modelLabel,
    dry_run: args.dryRun,
    threshold: DEFAULT_THRESHOLD,
    results,
  };
  fs.writeFileSync(args.output, JSON.stringify(payload, null, 2) + '\n');
  const thinWins = results.filter((r) => r.winner === 'thin').length;
  const eagerWins = results.filter((r) => r.winner === 'eager').length;
  process.stdout.write(
    `→ wrote ${path.relative(REPO_ROOT, args.output)} (${results.length} pairs; ` +
      `thin ${thinWins} / eager ${eagerWins}). Gate: \`check_quality_regression\`.\n`,
  );
  return 0;
}

const _IS_MAIN =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { main, mock_answer };
