#!/usr/bin/env tsx
/**
 * detect_silent_catch — a newly introduced error swallow, decided from the diff.
 *
 * Prose coverage for this failure already exists in three places —
 * `error-handling-patterns`, `ai-code-blindspots`, and
 * `testing-anti-patterns/process-anti-patterns.md` — and nothing decided it:
 * `ls src/scripts/ | grep -icE 'swallow|bare_except'` returned 0 when this was
 * written. Prose that nothing checks is a preference.
 *
 * SCOPE — the lines the diff ADDS.
 *
 * A pre-existing empty catch is debt this check does not own. The block must
 * be wholly contained in added lines; a block whose body reaches into context
 * lines is skipped. `neg-preexisting-empty-catch` in the corpus pins that — the
 * same empty catch as unchanged context beside one unrelated added line must
 * stay silent. If it ever fires, this has quietly become a whole-tree sweep,
 * which is a different tool with a different false-positive budget.
 *
 * TWO SHAPES, both unambiguous.
 *
 *   `catch-empty`            no statements at all in the block
 *   `catch-discards-error`   statements, but the caught value is never used,
 *                            logged, or re-raised
 *
 * A COMMENT IS NOT A STATEMENT. That is deliberate and it is the roadmap's
 * risk register answered directly: "a `pass  # intentional` comment satisfies
 * a naive shape check while changing nothing, so the detector teaches evasion
 * rather than discipline". Comments and `pass` / `...` are stripped before the
 * block is judged, so neither rescues an empty block.
 *
 * NO ESCAPE-HATCH MARKER, deliberately.
 *
 * Every other suppression in this tree is a declared, reasoned marker. This
 * check has none, because it is WARN-ONLY: it blocks nothing, so a marker
 * would buy no unblocking and would be exactly the one-token evasion above,
 * wearing the house convention's clothes. Revisit together with promotion —
 * a blocking version owes a hatch, a warning one does not.
 *
 * WARN-FIRST, and what that means for the exit code.
 *
 * Exit 0 on findings by default: this is a REPORT. `--strict` turns findings
 * into exit 1 and exists so `--self-test` can prove the detection discriminates
 * at all — a report-mode gate cannot be turned red by a fixture, which is the
 * same shape `lint_consolidation_lineage` records in `gate-coverage.yml`.
 *
 * CLI:
 *   detect_silent_catch --diff <file> [--strict] [--json]
 *   detect_silent_catch --range <base>..<head>   # count over merged history
 *   detect_silent_catch --corpus | --self-test
 *
 * Exit codes: 0 clean or report-mode findings · 1 findings under `--strict`,
 * or a corpus/self-test failure · 2 usage error or crash.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { parseUnifiedDiff, type DiffFile, type DiffLine } from './_lib/unified_diff.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests/fixtures/silent-catch-corpus');
const SELF_TEST_MIN_CASES = 12;
const SELF_TEST_MIN_REJECT = 6;

export type SilentCatchId = 'catch-empty' | 'catch-discards-error';

export interface SilentCatchFinding {
    id: SilentCatchId;
    file: string;
    line: number;
    evidence: string;
}

/** Brace-language opener: `catch (e) {`, `catch {`, `} catch (\Throwable $e) {`. */
const BRACE_CATCH_RE = /\bcatch\s*(?:\(([^)]*)\))?\s*\{/;
/** Python opener: `except:` / `except X:` / `except X as e:`. */
const PY_EXCEPT_RE = /^\s*except\b([^:]*):\s*$/;

/** The caught value reached something that observes it. */
const RETHROW_RE = /\b(?:throw|raise|panic|rethrow)\b/;
const LOG_RE =
    /\b(?:log|logger|logging|console|Log|Logger|report|captureException|Sentry|trace|warn|error|debug|emit)\b/i;

/**
 * Strip a trailing line comment.
 *
 * Load-bearing, and it was missing on the first implementation: without it
 * `pass  # intentional` is not equal to `pass`, so the block read as
 * non-empty and the check stayed silent. That is the roadmap's Risk 3
 * verbatim — "a `pass  # intentional` comment satisfies a naive shape check
 * while changing nothing" — reproduced by the detector that exists to close
 * it. Caught by its own test, fixed here, pinned by a fixture.
 *
 * Narrow by construction: truncating a line that merely contains `//` inside
 * a string can only matter if what remains is exactly `pass`, `...`, or a
 * brace, and no real statement reduces to those.
 */
function stripTrailingComment(text: string): string {
    return text.replace(/\s*(?:#|\/\/).*$/, '');
}

/** A line that is only a comment, or only a no-op statement. */
function isNonStatement(text: string): boolean {
    const t = stripTrailingComment(text).trim();
    if (t === '') return true;
    if (t === 'pass' || t === '...' || t === '{' || t === '}' || t === '};') return true;
    if (t.startsWith('//') || t.startsWith('#') || t.startsWith('/*') || t.startsWith('*')) return true;
    return false;
}

/** Identifier bound by `catch (e)` / `except X as e` — `null` when unbound. */
export function boundName(header: string): string | null {
    const m = /(?:^|[\s(])(?:[\w\\.$]+\s+)?\$?([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(header.trim());
    if (header.trim() === '') return null;
    const asMatch = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(header);
    if (asMatch !== null) return asMatch[1] ?? null;
    return m?.[1] ?? null;
}

/**
 * Judge one catch body.
 *
 * `null` when the body is fine. Comments and `pass` are already excluded by
 * {@link isNonStatement}, so an "explanatory" comment cannot make an empty
 * block non-empty.
 */
export function judgeBody(bound: string | null, body: readonly string[]): SilentCatchId | null {
    const statements = body.filter((l) => !isNonStatement(l));
    if (statements.length === 0) return 'catch-empty';
    const joined = statements.join('\n');
    if (RETHROW_RE.test(joined)) return null;
    if (LOG_RE.test(joined)) return null;
    if (bound !== null && new RegExp(`\\b${bound}\\b`).test(joined)) return null;
    if (bound === null) return null; // unbound catch with real statements: not decidable by shape
    return 'catch-discards-error';
}

interface AddedBlock {
    lines: DiffLine[];
}

/** Runs of consecutive added lines — the only region this check reads. */
function addedRuns(file: DiffFile): AddedBlock[] {
    const runs: AddedBlock[] = [];
    for (const hunk of file.hunks) {
        let current: DiffLine[] = [];
        for (const l of hunk.lines) {
            if (l.side === 'added') {
                current.push(l);
            } else if (current.length > 0) {
                runs.push({ lines: current });
                current = [];
            }
        }
        if (current.length > 0) runs.push({ lines: current });
    }
    return runs;
}

function scanBraceRun(filePath: string, run: readonly DiffLine[]): SilentCatchFinding[] {
    const out: SilentCatchFinding[] = [];
    for (let i = 0; i < run.length; i += 1) {
        const line = run[i];
        if (line === undefined) continue;
        const m = BRACE_CATCH_RE.exec(line.text);
        if (m === null) continue;
        const bound = boundName(m[1] ?? '');

        // Single-line form: the body is whatever sits between the braces.
        const after = line.text.slice((m.index ?? 0) + m[0].length);
        if (after.includes('}')) {
            const inner = after.slice(0, after.indexOf('}'));
            const verdict = judgeBody(bound, [inner]);
            if (verdict !== null) {
                out.push({ id: verdict, file: filePath, line: line.line, evidence: line.text.trim() });
            }
            continue;
        }

        // Multi-line form: walk added lines only, tracking brace depth.
        let depth = 1;
        const body: string[] = [];
        let closed = false;
        for (let j = i + 1; j < run.length; j += 1) {
            const inner = run[j];
            if (inner === undefined) break;
            for (const ch of inner.text) {
                if (ch === '{') depth += 1;
                else if (ch === '}') depth -= 1;
            }
            if (depth <= 0) { closed = true; break; }
            body.push(inner.text);
        }
        // Not closed inside the added run → the block reaches pre-existing
        // lines and is out of scope. Silence is the correct answer.
        if (!closed) continue;
        const verdict = judgeBody(bound, body);
        if (verdict !== null) {
            out.push({ id: verdict, file: filePath, line: line.line, evidence: line.text.trim() });
        }
    }
    return out;
}

function indentOf(text: string): number {
    return text.length - text.replace(/^\s*/, '').length;
}

function scanPythonRun(filePath: string, run: readonly DiffLine[]): SilentCatchFinding[] {
    const out: SilentCatchFinding[] = [];
    for (let i = 0; i < run.length; i += 1) {
        const line = run[i];
        if (line === undefined) continue;
        const m = PY_EXCEPT_RE.exec(line.text);
        if (m === null) continue;
        const bound = boundName(m[1] ?? '');
        const openIndent = indentOf(line.text);
        const body: string[] = [];
        for (let j = i + 1; j < run.length; j += 1) {
            const inner = run[j];
            if (inner === undefined) break;
            if (inner.text.trim() !== '' && indentOf(inner.text) <= openIndent) break;
            body.push(inner.text);
        }
        const verdict = judgeBody(bound, body);
        if (verdict !== null) {
            out.push({ id: verdict, file: filePath, line: line.line, evidence: line.text.trim() });
        }
    }
    return out;
}

const PY_RE = /\.py$/;

export function scanDiff(diffText: string): SilentCatchFinding[] {
    const out: SilentCatchFinding[] = [];
    for (const file of parseUnifiedDiff(diffText)) {
        if (file.deleted) continue;
        for (const run of addedRuns(file)) {
            out.push(
                ...(PY_RE.test(file.path)
                    ? scanPythonRun(file.path, run.lines)
                    : scanBraceRun(file.path, run.lines)),
            );
        }
    }
    return out;
}

export function render(findings: readonly SilentCatchFinding[], strict: boolean): string {
    if (findings.length === 0) return 'no newly introduced silent catch in this diff';
    const lines = findings.map(
        (f) => `${strict ? 'ERROR' : 'WARN '} ${f.id}  ${f.file}:${String(f.line)}  ${f.evidence}`,
    );
    lines.push(
        `\n${String(findings.length)} finding(s). Warn-first: this check blocks nothing until its ` +
            'false-positive rate over merged history is measured and written down.',
    );
    return lines.join('\n');
}

/* ----------------------------------------------------------------- corpus */

interface Fixture {
    id: string;
    diff: string;
    kind: 'positive' | 'negative';
    expect: string[];
    why: string;
}

export function loadCorpus(root: string = CORPUS): Fixture[] {
    const raw = fs.readFileSync(path.join(root, 'manifest.json'), 'utf-8');
    return (JSON.parse(raw) as { fixtures: Fixture[] }).fixtures;
}

function runCorpus(write: (s: string) => void): number {
    const fixtures = loadCorpus();
    let failed = 0;
    for (const f of fixtures) {
        const got = scanDiff(fs.readFileSync(path.join(CORPUS, f.diff), 'utf-8'))
            .map((x) => x.id)
            .sort();
        const want = [...f.expect].sort();
        const ok = JSON.stringify(got) === JSON.stringify(want);
        if (!ok) failed += 1;
        write(
            `${ok ? 'OK  ' : 'FAIL'} ${f.kind.padEnd(8)} ${f.id.padEnd(32)} ` +
                `expect [${want.join(', ')}] got [${got.join(', ')}]\n`,
        );
    }
    write(`\nscanned: ${String(fixtures.length)}\n`);
    write(`${String(fixtures.length - failed)}/${String(fixtures.length)} fixtures behaved\n`);
    return failed > 0 ? 1 : 0;
}

/* ------------------------------------------------------------------ range */

/**
 * Count findings over a recorded commit range — the baseline step 3.2 requires
 * before promotion is discussed at all.
 */
function runRange(range: string, write: (s: string) => void): number {
    const revs = execFileSync('git', ['rev-list', '--no-merges', range], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        maxBuffer: 256 * 1024 * 1024,
    })
        .split('\n')
        .filter((l) => l.trim() !== '');
    let total = 0;
    const perCommit: Array<{ sha: string; n: number }> = [];
    for (const sha of revs) {
        const diff = execFileSync('git', ['show', '--format=', '--unified=3', sha], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            maxBuffer: 256 * 1024 * 1024,
        });
        const n = scanDiff(diff).length;
        total += n;
        if (n > 0) perCommit.push({ sha: sha.slice(0, 9), n });
    }
    for (const c of perCommit) write(`${c.sha}  ${String(c.n)} finding(s)\n`);
    write(`\nrange: ${range}\n`);
    write(`scanned: ${String(revs.length)}\n`);
    write(`commits with at least one finding: ${String(perCommit.length)}\n`);
    write(`total findings: ${String(total)}\n`);
    return 0;
}

/* -------------------------------------------------------------- self-test */

function selfTest(): number {
    const rel = 'src/scripts/detect_silent_catch.ts';
    const cases: SelfTestCase[] = loadCorpus().map((f) => ({
        name: `${f.kind}/${f.id}`,
        expect: f.kind === 'positive' ? 'reject' : 'accept',
        // `--strict` is what makes a report-mode check provable: without it a
        // planted violation could never turn it red, and a check that cannot
        // go red proves nothing.
        run: () => runGateCli(REPO_ROOT, rel, ['--diff', path.join(CORPUS, f.diff), '--strict'], REPO_ROOT),
    }));
    return runSelfTest({
        gate: 'detect_silent_catch',
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECT,
    });
}

/* ------------------------------------------------------------------- main */

function usage(): never {
    process.stderr.write(
        'usage: detect_silent_catch --diff <file> [--strict] [--json]\n' +
            '       detect_silent_catch --range <base>..<head>\n' +
            '       detect_silent_catch --corpus | --self-test\n',
    );
    process.exit(2);
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    if (argv.includes('--corpus')) return runCorpus((s) => process.stdout.write(s));

    let diffPath: string | null = null;
    let range: string | null = null;
    let strict = false;
    let json = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--diff') { diffPath = argv[++i] ?? null; }
        else if (a === '--range') { range = argv[++i] ?? null; }
        else if (a === '--strict') { strict = true; }
        else if (a === '--json') { json = true; }
        else usage();
    }
    if (range !== null) return runRange(range, (s) => process.stdout.write(s));
    if (diffPath === null) usage();

    const findings = scanDiff(fs.readFileSync(diffPath, 'utf-8'));
    process.stdout.write(
        (json ? JSON.stringify(findings, null, 2) : render(findings, strict)) + '\n',
    );
    return strict && findings.length > 0 ? 1 : 0;
}

const invokedDirectly =
    process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (err) {
        // Never swallowed — this file's whole subject is the swallow.
        process.stderr.write(`detect_silent_catch crashed: ${String(err)}\n`);
        process.exit(2);
    }
}
