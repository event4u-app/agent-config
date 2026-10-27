/**
 * Scoring for the map task set (`internal/bench/ab/map-task-set/tasks.yaml`).
 *
 * Three metrics, each computed from what a run left behind and never from what
 * it claimed:
 *
 * - **M1 wrong change** — the hidden check fails on the run's working copy. The
 *   check lives outside the copy, so the agent cannot read or edit it; a failing
 *   assertion that names a `protects` place is a planted dependency the change
 *   broke or never reached.
 * - **M2 affected-set recall / precision** — the places the agent declared in
 *   the `AFFECTED SET` section of its answer, matched against the planted set.
 *   A run that declares nothing has recall 0 and no precision (`null`), never a
 *   precision of 0: precision over an empty list is undefined, and reporting it
 *   as 0 would punish silence and caution identically.
 * - **M3 cost per success** — tokens of every run, failed ones included,
 *   divided by the number of successful runs. A failed run's tokens are the cost
 *   the arm paid for nothing, which is exactly what a per-success figure exists
 *   to show.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const MAP_FIXTURES_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
export const MAP_TASKS_FILE = path.join(MAP_FIXTURES_ROOT, 'map-task-set', 'tasks.yaml');

export function load_map_tasks(file: string = MAP_TASKS_FILE): MapTask[] {
    const doc = parseYaml(fs.readFileSync(file, 'utf-8')) as { tasks?: MapTask[] } | null;
    return Array.isArray(doc?.tasks) ? doc.tasks : [];
}

export interface AffectedItem {
    kind: string;
    id: string;
    aliases?: string[];
}

export interface CheckAssertion {
    path?: string;
    glob?: string;
    match?: string;
    no_match?: string;
    absent?: string;
    flags?: string;
    protects?: string;
    why?: string;
}

export interface MapTask {
    id: string;
    area: string;
    fixture: string;
    reference: string;
    reference_delete?: string[];
    primary: string[];
    prompt: string;
    affected: AffectedItem[];
    hidden_check: CheckAssertion[];
}

export interface CheckFailure {
    index: number;
    reason: string;
    protects: string | null;
}

export interface CheckResult {
    pass: boolean;
    failures: CheckFailure[];
    broken_dependents: string[];
}

export const MAP_AREAS = ['code', 'data', 'interfaces', 'runtime', 'delivery'] as const;

export const AFFECTED_HEADER = 'AFFECTED SET';
export const AFFECTED_FOOTER = 'END AFFECTED SET';

/** Appended to every task prompt in every arm, so M2 asks all arms the same thing. */
export const AFFECTED_SET_INSTRUCTION = [
    '',
    '',
    'Before you change anything, work out every place this change affects. Then make the change.',
    'End your final answer with this section, one place per line (a file path, or a table.column,',
    'endpoint, CI job, compose service, variable or setting name):',
    '',
    AFFECTED_HEADER,
    '- <place>',
    AFFECTED_FOOTER,
].join('\n');

/** `dir/**\/*.ext` and `dir/*.ext` only — the shapes the corpus uses. */
export function glob_to_regex(glob: string): RegExp {
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i] as string;
        if (c === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
            re += '(?:.*/)?';
            i += 2;
        } else if (c === '*') {
            re += '[^/]*';
        } else if (/[.+?^${}()|[\]\\]/.test(c)) {
            re += `\\${c}`;
        } else {
            re += c;
        }
    }
    return new RegExp(`^${re}$`);
}

function walk(root: string, rel = ''): string[] {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
            if (r === 'agents' || e.name === 'node_modules' || e.name === '.git') continue;
            out.push(...walk(root, r));
        } else if (e.isFile()) {
            out.push(r);
        }
    }
    return out;
}

function read(root: string, rel: string): string | null {
    const p = path.join(root, rel);
    return fs.existsSync(p) && fs.statSync(p).isFile() ? fs.readFileSync(p, 'utf-8') : null;
}

/** One assertion → a failure reason, or `null` when it holds. */
export function check_assertion(a: CheckAssertion, root: string): string | null {
    const flags = a.flags ?? '';
    if (a.absent !== undefined) {
        return fs.existsSync(path.join(root, a.absent)) ? `${a.absent} still exists` : null;
    }
    if (a.path !== undefined) {
        const text = read(root, a.path);
        if (a.match !== undefined) {
            if (text === null) return `${a.path} missing`;
            if (!new RegExp(a.match, flags).test(text)) return `${a.path} lacks /${a.match}/`;
        }
        if (a.no_match !== undefined && text !== null && new RegExp(a.no_match, flags).test(text)) {
            return `${a.path} still has /${a.no_match}/`;
        }
        return null;
    }
    if (a.glob !== undefined) {
        const g = glob_to_regex(a.glob);
        const texts = walk(root)
            .filter((r) => g.test(r))
            .map((r) => [r, read(root, r) ?? ''] as const);
        if (a.match !== undefined && !texts.some(([, t]) => new RegExp(a.match as string, flags).test(t))) {
            return `no file under ${a.glob} has /${a.match}/`;
        }
        if (a.no_match !== undefined) {
            const hit = texts.find(([, t]) => new RegExp(a.no_match as string, flags).test(t));
            if (hit) return `${hit[0]} still has /${a.no_match}/`;
        }
        return null;
    }
    return 'assertion names neither path, glob nor absent';
}

export function evaluate_hidden_check(task: Pick<MapTask, 'hidden_check'>, root: string): CheckResult {
    const failures: CheckFailure[] = [];
    task.hidden_check.forEach((a, index) => {
        const reason = check_assertion(a, root);
        if (reason !== null) failures.push({ index, reason, protects: a.protects ?? null });
    });
    const broken = [...new Set(failures.map((f) => f.protects).filter((p): p is string => p !== null))].sort();
    return { pass: failures.length === 0 && task.hidden_check.length > 0, failures, broken_dependents: broken };
}

/**
 * Lay the task's reference change over `root`. `only` restricts it to those
 * paths — given the task's `primary`, that is the naive change the prompt
 * literally asks for and nothing else.
 */
export function apply_reference(task: MapTask, fixturesRoot: string, root: string, only?: readonly string[]): void {
    const keep = (rel: string): boolean => !only || only.includes(rel);
    const refDir = path.join(fixturesRoot, task.reference);
    for (const rel of walk(refDir)) {
        if (!keep(rel)) continue;
        const dest = path.join(root, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(refDir, rel), dest);
    }
    for (const rel of task.reference_delete ?? []) {
        if (keep(rel)) fs.rmSync(path.join(root, rel), { force: true });
    }
}

/** The declared lines of the LAST `AFFECTED SET` section, or `null` when there is none. */
export function parse_affected_section(text: string): string[] | null {
    const lines = text.split(/\r?\n/);
    let start = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (normalise_heading(lines[i] as string) === AFFECTED_HEADER) {
            start = i;
            break;
        }
    }
    if (start < 0) return null;
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
        const raw = lines[i] as string;
        if (normalise_heading(raw) === AFFECTED_FOOTER) break;
        const item = raw
            .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
            .replace(/`/g, '')
            .trim();
        if (item && !/^```/.test(raw.trim()) && item !== '<place>') out.push(item);
    }
    return [...new Set(out)];
}

function normalise_heading(line: string): string {
    return line
        .replace(/^[#>*\s]+|[*:\s]+$/g, '')
        .replace(/\*\*/g, '')
        .trim()
        .toUpperCase();
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A place matches on token boundaries: `report` names `src/report.js`, never `src/reporter.ts`. */
function item_matches(item: AffectedItem, line: string): boolean {
    return [item.id, ...(item.aliases ?? [])].some((k) => k.length > 0 && new RegExp(`(?<![\\w-])${escapeRe(k)}(?![\\w-])`, 'i').test(line));
}

export interface AffectedScore {
    declared: number;
    section_missing: boolean;
    recall: number;
    precision: number | null;
    matched: string[];
    missed: string[];
    unmatched_lines: string[];
}

export function score_affected(task: Pick<MapTask, 'affected'>, declared: string[] | null): AffectedScore {
    const lines = declared ?? [];
    const matched = task.affected.filter((it) => lines.some((l) => item_matches(it, l)));
    const unmatched = lines.filter((l) => !task.affected.some((it) => item_matches(it, l)));
    return {
        declared: lines.length,
        section_missing: declared === null,
        recall: task.affected.length ? matched.length / task.affected.length : 0,
        precision: lines.length ? (lines.length - unmatched.length) / lines.length : null,
        matched: matched.map((m) => m.id),
        missed: task.affected.filter((it) => !matched.includes(it)).map((m) => m.id),
        unmatched_lines: unmatched,
    };
}

export interface TokenBuckets {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
}

export function total_tokens(b: TokenBuckets | null | undefined): number {
    if (!b) return 0;
    return (
        (b.input_tokens ?? 0) +
        (b.output_tokens ?? 0) +
        (b.cache_read_input_tokens ?? 0) +
        (b.cache_creation_input_tokens ?? 0)
    );
}

/** One scored run — the shape the runner writes and `summarise_arm` reads. */
export interface MapRunRecord {
    task_id: string;
    area: string;
    arm: string;
    seed: number;
    errored: boolean;
    success: boolean;
    broken_dependents: string[];
    affected: AffectedScore;
    tokens: number;
    usd: number;
    /** The hidden check passed, whatever the agent's exit; absent on old records, then `success` stands in. */
    check_passed?: boolean;
}

export type RunOutcome = 'success' | 'errored-check-passed' | 'errored' | 'failed';

/** "Errored, check passed" is its own outcome: the change is right, the session ended badly. */
export function runOutcome(errored: boolean, checkPassed: boolean): RunOutcome {
    if (errored) return checkPassed ? 'errored-check-passed' : 'errored';
    return checkPassed ? 'success' : 'failed';
}

const outcomeOf = (r: MapRunRecord): RunOutcome => runOutcome(r.errored, r.check_passed ?? r.success);

export interface ArmSummary {
    arm: string;
    runs: number;
    errored: number;
    /** Errored runs whose hidden check passed: not a wrong change. */
    errored_check_passed: number;
    successes: number;
    m1_wrong_change_share: number | null;
    m1_runs_with_broken_dependent: number;
    m2_mean_recall: number | null;
    m2_mean_precision: number | null;
    m2_section_missing: number;
    m3_tokens_total: number;
    m3_tokens_per_success: number | null;
    usd_total: number;
    budget_tokens_per_run: number;
    success_within_budget_share: number | null;
    successes_per_budget: number | null;
    by_area: Record<string, { runs: number; successes: number; checks_passed: number }>;
}

function mean(xs: number[]): number | null {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * Aggregate one arm. An errored run whose hidden check failed counts as a wrong
 * change: the task stayed undone, and dropping it would let an arm that crashes
 * on hard tasks look more accurate than one that attempts them. An errored run
 * whose check passed is counted apart and is no wrong change.
 *
 * Two budget readings, because one hides what the other shows:
 * `success_within_budget_share` is the share of runs that succeeded without
 * crossing the per-run token budget; `successes_per_budget` is how many
 * successes the arm buys per budget's worth of tokens across all its runs.
 */
export function summarise_arm(arm: string, records: MapRunRecord[], budget_tokens_per_run: number): ArmSummary {
    const runs = records.filter((r) => r.arm === arm);
    const successes = runs.filter((r) => r.success).length;
    const tokens = runs.reduce((a, r) => a + r.tokens, 0);
    const erroredPassed = runs.filter((r) => outcomeOf(r) === 'errored-check-passed').length;
    const by_area: Record<string, { runs: number; successes: number; checks_passed: number }> = {};
    for (const r of runs) {
        const slot = (by_area[r.area] ??= { runs: 0, successes: 0, checks_passed: 0 });
        slot.runs += 1;
        if (r.success) slot.successes += 1;
        if (r.check_passed ?? r.success) slot.checks_passed += 1;
    }
    const precisions = runs.map((r) => r.affected.precision).filter((p): p is number => p !== null);
    return {
        arm,
        runs: runs.length,
        errored: runs.filter((r) => r.errored).length,
        errored_check_passed: erroredPassed,
        successes,
        m1_wrong_change_share: runs.length ? (runs.length - successes - erroredPassed) / runs.length : null,
        m1_runs_with_broken_dependent: runs.filter((r) => r.broken_dependents.length > 0).length,
        m2_mean_recall: mean(runs.map((r) => r.affected.recall)),
        m2_mean_precision: mean(precisions),
        m2_section_missing: runs.filter((r) => r.affected.section_missing).length,
        m3_tokens_total: tokens,
        m3_tokens_per_success: successes ? tokens / successes : null,
        usd_total: runs.reduce((a, r) => a + r.usd, 0),
        budget_tokens_per_run,
        success_within_budget_share: runs.length
            ? runs.filter((r) => r.success && r.tokens <= budget_tokens_per_run).length / runs.length
            : null,
        successes_per_budget: tokens ? (successes * budget_tokens_per_run) / tokens : null,
        by_area,
    };
}
