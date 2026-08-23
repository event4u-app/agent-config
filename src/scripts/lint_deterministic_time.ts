#!/usr/bin/env tsx
/**
 * CI gate: a gate script does not read the wall clock directly.
 *
 * WHY. A gate's verdict should be a function of the tree, not of the hour it
 * ran. Measured on 2026-08-23, before this gate existed, **17** of the
 * `check_*` / `lint_*` scripts under `src/scripts/` read the clock inline, every
 * one of them to make an age or staleness judgement. None of those 17 verdicts
 * was reproducible from the commit alone: the same tree greens on Monday and
 * reds on Friday, and a reviewer cannot recover which "now" produced the verdict
 * CI published.
 *
 * `src/scripts/_lib/as_of.ts` is the seam that fixes it — one resolver, four
 * rungs (`--as-of` argv, `AC_AS_OF` env, the commit date under CI, and the wall
 * clock with an explicit non-reproducibility WARN). This gate is what stops the
 * defect coming back: substituting the seam once is a diff, keeping it
 * substituted is a ratchet.
 *
 * SCOPE is deliberately the gate prefixes only (`check_*`, `lint_*` under
 * `src/scripts/`). A generator, a bench runner, or a hook legitimately reads
 * real time; a *verdict* should not. Widening this to the whole tree would turn
 * a determinism ratchet into a style rule and earn the suppressions that come
 * with one.
 *
 * WHY THE MATCH RUNS OVER STRIPPED SOURCE. This file's own docstring names the
 * construct it forbids, and its self-test fixtures are string literals
 * containing it. A gate whose scope includes its own filename (`lint_*` does)
 * and which matched raw text would refuse itself — so comments and string /
 * template literals are blanked to spaces (line numbers preserved) before the
 * patterns run. The same reason `check_no_automerge_key` anchors on a key rather
 * than a word.
 *
 * THE ESCAPE HATCH, AND WHY IT IS NARROW. `// wall-clock-required: <reason>` on
 * the offending line exempts it, and the reason is mandatory — a bare marker is
 * still a finding. It exists for the one legitimate case this ratchet must not
 * break: measuring *elapsed duration* inside a single run, where real time is
 * the subject rather than a threshold input. Prefer `performance.now()` there;
 * the marker is for when a `Date` is genuinely what the API needs.
 *
 * Exit codes:
 *   0 — no gate script reads the wall clock directly
 *   1 — at least one raw wall-clock read (or a marker with no reason)
 *   2 — the gate could not run (dead scan scope, bad args)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger, LedgerUsageError } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.join(path.dirname(_HERE), '..', '..');

/** This script's repo-relative path, for the self-test's CLI invocations. */
const SELF = 'src/scripts/lint_deterministic_time.ts';

const SELF_TEST_MIN_CASES = 6;
const SELF_TEST_MIN_REJECT = 3;

/** The directory the gate walks, and the prefixes that make a file a gate. */
const SCAN_DIR = 'src/scripts';
const GATE_PREFIXES = ['check_', 'lint_'] as const;

/**
 * The single sanctioned reader of the wall clock. Repo-relative, and outside
 * {@link GATE_PREFIXES} by construction, so it is never in the scan set — named
 * here so the failure message can point at it.
 */
const SEAM = 'src/scripts/_lib/as_of.ts';

/** Same-line exemption. The reason after the colon must be non-empty. */
const MARKER = 'wall-clock-required:';

/**
 * The forbidden constructs. Written as tolerant regexes rather than literals so
 * this file's own source does not contain the strings it bans — see the
 * docstring's note on stripped source; belt and braces, and the belt is cheap.
 */
const PATTERNS: readonly { id: string; re: RegExp; shown: string }[] = [
    { id: 'date-now', re: /\bDate\s*\.\s*now\s*\(\s*\)/g, shown: 'Date' + '.now()' },
    { id: 'new-date', re: /\bnew\s+Date\s*\(\s*\)/g, shown: 'new ' + 'Date()' },
];

/**
 * Neutralise every non-code region, preserving line numbers and line lengths so
 * a match's line number is still the source's.
 *
 * Two details are load-bearing and were both found by running this gate against
 * the real corpus before trusting it:
 *
 * 1. **Comments become spaces, string bodies become `x`.** Blanking a string to
 *    spaces collapses `new Date("2026-01-01")` into `new Date(          )`,
 *    which the empty-parens pattern then matches — a false positive on a
 *    perfectly deterministic parse. `check_knowledge_pages.ts:103` is exactly
 *    that shape. Filling with a non-space keeps the argument visible as *an*
 *    argument without keeping its content.
 * 2. **`${...}` inside a template literal is code.** Blanking it wholesale hid a
 *    real finding: `check_gate_coverage.ts:982` reads the clock inside a
 *    template substitution, and the first draft of this gate reported it clean.
 *
 * Regex literals are left alone deliberately: a regex describing the forbidden
 * construct (this file's own {@link PATTERNS}) does not itself match it, so
 * there is nothing to hide, and detecting a regex literal from a `/` needs
 * expression context this scanner does not have.
 */
export function stripNonCode(src: string): string {
    const out = src.split('');
    const n = src.length;
    const put = (i: number, ch: string): void => {
        if (out[i] !== '\n') out[i] = ch;
    };

    /** `//` to end of line. */
    function lineComment(i: number): number {
        while (i < n && src[i] !== '\n') put(i++, ' ');
        return i;
    }
    /** `/*` to the closing delimiter. */
    function blockComment(i: number): number {
        put(i++, ' ');
        put(i++, ' ');
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) put(i++, ' ');
        if (i < n) {
            put(i++, ' ');
            put(i++, ' ');
        }
        return i;
    }
    /** A `'` or `"` literal; an unterminated one stops at the newline. */
    function simpleString(i: number): number {
        const quote = src[i];
        put(i++, 'x');
        while (i < n) {
            if (src[i] === '\\') {
                put(i++, 'x');
                if (i < n) put(i++, 'x');
                continue;
            }
            if (src[i] === quote) {
                put(i++, 'x');
                break;
            }
            if (src[i] === '\n') break;
            put(i++, 'x');
        }
        return i;
    }
    /** A `\`` literal, recursing into every `${...}` as code. */
    function template(i: number): number {
        put(i++, 'x');
        while (i < n) {
            if (src[i] === '\\') {
                put(i++, 'x');
                if (i < n) put(i++, 'x');
                continue;
            }
            if (src[i] === '`') {
                put(i++, 'x');
                break;
            }
            if (src[i] === '$' && src[i + 1] === '{') {
                i = substitution(i + 2);
                continue;
            }
            put(i++, 'x');
        }
        return i;
    }
    /** Code inside `${ ... }`, up to the brace that closes it. */
    function substitution(i: number): number {
        let depth = 1;
        while (i < n && depth > 0) {
            const c = src[i];
            const next = src[i + 1];
            if (c === '/' && next === '/') {
                i = lineComment(i);
                continue;
            }
            if (c === '/' && next === '*') {
                i = blockComment(i);
                continue;
            }
            if (c === "'" || c === '"') {
                i = simpleString(i);
                continue;
            }
            if (c === '`') {
                i = template(i);
                continue;
            }
            if (c === '{') depth += 1;
            if (c === '}') depth -= 1;
            i += 1;
        }
        return i;
    }

    let i = 0;
    while (i < n) {
        const c = src[i];
        const next = src[i + 1];
        if (c === '/' && next === '/') {
            i = lineComment(i);
            continue;
        }
        if (c === '/' && next === '*') {
            i = blockComment(i);
            continue;
        }
        if (c === "'" || c === '"') {
            i = simpleString(i);
            continue;
        }
        if (c === '`') {
            i = template(i);
            continue;
        }
        i += 1;
    }
    return out.join('');
}

export interface Finding {
    file: string;
    line: number;
    construct: string;
    /** `raw` — an unmarked read. `bare-marker` — a marker with no reason. */
    kind: 'raw' | 'bare-marker';
}

/** Does this raw line carry a marker, and does the marker carry a reason? */
function markerOn(rawLine: string): 'none' | 'bare' | 'reasoned' {
    const at = rawLine.indexOf(MARKER);
    if (at < 0) return 'none';
    return rawLine.slice(at + MARKER.length).trim() === '' ? 'bare' : 'reasoned';
}

export function scanSource(relPath: string, src: string): Finding[] {
    const rawLines = src.split('\n');
    const codeLines = stripNonCode(src).split('\n');
    const findings: Finding[] = [];
    for (let n = 0; n < codeLines.length; n += 1) {
        const code = codeLines[n] ?? '';
        for (const pat of PATTERNS) {
            pat.re.lastIndex = 0;
            if (!pat.re.test(code)) continue;
            const marker = markerOn(rawLines[n] ?? '');
            if (marker === 'reasoned') continue;
            findings.push({
                file: relPath,
                line: n + 1,
                construct: pat.shown,
                kind: marker === 'bare' ? 'bare-marker' : 'raw',
            });
        }
    }
    return findings;
}

/** Repo-relative paths of every gate script under {@link SCAN_DIR}. */
export function gateScripts(root: string): string[] {
    const dir = path.join(root, SCAN_DIR);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return entries
        .filter(
            (name) =>
                name.endsWith('.ts') &&
                !name.endsWith('.test.ts') &&
                GATE_PREFIXES.some((p) => name.startsWith(p)),
        )
        .sort()
        .map((name) => `${SCAN_DIR}/${name}`);
}

export function check(root: string): { code: number; findings: Finding[]; scanned: number } {
    const files = gateScripts(root);
    const findings: Finding[] = [];
    const ledger = new GateLedger('lint_deterministic_time');

    try {
        reportScanned({
            gate: 'lint_deterministic_time',
            scanned: files.length,
            units: 'gate script(s)',
            roots: [SCAN_DIR],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return { code: 2, findings, scanned: files.length };
        }
        throw err;
    }

    try {
        ledger.plan(files);
        for (const rel of files) {
            const found = scanSource(rel, fs.readFileSync(path.join(root, rel), 'utf-8'));
            if (found.length > 0) {
                findings.push(...found);
                ledger.fail(rel, `${String(found.length)} raw wall-clock read(s)`);
            } else {
                ledger.complete(rel);
            }
        }
    } catch (err) {
        if (err instanceof LedgerUsageError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return { code: 2, findings, scanned: files.length };
        }
        throw err;
    }
    ledger.report();

    return { code: findings.length > 0 ? 1 : 0, findings, scanned: files.length };
}

/* ------------------------------------------------------------------ *
 * Self-test
 * ------------------------------------------------------------------ */

function fixtureRoot(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-time-'));
    fs.mkdirSync(path.join(dir, SCAN_DIR), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, SCAN_DIR, name), body);
    }
    return dir;
}

const CLEAN_GATE = ['import { asOf } from ', "'./_lib/as_of.js';", '\nconst now = asOf();\n'].join('');

export function selfTest(): number {
    const made: string[] = [];
    const run = (files: Record<string, string>): number => {
        const d = fixtureRoot(files);
        made.push(d);
        return runGateCli(DEFAULT_ROOT, SELF, ['--quiet', '--root', d], DEFAULT_ROOT);
    };
    // Built by concatenation so this file's own source stays clean.
    const rawNow = 'const t = ' + 'Date' + '.now();\n';
    const rawNew = 'const d = new ' + 'Date();\n';

    const cases: SelfTestCase[] = [
        {
            name: `rejects a planted ${PATTERNS[0].shown} in a check_ script`,
            expect: 'reject',
            run: () => run({ 'check_planted.ts': rawNow }),
        },
        {
            name: `rejects a planted bare ${PATTERNS[1].shown} in a lint_ script`,
            expect: 'reject',
            run: () => run({ 'lint_planted.ts': rawNew }),
        },
        {
            name: 'rejects a marker with no reason',
            expect: 'reject',
            run: () => run({ 'check_planted.ts': rawNow.trimEnd() + ' // ' + MARKER + '\n' }),
        },
        {
            name: 'accepts a marker carrying a reason',
            expect: 'accept',
            run: () =>
                run({
                    'check_ok.ts': rawNow.trimEnd() + ' // ' + MARKER + ' elapsed-duration probe\n',
                }),
        },
        {
            name: 'accepts a mention inside a comment or a string literal',
            expect: 'accept',
            run: () =>
                run({
                    'check_prose.ts':
                        '// forbids ' + 'Date' + '.now()\nconst s = "new ' + 'Date()";\n',
                }),
        },
        {
            name: 'accepts a gate that routes through the seam',
            expect: 'accept',
            run: () => run({ 'check_ok.ts': CLEAN_GATE }),
        },
        {
            name: 'rejects a moved scan root rather than reporting clean (exit 2)',
            expect: 'reject',
            run: () =>
                runGateCli(
                    DEFAULT_ROOT,
                    SELF,
                    ['--quiet', '--root', path.join(DEFAULT_ROOT, 'no-such-root')],
                    DEFAULT_ROOT,
                ),
        },
    ];

    try {
        return runSelfTest({
            gate: 'lint_deterministic_time',
            cases,
            minCases: SELF_TEST_MIN_CASES,
            minRejectCases: SELF_TEST_MIN_REJECT,
        });
    } finally {
        for (const d of made) fs.rmSync(d, { recursive: true, force: true });
    }
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('--self-test')) return selfTest();
    const quiet = args.includes('--quiet');
    const rootIdx = args.indexOf('--root');
    const root = rootIdx >= 0 ? (args[rootIdx + 1] ?? DEFAULT_ROOT) : DEFAULT_ROOT;

    const { code, findings, scanned } = check(root);
    if (code === 2) return 2;

    if (findings.length > 0) {
        process.stdout.write('❌  gate script(s) read the wall clock directly:\n\n');
        for (const f of findings) {
            const why =
                f.kind === 'bare-marker'
                    ? `\`${MARKER}\` with no reason`
                    : `raw \`${f.construct}\``;
            process.stdout.write(`  ${f.file}:${String(f.line)} — ${why}\n`);
        }
        process.stdout.write(
            `\nA verdict that depends on the hour it ran is not reproducible from the\n` +
                `commit. Route through \`asOf()\` in ${SEAM} — it resolves --as-of, AC_AS_OF,\n` +
                `the commit date under CI, and the wall clock with an explicit WARN.\n` +
                `If real elapsed time IS the subject, say so on the line:\n` +
                `  // ${MARKER} <reason>\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  no raw wall-clock read in ${String(scanned)} gate script(s) under ${SCAN_DIR}/.\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { SCAN_DIR, GATE_PREFIXES, SEAM, MARKER };
