#!/usr/bin/env tsx
/**
 * detect_verification_tampering — did the path to green weaken the verification?
 *
 * `verify-repair-loop` states the gap it cannot close in its own text: a loop
 * optimising for `pass_count >= N` "can game the metric — delete tests, skip
 * assertions, weaken checks — and still hit the threshold" (`SKILL.md:53-54`),
 * and "the numeric gate cannot catch this" (`:185`). Its answer is a
 * fresh-context judge, which is a good answer and a probabilistic one. This is
 * the deterministic half: given the diff between a failing run and the next
 * attempt, decide by shape whether the verification got weaker.
 *
 * No model call. No network. The input is a unified diff, a commit message, and
 * optionally a recorded runner verdict.
 *
 * ## THIS IS NOT A CI GATE, AND THE NAME SAYS SO
 *
 * It is `detect_*`, not `check_*` / `lint_*`, and that is a claim about scope
 * rather than a way around a counter. `_lib/gate_population.ts` classifies a
 * script as gate-shaped by the prefixes `lint|check|audit|skill|verify`, and
 * this script is deliberately outside that set for the reason
 * `road-to-deterministic-defect-detectors` step 1.3 states: the tree's own
 * measured lesson is that reach, not content, is the scarce thing, so a new
 * always-on gate is the opposite of the lesson. It is invoked BY THE LOOP, on
 * the loop's own diff, and it is registered in no CI task closure — so it adds
 * no row to `gate-coverage.yml` and no member to the `check_gate_completeness`
 * population. Promoting it is a later decision that owes a measured
 * false-positive rate first, exactly as step 3.2 requires of its sibling.
 *
 * ## Self-honesty
 *
 * This detector must not commit the defects it detects. It contains no
 * `catch` that discards its error, no skipped test, and no assertion it
 * weakened to pass: `--self-test` drives the real CLI over the committed
 * corpus and refuses to pass below a floor of cases, so deleting a case is
 * not a route to green.
 *
 * CLI:
 *   detect_verification_tampering --diff <file> [--message <s>|--message-file <f>]
 *   detect_verification_tampering --diff <file> --verdict <verdict.json>
 *   detect_verification_tampering --corpus            # run the whole fixture manifest
 *   detect_verification_tampering --self-test         # drive the real CLI over it
 *
 * Exit codes — the outcome, not just pass/fail:
 *   0 clean · 1 violations (a `block` finding) · 2 usage error or crash
 *   3 warn-only violations · 4 stale_verdict
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { parseUnifiedDiff, type DiffFile, type DiffHunk, type DiffLine } from './_lib/unified_diff.js';
import {
    assertWellFormed,
    detectorSpec,
    locate,
    parseAllowDeclarations,
    type LoopOutcome,
    type TamperDetectorId,
    type TamperFinding,
} from './_lib/tamper_vocabulary.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS = path.join(REPO_ROOT, 'tests/fixtures/tamper-corpus');
const SELF_TEST_MIN_CASES = 14;
const SELF_TEST_MIN_REJECT = 7;

/* ------------------------------------------------------------------ shapes */

/** A line that asserts something, in any of the stacks this tree touches. */
const ASSERTION_RE =
    /(\bexpect\s*\(|\bassert[A-Za-z]*\s*\(|\bassert\s+|->assert[A-Za-z]*\s*\(|\bself\.assert[A-Za-z]*\s*\(|\.should\b|\bt\.(?:Error|Fatal)f?\s*\(|\brequire\.[A-Za-z]+\s*\()/;

/**
 * Assertion strength, high to low. The ladder is the whole of
 * `assertion-weakened`: an exact-value check that becomes an existence check
 * still passes, and still passes for the broken output.
 */
const STRENGTH_TIERS: ReadonlyArray<readonly [number, RegExp]> = [
    [
        3,
        /\.(?:toBe|toEqual|toStrictEqual|toHaveBeenCalledWith)\s*\(|\bassert(?:Equals|Same|Is|Identical)\s*\(|\bassertEquals\b|\bassert\s+[^=<>!]+==/,
    ],
    [
        2,
        /\.(?:toContain|toMatch|toHaveLength|toBeGreaterThan|toBeLessThan|toBeCloseTo)\s*\(|\bassert(?:Contains|Count|GreaterThan|LessThan|Matches)\s*\(/,
    ],
    [
        1,
        /\.(?:toBeDefined|toBeTruthy|toBeFalsy|toBeNull|toBeUndefined|toBeInstanceOf)\s*\(|\bassert(?:NotNull|NotEmpty|True|False|IsNotNone|IsNone)\s*\(/,
    ],
];

const SKIP_RE =
    /(\b(?:it|test|describe|context|suite)\s*\.\s*(?:skip|only)\s*\(|\bx(?:it|describe|test)\s*\(|@pytest\.mark\.(?:skip|skipif|xfail)|@unittest\.skip|->markTestSkipped\s*\(|\bt\.Skip(?:Now)?\s*\(|#\[ignore\]|\.only\s*\()/;

/** The WHOLE line is an unconditional exit. A guarded `if (x) return;` is not. */
const UNCONDITIONAL_EXIT_RE =
    /^\s*(?:return(?:\s+(?:true|None|nil|null))?\s*;?|process\.exit\(\s*0\s*\)\s*;?|sys\.exit\(\s*0?\s*\)|os\.Exit\(\s*0\s*\)\s*;?|exit\(\s*0\s*\)\s*;?)\s*$/;

const MOCK_RE =
    /(\b(?:vi|jest)\s*\.\s*mock\s*\(|\bsinon\s*\.\s*(?:stub|mock)\s*\(|\bmock\.patch\s*\(|@patch\s*\(|monkeypatch\.setattr\s*\(|Mockery::mock\s*\(|->shouldReceive\s*\(|->createMock\s*\(|\bcreateMock\s*\()/;

/** Identifiers that appear in every mock call and prove nothing. */
const MOCK_API_WORDS = new Set([
    'mock', 'jest', 'sinon', 'patch', 'stub', 'vitest', 'monkeypatch', 'setattr',
    'Mockery', 'createMock', 'shouldReceive', 'return', 'const', 'function',
]);

const TEST_PATH_RE =
    /(^|\/)(?:tests?|spec|specs|__tests__)\//i;
const TEST_FILE_RE =
    /(?:[._-](?:test|spec)\.[A-Za-z]+$|(?:^|\/)test_[^/]+\.py$|Test\.php$|_test\.go$)/;

function isTestPath(p: string): boolean {
    return TEST_PATH_RE.test(p) || TEST_FILE_RE.test(p);
}

function isAssertion(text: string): boolean {
    return ASSERTION_RE.test(text);
}

/** 3 exact · 2 relational · 1 existence · 0 unranked assertion. */
export function assertionStrength(text: string): number {
    for (const [tier, re] of STRENGTH_TIERS) {
        if (re.test(text)) return tier;
    }
    return 0;
}

/** Strip literals so two spellings of the same assertion compare equal. */
export function normalizeAssertion(text: string): string {
    return text
        .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, 'S')
        .replace(/\b\d+(?:\.\d+)?\b/g, 'N')
        .replace(/\s+/g, ' ')
        .trim();
}

/* --------------------------------------------------------------- detectors */

function finding(
    id: TamperDetectorId,
    file: string,
    l: DiffLine,
): TamperFinding {
    return assertWellFormed({
        id,
        severity: detectorSpec(id).severity,
        file,
        line: l.line,
        side: l.side === 'removed' ? 'removed' : 'added',
        evidence: l.text.trim(),
    });
}

function scanDeletedFile(file: DiffFile): TamperFinding[] {
    // A wholly deleted file yields exactly ONE finding. Reporting every
    // assertion inside it as separately removed would bury the real claim
    // under its own consequences.
    if (!isTestPath(file.path)) return [];
    const firstHunk = file.hunks[0];
    const firstLine = firstHunk?.lines[0];
    return [
        assertWellFormed({
            id: 'test-file-deleted',
            severity: detectorSpec('test-file-deleted').severity,
            file: file.path,
            line: firstLine?.line ?? 1,
            side: 'removed',
            evidence: `whole test file deleted (${String(firstHunk?.lines.length ?? 0)} lines)`,
        }),
    ];
}

function scanHunkAssertions(filePath: string, hunk: DiffHunk): TamperFinding[] {
    const removed = hunk.lines.filter((l) => l.side === 'removed' && isAssertion(l.text));
    const added = hunk.lines.filter((l) => l.side === 'added' && isAssertion(l.text));
    if (removed.length === 0) return [];

    const out: TamperFinding[] = [];
    const pairedAdded = new Set<DiffLine>();
    const pairedRemoved = new Set<DiffLine>();

    // 1. Same assertion, different literal → the expectation moved onto the output.
    for (const r of removed) {
        const rNorm = normalizeAssertion(r.text);
        for (const a of added) {
            if (pairedAdded.has(a)) continue;
            if (normalizeAssertion(a.text) === rNorm && a.text.trim() !== r.text.trim()) {
                out.push(finding('expectation-rewritten', filePath, a));
                pairedAdded.add(a);
                pairedRemoved.add(r);
                break;
            }
        }
    }

    const restRemoved = removed.filter((r) => !pairedRemoved.has(r));
    const restAdded = added.filter((a) => !pairedAdded.has(a));
    if (restRemoved.length === 0) return out;

    // 2. Something replaced it, lower on the ladder → weakened.
    if (restAdded.length > 0) {
        const strongestRemoved = Math.max(...restRemoved.map((r) => assertionStrength(r.text)));
        for (const a of restAdded) {
            if (assertionStrength(a.text) < strongestRemoved) {
                out.push(finding('assertion-weakened', filePath, a));
            }
        }
        return out;
    }

    // 3. Nothing replaced it → removed outright.
    for (const r of restRemoved) {
        out.push(finding('assertion-removed', filePath, r));
    }
    return out;
}

function scanHunkSkips(filePath: string, hunk: DiffHunk): TamperFinding[] {
    return hunk.lines
        .filter((l) => l.side === 'added' && SKIP_RE.test(l.text))
        .map((l) => finding('verification-skipped', filePath, l));
}

function scanHunkEarlyExit(filePath: string, hunk: DiffHunk): TamperFinding[] {
    const out: TamperFinding[] = [];
    hunk.lines.forEach((l, i) => {
        if (l.side !== 'added' || !UNCONDITIONAL_EXIT_RE.test(l.text)) return;
        // Only a finding when verification survives BELOW it — otherwise the
        // return is an ordinary end-of-function line.
        const survives = hunk.lines
            .slice(i + 1)
            .some((below) => below.side !== 'removed' && isAssertion(below.text));
        if (survives) out.push(finding('early-exit-injected', filePath, l));
    });
    return out;
}

function identifiers(text: string): string[] {
    return (text.match(/[A-Za-z_][A-Za-z0-9_]{3,}/g) ?? []).filter((w) => !MOCK_API_WORDS.has(w));
}

function scanFileMocks(file: DiffFile): TamperFinding[] {
    const removedText: string[] = [];
    for (const h of file.hunks) {
        for (const l of h.lines) {
            if (l.side === 'removed') removedText.push(l.text);
        }
    }
    if (removedText.length === 0) return [];
    const out: TamperFinding[] = [];
    for (const h of file.hunks) {
        for (const l of h.lines) {
            if (l.side !== 'added' || !MOCK_RE.test(l.text)) continue;
            const hit = identifiers(l.text).some((word) =>
                removedText.some((r) => r.includes(word)),
            );
            if (hit) out.push(finding('subject-mocked-away', file.path, l));
        }
    }
    return out;
}

/** Every finding in one diff, before the allow declarations are applied. */
export function scanDiff(diffText: string): TamperFinding[] {
    const files = parseUnifiedDiff(diffText);
    const out: TamperFinding[] = [];
    for (const file of files) {
        if (file.deleted) {
            out.push(...scanDeletedFile(file));
            continue;
        }
        if (file.added) continue;
        for (const hunk of file.hunks) {
            out.push(...scanHunkAssertions(file.path, hunk));
            out.push(...scanHunkSkips(file.path, hunk));
            out.push(...scanHunkEarlyExit(file.path, hunk));
        }
        out.push(...scanFileMocks(file));
    }
    return out;
}

/* -------------------------------------------------- phantom verification */

export interface RecordedVerdict {
    status?: string;
    ran_at?: string;
    last_edit_at?: string;
}

/**
 * A green verdict whose runner finished before the last edit is not evidence.
 *
 * Reported for a red verdict too: a stale red is not evidence of failure
 * either, and passing it through would make the outcome depend on which way a
 * run over the wrong tree happened to land.
 */
export function verdictIsStale(v: RecordedVerdict): boolean {
    if (typeof v.ran_at !== 'string' || typeof v.last_edit_at !== 'string') return false;
    const ran = Date.parse(v.ran_at);
    const edited = Date.parse(v.last_edit_at);
    if (Number.isNaN(ran) || Number.isNaN(edited)) return false;
    return ran < edited;
}

/* --------------------------------------------------------------- analysis */

export interface Analysis {
    outcome: LoopOutcome;
    findings: TamperFinding[];
    suppressed: TamperFinding[];
    malformedAllows: string[];
    staleVerdict: boolean;
}

export function analyze(
    diffText: string,
    message: string,
    verdict: RecordedVerdict | null,
): Analysis {
    const { allowed, malformed } = parseAllowDeclarations(message);
    const all = scanDiff(diffText);
    const findings = all.filter((f) => !allowed.has(f.id));
    const suppressed = all.filter((f) => allowed.has(f.id));
    const stale = verdict !== null && verdictIsStale(verdict);

    let outcome: LoopOutcome;
    if (stale) {
        // Stale beats everything: nothing downstream of a verdict that never
        // saw the change is worth grading.
        outcome = 'stale_verdict';
    } else if (malformed.length > 0) {
        // A declaration that does not parse suppressed nothing and must not
        // read to its author as an accepted exception.
        outcome = 'violations';
    } else if (findings.some((f) => f.severity === 'block')) {
        outcome = 'violations';
    } else if (findings.length > 0) {
        outcome = 'violations';
    } else {
        outcome = 'clean';
    }
    return { outcome, findings, suppressed, malformedAllows: malformed, staleVerdict: stale };
}

export function exitCodeFor(a: Analysis): number {
    if (a.staleVerdict) return 4;
    if (a.malformedAllows.length > 0) return 1;
    if (a.findings.some((f) => f.severity === 'block')) return 1;
    if (a.findings.length > 0) return 3;
    return 0;
}

export function render(a: Analysis): string {
    const lines: string[] = [`outcome: ${a.outcome}`];
    if (a.staleVerdict) {
        lines.push(
            'stale_verdict — the recorded runner finished BEFORE the last edit in the loop, ' +
                'so its exit code describes a tree that no longer exists. Re-run before claiming anything.',
        );
    }
    for (const m of a.malformedAllows) lines.push(`malformed declaration: ${m} (nothing was suppressed)`);
    for (const f of a.findings) {
        lines.push(`${f.severity.toUpperCase()}  ${f.id}  ${locate(f)}  ${f.evidence}`);
        lines.push(`       why: ${detectorSpec(f.id).why}`);
    }
    for (const f of a.suppressed) {
        lines.push(`allowed ${f.id}  ${locate(f)}  (declared in the commit message)`);
    }
    if (a.findings.length === 0 && !a.staleVerdict && a.malformedAllows.length === 0) {
        lines.push('the path to green did not weaken the verification');
    }
    return lines.join('\n');
}

/* ----------------------------------------------------------------- corpus */

interface Fixture {
    id: string;
    diff: string;
    kind: 'positive' | 'negative';
    expect: string[];
    message: string;
    why: string;
}

export function loadCorpus(root: string = CORPUS): Fixture[] {
    const raw = fs.readFileSync(path.join(root, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { fixtures: Fixture[] };
    return parsed.fixtures;
}

function runCorpus(write: (s: string) => void): number {
    const fixtures = loadCorpus();
    let failed = 0;
    for (const f of fixtures) {
        const diffText = fs.readFileSync(path.join(CORPUS, f.diff), 'utf-8');
        const a = analyze(diffText, f.message, null);
        const got = a.findings.map((x) => x.id).sort();
        const want = [...f.expect].sort();
        const ok = JSON.stringify(got) === JSON.stringify(want);
        if (!ok) failed += 1;
        write(
            `${ok ? 'OK  ' : 'FAIL'} ${f.kind.padEnd(8)} ${f.id.padEnd(34)} ` +
                `expect [${want.join(', ')}] got [${got.join(', ')}]\n`,
        );
        if (!ok) {
            for (const x of a.findings) write(`        ${x.id} ${locate(x)} ${x.evidence}\n`);
        }
    }
    write(`\nscanned: ${String(fixtures.length)}\n`);
    write(`${String(fixtures.length - failed)}/${String(fixtures.length)} fixtures behaved\n`);
    return failed > 0 ? 1 : 0;
}

/* -------------------------------------------------------------- self-test */

function selfTest(): number {
    const rel = 'src/scripts/detect_verification_tampering.ts';
    const fixtures = loadCorpus();
    const cases: SelfTestCase[] = fixtures.map((f) => ({
        name: `${f.kind}/${f.id}`,
        expect: f.kind === 'positive' ? 'reject' : 'accept',
        run: () =>
            runGateCli(
                REPO_ROOT,
                rel,
                ['--diff', path.join(CORPUS, f.diff), '--message', f.message],
                REPO_ROOT,
            ),
    }));
    for (const [name, file, expect] of [
        ['verdict/stale-green', 'stale-green.json', 'reject'],
        ['verdict/stale-red', 'stale-red.json', 'reject'],
        ['verdict/fresh-green', 'fresh-green.json', 'accept'],
    ] as const) {
        cases.push({
            name,
            expect,
            run: () =>
                runGateCli(
                    REPO_ROOT,
                    rel,
                    [
                        '--diff',
                        path.join(CORPUS, 'diffs/neg-assertion-added.diff'),
                        '--verdict',
                        path.join(CORPUS, 'verdicts', file),
                    ],
                    REPO_ROOT,
                ),
        });
    }
    cases.push({
        name: 'declaration/unknown-id-suppresses-nothing',
        expect: 'reject',
        run: () =>
            runGateCli(
                REPO_ROOT,
                rel,
                [
                    '--diff',
                    path.join(CORPUS, 'diffs/test-file-deleted.diff'),
                    '--message',
                    'fix: green it\n\ntamper-allow: test-files-deleted — a plausible reason with a typo in the id',
                ],
                REPO_ROOT,
            ),
    });
    return runSelfTest({
        gate: 'detect_verification_tampering',
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECT,
    });
}

/* ------------------------------------------------------------------- main */

function usage(): never {
    process.stderr.write(
        'usage: detect_verification_tampering --diff <file> [--message <s>|--message-file <f>]\n' +
            '                                    [--verdict <verdict.json>] [--json]\n' +
            '       detect_verification_tampering --corpus | --self-test\n',
    );
    process.exit(2);
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    if (argv.includes('--corpus')) return runCorpus((s) => process.stdout.write(s));

    let diffPath: string | null = null;
    let message = '';
    let verdictPath: string | null = null;
    let json = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--diff') { diffPath = argv[++i] ?? null; }
        else if (a === '--message') { message = argv[++i] ?? ''; }
        else if (a === '--message-file') { message = fs.readFileSync(argv[++i] ?? '', 'utf-8'); }
        else if (a === '--verdict') { verdictPath = argv[++i] ?? null; }
        else if (a === '--json') { json = true; }
        else usage();
    }
    if (diffPath === null) usage();

    const diffText = fs.readFileSync(diffPath, 'utf-8');
    const verdict =
        verdictPath === null
            ? null
            : (JSON.parse(fs.readFileSync(verdictPath, 'utf-8')) as RecordedVerdict);
    const analysis = analyze(diffText, message, verdict);
    process.stdout.write(
        (json ? JSON.stringify(analysis, null, 2) : render(analysis)) + '\n',
    );
    return exitCodeFor(analysis);
}

const invokedDirectly =
    process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (err) {
        // Rethrown as an exit-2 crash with the error text preserved. Never
        // swallowed: a detector that reported clean because it threw would be
        // the phantom green this file exists to catch.
        process.stderr.write(`detect_verification_tampering crashed: ${String(err)}\n`);
        process.exit(2);
    }
}
