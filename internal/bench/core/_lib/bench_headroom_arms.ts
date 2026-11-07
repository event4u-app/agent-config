/**
 * Harness-orchestrated arms for the headroom run (`internal/bench/headroom-17-PREREG.md`):
 * does a second agent earn its spawn on tasks where every single agent fails?
 *
 * Each step is a SEPARATE host call driven by the harness, so the run measures
 * the mechanism, not whether one agent obeys an instruction to spawn another.
 *
 * - `test-first` (arm C): a fresh tester writes edge-case tests from the
 *   requirement alone, the harness runs them, then the author implements with
 *   the tests named as part of the acceptance.
 * - `review` (arm D): the author implements, a slim reviewer reads the diff and
 *   the requirement, and its findings go back to the author once.
 *
 * Every model call goes through an injected `call`, and every command through an
 * injected `exec`, so the control flow and the false-positive accounting are
 * testable with no live call. Pre-registered definitions (1.7, D4):
 *
 * - A reviewer finding is a FALSE POSITIVE when the attempt it reviewed already
 *   passed the hidden verifier; findings on a failing attempt are confirmed.
 * - A tester's test file is a FALSE POSITIVE when it fails on the pristine
 *   fixture with the reference patch applied.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type Dict = Record<string, unknown>;

export const GENERATED_TEST_REL = path.join('tests', 'edge.generated.test.mjs');

export type StepRole = 'tester' | 'author' | 'author-revision' | 'reviewer';

export interface StepCall {
    role: StepRole;
    prompt: string;
}

/** One host call in `clone`; returns the run dict `run_live` returns. */
export type CallFn = (step: StepCall) => Dict;
/** Run a shell command in `cwd`; returns its exit status. */
export type ExecFn = (command: string, cwd: string) => number;
/** Hidden-verifier capability verdict of the clone as it stands now. */
export type PassFn = () => boolean;

export interface StepRecord {
    role: StepRole;
    errored: boolean;
    tokens_breakdown: Dict;
    tokens: number;
    wall_time_seconds: number;
}

export interface Finding {
    file: string | null;
    issue: string;
}

export interface OrchestratedResult {
    /** The last author run — the one the final score belongs to. */
    final_run: Dict;
    steps: StepRecord[];
    errored: boolean;
    /** Summed over every step, the unit priced cost is computed from. */
    tokens_breakdown: Dict;
    tokens: number;
    wall_time_seconds: number;
    // test-first only
    generated_tests?: string | null;
    tests_red_before?: boolean | null;
    tests_green_after?: boolean | null;
    tests_fp?: boolean | null;
    tester_touched_source?: string[];
    // review only
    findings?: Finding[];
    pre_review_pass?: boolean | null;
    findings_fp?: number;
    findings_confirmed?: number;
    revised?: boolean;
}

export function tester_prompt(requirement: string): string {
    return [
        'Write tests for the requirement below. Do not change any file outside the tests directory, and do not implement anything.',
        `Put the tests in ${GENERATED_TEST_REL} as a plain Node ES module that exits non-zero when any check fails (no test framework is installed).`,
        'Cover the edge cases the requirement implies, not only the example it names. Read the code and docs as needed to learn the public functions.',
        '',
        'Requirement:',
        requirement,
    ].join('\n');
}

export function author_with_tests_prompt(requirement: string): string {
    return `${requirement}\n\nTests for this requirement were written by a colleague at ${GENERATED_TEST_REL} (\`node ${GENERATED_TEST_REL}\`). They are part of the acceptance, but if one contradicts the requirement, the requirement wins.`;
}

export function reviewer_prompt(requirement: string, diff: string): string {
    return [
        'Review the change below against the requirement. Report every defect you find: a case the requirement covers that the change gets wrong or leaves unhandled.',
        'Answer with JSON only: {"findings": [{"file": "<path or null>", "issue": "<one sentence>"}]}. An empty list is a valid answer.',
        '',
        'Requirement:',
        requirement,
        '',
        'Change (unified diff):',
        diff,
    ].join('\n');
}

export function revision_prompt(requirement: string, findings: readonly Finding[]): string {
    const lines = findings.map((f, i) => `${i + 1}. ${f.file ? `${f.file}: ` : ''}${f.issue}`);
    return `${requirement}\n\nYou already made a change for this. A reviewer read it and reported:\n${lines.join('\n')}\n\nCheck each finding against the code and address the ones that hold.`;
}

/** Parse the reviewer's JSON answer; anything unparseable is zero findings, flagged. */
export function parse_findings(text: string): { findings: Finding[]; parse_ok: boolean } {
    const match = text.match(/\{[\s\S]*\}/);
    if (match === null) return { findings: [], parse_ok: false };
    try {
        const doc = JSON.parse(match[0]) as Dict;
        const raw = doc['findings'];
        if (!Array.isArray(raw)) return { findings: [], parse_ok: false };
        const findings = raw
            .filter((f): f is Dict => typeof f === 'object' && f !== null)
            .map((f) => ({ file: typeof f['file'] === 'string' ? (f['file'] as string) : null, issue: String(f['issue'] ?? '') }))
            .filter((f) => f.issue.trim() !== '');
        return { findings, parse_ok: true };
    } catch {
        return { findings: [], parse_ok: false };
    }
}

function step_record(role: StepRole, run: Dict): StepRecord {
    return {
        role,
        errored: Boolean(run['errored']),
        tokens_breakdown: (run['tokens_breakdown'] ?? {}) as Dict,
        tokens: Number(run['tokens'] ?? 0) || 0,
        wall_time_seconds: Number(run['wall_time_seconds'] ?? 0) || 0,
    };
}

/** Sum numeric fields of every step's token breakdown. */
export function sum_breakdowns(steps: readonly StepRecord[]): Dict {
    const out: Record<string, number> = {};
    for (const s of steps) {
        for (const [k, v] of Object.entries(s.tokens_breakdown)) {
            if (typeof v === 'number') out[k] = (out[k] ?? 0) + v;
        }
    }
    return out;
}

function totals(steps: StepRecord[]): Pick<OrchestratedResult, 'tokens_breakdown' | 'tokens' | 'wall_time_seconds' | 'errored'> {
    return {
        tokens_breakdown: sum_breakdowns(steps),
        tokens: steps.reduce((a, s) => a + s.tokens, 0),
        wall_time_seconds: steps.reduce((a, s) => a + s.wall_time_seconds, 0),
        errored: steps.some((s) => s.errored),
    };
}

/**
 * Relative paths of the task's own files under `root`. Skips VCS and dependency
 * dirs, dot-dirs, and the installed package's runtime state under `agents/`,
 * which its hooks write on every call and which is not the tester's work.
 */
function list_files(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
            if (dir === root && e.name === 'agents') continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile()) out.push(path.relative(root, full));
        }
    };
    walk(root);
    return out.sort();
}

function snapshot(root: string): Map<string, string> {
    return new Map(list_files(root).map((f) => [f, fs.readFileSync(path.join(root, f), 'utf-8')]));
}

/**
 * Put every non-test file back to `before`. Returns the files the tester had
 * changed outside `tests/` — recorded, because a tester that edits source has
 * left its role.
 */
export function restore_outside_tests(root: string, before: Map<string, string>): string[] {
    const touched: string[] = [];
    const after = new Set(list_files(root));
    for (const f of after) {
        if (f.split(path.sep)[0] === 'tests') continue;
        const now = fs.readFileSync(path.join(root, f), 'utf-8');
        if (!before.has(f)) {
            fs.rmSync(path.join(root, f));
            touched.push(f);
        } else if (before.get(f) !== now) {
            fs.writeFileSync(path.join(root, f), before.get(f) as string);
            touched.push(f);
        }
    }
    for (const [f, content] of before) {
        if (f.split(path.sep)[0] === 'tests') continue;
        if (!after.has(f)) {
            fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
            fs.writeFileSync(path.join(root, f), content);
            touched.push(f);
        }
    }
    return touched.sort();
}

export interface TestFirstDeps {
    requirement: string;
    clone: string;
    call: CallFn;
    exec: ExecFn;
    /** Runs the generated test file against the reference solution; true = it passes there. */
    tests_pass_on_reference: (test_source: string) => boolean;
}

export function run_test_first(d: TestFirstDeps): OrchestratedResult {
    const steps: StepRecord[] = [];
    const before = snapshot(d.clone);
    const tester = d.call({ role: 'tester', prompt: tester_prompt(d.requirement) });
    steps.push(step_record('tester', tester));
    const touched = restore_outside_tests(d.clone, before);
    const gen_path = path.join(d.clone, GENERATED_TEST_REL);
    const generated = fs.existsSync(gen_path) ? fs.readFileSync(gen_path, 'utf-8') : null;
    const red_before = generated === null ? null : d.exec(`node ${GENERATED_TEST_REL}`, d.clone) !== 0;

    const author = d.call({
        role: 'author',
        prompt: generated === null ? d.requirement : author_with_tests_prompt(d.requirement),
    });
    steps.push(step_record('author', author));
    const green_after = generated === null || !fs.existsSync(gen_path) ? null : d.exec(`node ${GENERATED_TEST_REL}`, d.clone) === 0;
    const tests_fp = generated === null ? null : !d.tests_pass_on_reference(generated);
    // The generated file is the tester's output, not the author's change: it is
    // removed before scoring so the discipline oracle sees the same surface as A.
    if (fs.existsSync(gen_path)) fs.rmSync(gen_path);
    return {
        final_run: author,
        steps,
        ...totals(steps),
        generated_tests: generated,
        tests_red_before: red_before,
        tests_green_after: green_after,
        tests_fp,
        tester_touched_source: touched,
    };
}

export interface ReviewDeps {
    requirement: string;
    clone: string;
    call: CallFn;
    /** Unified diff of the clone against the pristine fixture. */
    diff: () => string;
    passes_now: PassFn;
}

export function run_review(d: ReviewDeps): OrchestratedResult {
    const steps: StepRecord[] = [];
    const author = d.call({ role: 'author', prompt: d.requirement });
    steps.push(step_record('author', author));
    const pre_pass = d.passes_now();
    const reviewer = d.call({ role: 'reviewer', prompt: reviewer_prompt(d.requirement, d.diff()) });
    steps.push(step_record('reviewer', reviewer));
    const { findings } = parse_findings(String(reviewer['transcript'] ?? ''));
    let final_run = author;
    if (findings.length > 0) {
        final_run = d.call({ role: 'author-revision', prompt: revision_prompt(d.requirement, findings) });
        steps.push(step_record('author-revision', final_run));
    }
    return {
        final_run,
        steps,
        ...totals(steps),
        findings,
        pre_review_pass: pre_pass,
        findings_fp: pre_pass ? findings.length : 0,
        findings_confirmed: pre_pass ? 0 : findings.length,
        revised: findings.length > 0,
    };
}

/** `git diff --no-index` of the clone against the pristine fixture, excluding VCS/deps. */
export function fixture_diff(fixture: string, clone: string): string {
    const r = spawnSync('git', ['diff', '--no-index', '--no-color', '--', fixture, clone], { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 });
    return (r.stdout ?? '')
        .split(fixture)
        .join('a')
        .split(clone)
        .join('b')
        .slice(0, 60_000);
}

/** Run `test_source` against a scratch copy of the fixture with the reference patch applied. */
export function tests_pass_on_reference(fixture: string, patch_path: string, test_source: string): boolean {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'h17-ref-'));
    try {
        fs.cpSync(fixture, scratch, { recursive: true });
        const applied = spawnSync('git', ['apply', '--whitespace=nowarn', patch_path], { cwd: scratch, encoding: 'utf-8' });
        if (applied.status !== 0) throw new Error(`reference patch did not apply: ${applied.stderr}`);
        const dest = path.join(scratch, GENERATED_TEST_REL);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, test_source);
        const r = spawnSync('node', [GENERATED_TEST_REL], { cwd: scratch, encoding: 'utf-8', timeout: 60_000 });
        return r.status === 0;
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
}
