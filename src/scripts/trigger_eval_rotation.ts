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
 * - Rotation is a pure function of (week index, batch size, sorted suite
 *   list): ~batch suites per week, wrapping so every suite is visited on a
 *   fixed cadence regardless of suite-count drift.
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
const DEFAULT_BATCH = 5;

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
 * Deterministic rotation: batch consecutive suites starting at
 * `(week * batch) mod total`, wrapping. Every suite is visited within
 * ceil(total / batch) weeks; adding/removing suites shifts but never
 * starves the cycle.
 */
export function pick_rotation<T>(suites: readonly T[], week: number, batch: number): T[] {
    if (suites.length === 0 || batch <= 0) {
        return [];
    }
    const n = Math.min(batch, suites.length);
    const total = suites.length;
    const start = ((((week * batch) % total) + total) % total);
    const picked: T[] = [];
    for (let i = 0; i < n; i += 1) {
        picked.push(suites[(start + i) % total] as T);
    }
    return picked;
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
    batch?: number;
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
    batch: number;
    total_suites: number;
    dry_run: boolean;
    outcomes: RotationSuiteOutcome[];
    breaches: number;
}

export async function run_rotation(opts: RotationOptions = {}): Promise<RotationSummary> {
    const dryRun = opts.dryRun ?? false;
    const batch = opts.batch ?? DEFAULT_BATCH;
    const week = opts.week ?? week_index(new Date());
    const outDir = opts.outDir ?? DEFAULT_OUT_DIR;
    const model = opts.model ?? DEFAULT_MODEL;
    const skillsDir = opts.skillsDir ?? SKILLS_DIR;

    const suites = list_trigger_suites(skillsDir);
    const picked = pick_rotation(suites, week, batch);
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
        batch,
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
        else if (a === '--batch') out.batch = Number(take());
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
    if (out.batch !== undefined && (!Number.isInteger(out.batch) || out.batch <= 0)) {
        process.stderr.write('trigger_eval_rotation: error: --batch must be a positive integer\n');
        process.exit(2);
    }
    return out;
}

export async function main(argv?: string[]): Promise<number> {
    const opts = parse_args(argv ?? process.argv.slice(2));
    if (opts.help) {
        process.stdout.write(
            'usage: trigger_eval_rotation [--week N] [--batch N] [--dry-run]\n' +
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
        `trigger-eval rotation · week=${summary.week} · batch=${summary.batch} · ` +
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
