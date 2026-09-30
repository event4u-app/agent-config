#!/usr/bin/env tsx
/**
 * trigger_eval_rotation — weekly live trigger-eval pass-rate rotation (ADR-118 §4).
 *
 * The ONE measure→adjust loop closure from `road-to-loop-engineering`: the
 * weekly cross-model canary runs the live trigger eval over a deterministic
 * rotating subset of the skills that carry `evals/triggers.json`, enforcing
 * the shared per-domain precision/recall floors
 * (`_lib/trigger_eval_floors.ts`). A floor breach fails the SCHEDULED job —
 * the failure is the maintainer notification; PRs are never blocked by live
 * results.
 *
 * Boundaries (deliberate):
 * - The local interactive `skill_trigger_eval` CLI and its /dev/tty
 *   confirmation gate are untouched — this script is the CI-only path, and
 *   its live authorization derives exclusively from the key file the canary
 *   workflow materializes from repo secrets (same pattern as
 *   `cross_model_smoke.ts`). No env-var key fallback, no local bypass.
 * - `--dry-run` (MockRouter, no key, no spend) exercises the plumbing only;
 *   floors are REPORTED but never fail the run — mock routing says nothing
 *   about real trigger accuracy.
 * - Rotation is a pure function of (week index, suite identity): a suite's
 *   slot comes from a hash of its own name, so every suite is visited once per
 *   `ROTATION_CYCLE_WEEKS` and adding one shifts nobody else. What floats is
 *   how many run in a given week; `rotation_plan` reports that and the weekly
 *   query cost it implies.
 *
 * Exit codes: 0 pass (always, in --dry-run) · 1 live floor breach ·
 * 2 usage / IO error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    DEFAULT_MODEL,
    MockRouter,
    Query,
    compute_metrics,
    load_skill_metas,
    write_result,
    type EvalResult,
    type SkillMeta,
    type TriggerRouter,
} from './skill_trigger_eval.js';
import { AnthropicFetchRouter, loadKeyFromFile } from './_lib/trigger_routers.js';
import { floor_for } from './_lib/trigger_eval_floors.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'src', 'skills');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'internal', 'evals', 'results', 'rotation');

/** Router that may expose an async route (fetch-based live routers). */
type AsyncCapableRouter = TriggerRouter & {
    routeAsync?: (query: string, skills: SkillMeta[]) => Promise<[string[], number, number]>;
};

/** UTC week index since epoch — monotonic, deterministic rotation key. */
export function week_index(d: Date): number {
    const utcDays = Math.floor(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000,
    );
    return Math.floor(utcDays / 7);
}

/**
 * Weeks in one full rotation cycle. 12 × 7 = 84 days, inside the 90-day
 * `MAX_AGE_DAYS` window `check_trigger_evals` enforces.
 */
export const ROTATION_CYCLE_WEEKS = 12;

/** Provider queries one suite's live pass costs, measured at ~9.5; rounded up. */
export const QUERIES_PER_SUITE = 10;

/**
 * Stated weekly ceiling for the rotation's paid calls. Growth past it does not
 * silently raise the bill — `rotation_plan` reports `withinCeiling: false` and
 * a test asserts the live suite list stays under it, so crossing it is a red a
 * human decides on rather than an invoice they discover.
 *
 * **Set from measurement, and the arithmetic is the point.** At 102 suites a
 * full pass costs ~1020 queries; spread over a 12-week cycle that is ~85 a week
 * on average and 140 in the busiest week (hash spread, measured 2026-09-30).
 * 160 leaves headroom for that unevenness and reds at roughly 117 suites.
 *
 * The number nobody can lower by tuning: a 90-day window over N suites costs
 * `N × QUERIES_PER_SUITE` every 90 days, whatever the schedule. The scheme this
 * replaced looked cheaper only because it never completed a pass — `batch = 5`
 * over 102 suites is a 21-week cycle, which misses the 90-day window by 57 days.
 * Cheapness was the symptom of the defect, not a property worth preserving.
 */
export const MAX_WEEKLY_QUERIES = 160;

/**
 * FNV-1a over the suite id. Any stable hash works; what matters is that a
 * suite's slot depends on the suite alone and on nothing about the list it
 * sits in.
 */
function slot_of(id: string, cycleWeeks: number): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i += 1) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h % cycleWeeks;
}

/**
 * Deterministic rotation by suite identity: a suite is due in the weeks whose
 * `week mod cycleWeeks` equals its own slot, so worst-case staleness is exactly
 * `cycleWeeks` for any suite present across a cycle — independent of how many
 * suites exist.
 *
 * **Why not the positional window this replaces.** It selected `batch`
 * consecutive suites from `start = (week * batch) mod total`, and that start
 * re-bases whenever `total` changes, so a region can be skipped repeatedly.
 * Simulated against a list growing by one suite every eight weeks over five
 * years, worst-case staleness reached **24 weeks against a 12-week window**;
 * `trigger_eval_rotation_growth.test.ts` is that simulation, and it was
 * observed red against the old scheme before this replaced it. A loop over
 * static totals cannot see the defect, which is why the earlier test suite
 * passed while the property was false.
 *
 * The cost of the fix is that the batch is no longer a knob: how many suites
 * run in a given week follows from the hash distribution, and `rotation_plan`
 * reports it rather than leaving it to be discovered on an invoice.
 */
export function pick_rotation<T>(
    suites: readonly T[],
    week: number,
    cycleWeeks: number = ROTATION_CYCLE_WEEKS,
): T[] {
    if (suites.length === 0 || cycleWeeks <= 0) {
        return [];
    }
    const due = (((week % cycleWeeks) + cycleWeeks) % cycleWeeks);
    return suites.filter((s) => slot_of(String(s), cycleWeeks) === due);
}

/** What a given suite list costs and promises, derivable without running it. */
export interface RotationPlan {
    total: number;
    cycleWeeks: number;
    /** Suites in the busiest week of the cycle. */
    peakSuitesPerWeek: number;
    /** Provider queries in that busiest week. */
    peakWeeklyQueries: number;
    /** Worst-case days between two visits of one suite. */
    worstCaseStalenessDays: number;
    withinCeiling: boolean;
}

/**
 * Derive the cost and staleness a suite list implies. Pure, so the weekly bill
 * is readable from the code rather than from a run.
 */
export function rotation_plan(
    suites: readonly string[],
    cycleWeeks: number = ROTATION_CYCLE_WEEKS,
): RotationPlan {
    const span = Math.max(cycleWeeks, 1);
    const counts = new Array<number>(span).fill(0);
    for (const s of suites) {
        const slot = slot_of(s, span);
        counts[slot] = (counts[slot] ?? 0) + 1;
    }
    const peakSuitesPerWeek = counts.length > 0 ? Math.max(...counts) : 0;
    const peakWeeklyQueries = peakSuitesPerWeek * QUERIES_PER_SUITE;
    return {
        total: suites.length,
        cycleWeeks,
        peakSuitesPerWeek,
        peakWeeklyQueries,
        worstCaseStalenessDays: cycleWeeks * 7,
        withinCeiling: peakWeeklyQueries <= MAX_WEEKLY_QUERIES,
    };
}

/** Enumerate skills carrying `evals/triggers.json`, sorted for determinism. */
export function list_trigger_suites(skillsDir: string = SKILLS_DIR): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(skillsDir);
    } catch {
        return [];
    }
    return entries
        .filter((name) => {
            try {
                return fs.statSync(path.join(skillsDir, name, 'evals', 'triggers.json')).isFile();
            } catch {
                return false;
            }
        })
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Load a triggers.json in EITHER supported shape (mirrors
 * `check_trigger_evals.ts`): a `queries` list of {q, trigger:bool}, or split
 * `should_trigger` / `should_not_trigger` lists whose items are query strings
 * or {q} objects. `load_triggers` from the pinned CLI only reads the first
 * shape, so the rotation normalizes here instead of touching the pinned code.
 */
export function load_triggers_any(p: string, fallbackSkill: string): [string, Query[]] {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    const skill = typeof data['skill'] === 'string' && data['skill'] ? (data['skill'] as string) : fallbackSkill;
    const queries: Query[] = [];
    if (Array.isArray(data['queries'])) {
        for (const item of data['queries'] as Array<{ q?: unknown; trigger?: unknown }>) {
            if (typeof item?.q === 'string' && item.q.trim()) {
                queries.push(Query(item.q, Boolean(item.trigger)));
            }
        }
    } else {
        for (const [key, trigger] of [
            ['should_trigger', true],
            ['should_not_trigger', false],
        ] as const) {
            const items = data[key];
            if (!Array.isArray(items)) continue;
            for (const it of items) {
                const q = typeof it === 'string' ? it : (it as { q?: unknown } | null)?.q;
                if (typeof q === 'string' && q.trim()) {
                    queries.push(Query(q, trigger));
                }
            }
        }
    }
    if (queries.length === 0) {
        throw new Error(`${p}: no usable queries in either supported shape`);
    }
    return [skill, queries];
}

/** run_eval, but awaiting routeAsync when the router provides it. */
export async function run_eval_async(
    skill_name: string,
    queries: Query[],
    router: AsyncCapableRouter,
    skills: SkillMeta[],
    model: string,
): Promise<EvalResult> {
    const result: EvalResult = {
        skill: skill_name,
        model,
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
        router: router.name,
        queries: [],
        metrics: compute_metrics([]),
        input_tokens: 0,
        output_tokens: 0,
        cost_usd_estimate: 0.0,
    };
    for (const q of queries) {
        const [loaded, inTok, outTok] =
            typeof router.routeAsync === 'function'
                ? await router.routeAsync(q.q, skills)
                : router.route(q.q, skills);
        const observed = loaded.includes(skill_name);
        result.queries.push({
            q: q.q,
            expected: q.trigger,
            observed,
            loaded_skills: [...loaded].sort(),
            passed: observed === q.trigger,
        });
        result.input_tokens += inTok;
        result.output_tokens += outTok;
    }
    result.metrics = compute_metrics(result.queries);
    return result;
}

export interface RotationOptions {
    week?: number;
    /** Weeks in a full cycle; also the worst-case staleness. Default 12. */
    cycleWeeks?: number;
    dryRun?: boolean;
    outDir?: string;
    model?: string;
    /** Injectable router (tests). Default: MockRouter (dry) / AnthropicFetchRouter (live). */
    router?: AsyncCapableRouter;
    skillsDir?: string;
}

export interface RotationSuiteOutcome {
    skill: string;
    precision: number;
    recall: number;
    minPrecision: number;
    minRecall: number;
    passed: boolean;
    resultPath: string;
}

export interface RotationSummary {
    week: number;
    cycle_weeks: number;
    total_suites: number;
    dry_run: boolean;
    outcomes: RotationSuiteOutcome[];
    breaches: number;
}

export async function run_rotation(opts: RotationOptions = {}): Promise<RotationSummary> {
    const dryRun = opts.dryRun ?? false;
    const cycleWeeks = opts.cycleWeeks ?? ROTATION_CYCLE_WEEKS;
    const week = opts.week ?? week_index(new Date());
    const outDir = opts.outDir ?? DEFAULT_OUT_DIR;
    const model = opts.model ?? DEFAULT_MODEL;
    const skillsDir = opts.skillsDir ?? SKILLS_DIR;

    const suites = list_trigger_suites(skillsDir);
    const picked = pick_rotation(suites, week, cycleWeeks);
    const catalogue = load_skill_metas();

    const router: AsyncCapableRouter =
        opts.router ??
        (dryRun
            ? new MockRouter((q, skills) =>
                  skills.filter((s) => q.toLowerCase().includes(s.name)).map((s) => s.name),
              )
            : (new AnthropicFetchRouter({
                  apiKey: loadKeyFromFile('anthropic.key'),
              }) as AsyncCapableRouter));

    fs.mkdirSync(outDir, { recursive: true });

    const outcomes: RotationSuiteOutcome[] = [];
    for (const skill of picked) {
        const triggersPath = path.join(skillsDir, skill, 'evals', 'triggers.json');
        const [skillName, queries] = load_triggers_any(triggersPath, skill);
        const result = await run_eval_async(skillName, queries, router, catalogue, model);
        const floor = floor_for(skillName);
        const passed =
            result.metrics.precision >= floor.minPrecision &&
            result.metrics.recall >= floor.minRecall;
        const resultPath = path.join(outDir, `${skillName}.json`);
        write_result(result, resultPath);
        outcomes.push({
            skill: skillName,
            precision: result.metrics.precision,
            recall: result.metrics.recall,
            minPrecision: floor.minPrecision,
            minRecall: floor.minRecall,
            passed,
            resultPath,
        });
    }

    return {
        week,
        cycle_weeks: cycleWeeks,
        total_suites: suites.length,
        dry_run: dryRun,
        outcomes,
        breaches: outcomes.filter((o) => !o.passed).length,
    };
}

function parse_args(argv: string[]): RotationOptions & { help?: boolean } {
    const out: RotationOptions & { help?: boolean } = {};
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const take = (): string => {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(`trigger_eval_rotation: error: argument ${a}: expected one argument\n`);
                process.exit(2);
            }
            return v as string;
        };
        if (a === '--week') out.week = Number(take());
        else if (a === '--cycle-weeks') out.cycleWeeks = Number(take());
        else if (a === '--dry-run') out.dryRun = true;
        else if (a === '--out-dir') out.outDir = path.resolve(take());
        else if (a === '--model') out.model = take();
        else if (a === '-h' || a === '--help') out.help = true;
        else {
            process.stderr.write(`trigger_eval_rotation: error: unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    if (out.week !== undefined && !Number.isInteger(out.week)) {
        process.stderr.write('trigger_eval_rotation: error: --week must be an integer\n');
        process.exit(2);
    }
    if (out.cycleWeeks !== undefined && (!Number.isInteger(out.cycleWeeks) || out.cycleWeeks <= 0)) {
        process.stderr.write('trigger_eval_rotation: error: --cycle-weeks must be a positive integer\n');
        process.exit(2);
    }
    return out;
}

export async function main(argv?: string[]): Promise<number> {
    const opts = parse_args(argv ?? process.argv.slice(2));
    if (opts.help) {
        process.stdout.write(
            'usage: trigger_eval_rotation [--week N] [--cycle-weeks N] [--dry-run]\n' +
                '                             [--out-dir DIR] [--model MODEL]\n',
        );
        return 0;
    }
    let summary: RotationSummary;
    try {
        summary = await run_rotation(opts);
    } catch (err) {
        process.stderr.write(`❌  trigger_eval_rotation: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    process.stdout.write(
        `trigger-eval rotation · week=${summary.week} · cycle=${summary.cycle_weeks}w · ` +
            `${summary.outcomes.length}/${summary.total_suites} suites this run` +
            `${summary.dry_run ? ' · DRY-RUN (floors advisory)' : ''}\n`,
    );
    for (const o of summary.outcomes) {
        const mark = o.passed ? '✅' : '❌';
        process.stdout.write(
            `  ${mark} ${o.skill} · precision ${o.precision} (floor ${o.minPrecision}) · ` +
                `recall ${o.recall} (floor ${o.minRecall}) · ${o.resultPath}\n`,
        );
    }
    if (summary.breaches > 0 && !summary.dry_run) {
        process.stderr.write(
            `❌  ${summary.breaches} suite(s) below floor — see result JSONs. ` +
                'Demotion revisit-if: ADR-118 (advisory if >~10% spurious over 50+ runs).\n',
        );
        return 1;
    }
    process.stdout.write('✅  rotation complete\n');
    return 0;
}

const argvUrl = process.argv[1] === undefined ? '' : pathToFileURL(path.resolve(process.argv[1])).href;
if (import.meta.url === argvUrl) {
    main().then((code) => process.exit(code));
}
