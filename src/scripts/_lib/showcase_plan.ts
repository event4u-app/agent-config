/**
 * Showcase run planning (road-to-a-baseline-that-has-to-catch-up step 5.1).
 *
 * Turns a tier and an explicit budget into one `bench_ab_v2_run --corpus
 * artifact` invocation, or refuses. Paid tiers never start without `--max-usd`
 * and never start in CI: spend is owner-reserved (Decision D5) and kill K5
 * rules out a mandatory paid run.
 *
 * The budget is made a hard ceiling by sizing the per-call cap: every run can
 * send at most `1 + PARITY_CAP_K` prompts and each prompt is a separate host
 * call carrying `--budget`, so `calls × budget <= max_usd` bounds the sweep
 * even when no single call reports its cost. The runner's own `--max-usd` is
 * passed too, for the record.
 */
import { LADDER_NAMES } from './bench_artifact_corpus.js';
import { PARITY_CAP_K } from './bench_artifact_parity.js';

export type ShowcaseTier = 'quick' | 'full';

export interface TierSpec {
    tasks: readonly string[] | 'all';
    arms: readonly string[];
    seeds: number;
    host: 'claude';
}

/** quick = one host, k=3, T1a/T2/T4a; full = every artifact task with the placebo arm. */
export const TIERS: Record<ShowcaseTier, TierSpec> = {
    quick: { tasks: ['art-svg-prompt-01', 'art-landing-01', 'art-login-framework-01'], arms: ['package', 'vanilla'], seeds: 3, host: 'claude' },
    full: { tasks: 'all', arms: ['package', 'vanilla', 'placebo'], seeds: 3, host: 'claude' },
};

export const MIN_CALL_BUDGET_USD = 0.05;

export interface ShowcasePlan {
    tier: ShowcaseTier;
    tasks: string[];
    arms: string[];
    seeds: number;
    host: string;
    model: string;
    max_usd: number;
    calls: number;
    call_budget_usd: number;
    argv: string[];
}

export type PlanResult = { ok: true; plan: ShowcasePlan } | { ok: false; reason: string };

export function inCi(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env['CI'] || env['GITHUB_ACTIONS']);
}

export function planShowcase(args: {
    tier: ShowcaseTier;
    max_usd: number | null;
    all_tasks: readonly string[];
    model: string;
    env: NodeJS.ProcessEnv;
    dry_run?: boolean;
}): PlanResult {
    const spec = TIERS[args.tier];
    const tasks = spec.tasks === 'all' ? [...args.all_tasks] : [...spec.tasks];
    const missing = tasks.filter((t) => !args.all_tasks.includes(t));
    if (missing.length > 0) return { ok: false, reason: `tier ${args.tier} names task(s) not in the artifact corpus: ${missing.join(', ')}` };
    const calls = tasks.length * spec.arms.length * spec.seeds * LADDER_NAMES.length * (1 + PARITY_CAP_K);
    const dry = args.dry_run === true;
    if (!dry && inCi(args.env)) return { ok: false, reason: 'refusing a paid showcase run in CI — spend is owner-reserved; use bench:showcase:replay there' };
    if (!dry && (args.max_usd === null || !Number.isFinite(args.max_usd) || args.max_usd <= 0)) {
        return { ok: false, reason: `a paid tier needs an explicit budget: --max-usd <usd> (this tier is up to ${calls} host calls)` };
    }
    const max_usd = args.max_usd ?? 0;
    const call_budget_usd = Math.floor((max_usd / calls) * 100) / 100;
    if (!dry && call_budget_usd < MIN_CALL_BUDGET_USD) {
        return {
            ok: false,
            reason: `--max-usd ${max_usd} over ${calls} calls leaves $${call_budget_usd} per call, under the $${MIN_CALL_BUDGET_USD} floor — raise the budget`,
        };
    }
    const argv = [
        '--corpus', 'artifact',
        '--mode', dry ? 'dry-run' : 'live',
        '--host', spec.host,
        '--model', args.model,
        '--tasks', tasks.join(','),
        '--arms', spec.arms.join(','),
        '--seeds', String(spec.seeds),
        ...(dry ? [] : ['--budget', String(call_budget_usd), '--max-usd', String(max_usd)]),
    ];
    return { ok: true, plan: { tier: args.tier, tasks, arms: [...spec.arms], seeds: spec.seeds, host: spec.host, model: args.model, max_usd, calls, call_budget_usd, argv } };
}

export function renderPlan(p: ShowcasePlan): string {
    return (
        `showcase ${p.tier}: ${p.tasks.length} task(s) × ${p.arms.length} arm(s) [${p.arms.join(', ')}] × k=${p.seeds} × ${LADDER_NAMES.length} ladders, ` +
        `host ${p.host}, model ${p.model}\n` +
        (p.max_usd > 0
            ? `  up to ${p.calls} host calls · budget $${p.max_usd} · per-call cap $${p.call_budget_usd}\n`
            : `  up to ${p.calls} host calls · no budget given — plan / dry run only, no spend\n`) +
        `  tasks: ${p.tasks.join(', ')}\n`
    );
}
