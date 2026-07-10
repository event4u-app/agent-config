#!/usr/bin/env node
/**
 * Deterministic domain-truth scorer (road-to-domain-soundness Phase 3).
 *
 * Pure, LLM-free scoring for the `deterministic` half of the domain-truth
 * fixtures (`skills/<skill>/evals/domain-truth.json`). Given a skill's run
 * output for a case and the case's `expected` + `tolerance`, it extracts the
 * numeric answer and returns pass/fail. It does NOT invoke any model — the
 * expensive part (running the skill against the scenario on a fixed host) is
 * the maintainer's Phase-3 gate; this only scores a captured output.
 *
 * Scoring contract (kept simple + gameable-input-resistant):
 *   - Prefer an explicit `ANSWER: <n>` line (case-insensitive) — the run
 *     prompt instructs the skill to end with one, so the echoed scenario
 *     numbers cannot be mistaken for the answer.
 *   - Fallback: the last numeric token in the output.
 *   - Normalization: strip `$`, thousands separators, surrounding whitespace,
 *     and a trailing unit token (`%`, `months`, `mo`, `x`, or stray letters).
 *     Scenarios fix the unit (e.g. "state in $M"), so no magnitude conversion
 *     is applied — a unit-instruction miss is a real fail, not a scorer bug.
 *   - Pass iff |extracted - expected| <= tolerance.
 *
 * Rubric cases are NOT scored here (they need a pinned judge, recorded as a
 * known-limit) — this scorer skips any case whose `check.kind !== "deterministic"`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface DeterministicCheck {
    kind: 'deterministic';
    expected: number | string;
    tolerance?: number;
    rationale: string;
}

export interface CaseResult {
    id: string;
    pass: boolean;
    expected: number;
    tolerance: number;
    extracted: number | null;
    reason: string;
}

/** Pull a single numeric answer out of a skill's run output. */
export function extractAnswer(output: string): number | null {
    if (typeof output !== 'string' || output.trim() === '') return null;
    // Prefer an explicit ANSWER: line (last one wins if repeated).
    const answerLines = output.match(/ANSWER:\s*([^\n\r]+)/gi);
    if (answerLines && answerLines.length > 0) {
        const last = answerLines[answerLines.length - 1] as string;
        const n = _firstNumber(last.replace(/ANSWER:\s*/i, ''));
        if (n !== null) return n;
    }
    // Fallback: the last numeric token anywhere in the output.
    return _lastNumber(output);
}

/** Normalize a fragment ("$1,350M", "7.5 months", "32%") to a bare number. */
function _firstNumber(fragment: string): number | null {
    const cleaned = fragment.replace(/[$,]/g, '');
    const m = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const v = Number(m[0]);
    return Number.isFinite(v) ? v : null;
}

function _lastNumber(text: string): number | null {
    const cleaned = text.replace(/[$,]/g, '');
    const all = cleaned.match(/-?\d+(?:\.\d+)?/g);
    if (!all || all.length === 0) return null;
    const v = Number(all[all.length - 1]);
    return Number.isFinite(v) ? v : null;
}

/** Score one deterministic case against a captured output string. */
export function scoreDeterministic(output: string, check: DeterministicCheck): {
    pass: boolean;
    extracted: number | null;
    expected: number;
    tolerance: number;
    reason: string;
} {
    const expected = typeof check.expected === 'number' ? check.expected : Number(check.expected);
    const tolerance = check.tolerance ?? 0;
    const extracted = extractAnswer(output);
    if (extracted === null || !Number.isFinite(expected)) {
        return {
            pass: false,
            extracted,
            expected,
            tolerance,
            reason: extracted === null ? 'no numeric answer found in output' : 'expected is not numeric',
        };
    }
    const delta = Math.abs(extracted - expected);
    const pass = delta <= tolerance;
    return {
        pass,
        extracted,
        expected,
        tolerance,
        reason: pass
            ? `|${extracted} - ${expected}| = ${_round(delta)} <= ${tolerance}`
            : `|${extracted} - ${expected}| = ${_round(delta)} > ${tolerance}`,
    };
}

function _round(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}

/**
 * Score a whole fixture against a map of {caseId -> captured output}. Rubric
 * cases are reported as `skipped` (kind !== deterministic), never silently
 * passed.
 */
export function scoreFixture(
    fixture: { skill: string; cases: Array<{ id: string; check: { kind: string; [k: string]: unknown } }> },
    outputs: Record<string, string>,
): { skill: string; results: CaseResult[]; skipped: string[] } {
    const results: CaseResult[] = [];
    const skipped: string[] = [];
    for (const c of fixture.cases) {
        if (c.check.kind !== 'deterministic') {
            skipped.push(c.id);
            continue;
        }
        const output = outputs[c.id] ?? '';
        const r = scoreDeterministic(output, c.check as unknown as DeterministicCheck);
        results.push({
            id: c.id,
            pass: r.pass,
            expected: r.expected,
            tolerance: r.tolerance,
            extracted: r.extracted,
            reason: output === '' ? 'no captured output for this case' : r.reason,
        });
    }
    return { skill: fixture.skill, results, skipped };
}

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * CLI: `score_domain_truth <skill> <outputs.json>` where outputs.json is a
 * `{ "<caseId>": "<captured skill output>" }` map. Prints a per-case table and
 * exits 0 iff every deterministic case passes (1 otherwise).
 */
function _runCli(argv: string[]): number {
    const [skill, outputsPath] = argv;
    if (!skill || !outputsPath) {
        process.stderr.write('usage: score_domain_truth <skill> <outputs.json>\n');
        return 2;
    }
    const fixturePath = path.join(REPO_ROOT, 'src', 'skills', skill, 'evals', 'domain-truth.json');
    if (!fs.existsSync(fixturePath)) {
        process.stderr.write(`error: no domain-truth.json for skill '${skill}' at ${fixturePath}\n`);
        return 1;
    }
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const outputs = JSON.parse(fs.readFileSync(path.resolve(outputsPath), 'utf-8')) as Record<string, string>;
    const { results, skipped } = scoreFixture(fixture, outputs);
    process.stdout.write(`domain-truth run — ${skill}\n`);
    for (const r of results) {
        const mark = r.pass ? '✅' : '❌';
        process.stdout.write(`  ${mark} ${r.id}: extracted=${r.extracted} expected=${r.expected} (±${r.tolerance}) — ${r.reason}\n`);
    }
    if (skipped.length > 0) {
        process.stdout.write(`  · skipped (rubric, needs pinned judge): ${skipped.join(', ')}\n`);
    }
    const passed = results.filter((r) => r.pass).length;
    process.stdout.write(`  ${passed}/${results.length} deterministic cases pass\n`);
    return passed === results.length && results.length > 0 ? 0 : 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(_runCli(process.argv.slice(2)));
}
