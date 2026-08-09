#!/usr/bin/env tsx
/**
 * lint_never_silent — no shipped guidance may direct a silent re-run or the
 * concealment of a detected miss.
 *
 * The hidden `attempt → critic → re-attempt` mechanism — silently re-running a
 * turn so the user never notices the miss — was built, benchmarked and
 * falsified (capability Δ = 0; council verdict TERMINAL, recorded in
 * `src/skills/recursive-verification/SKILL.md`). The self-repair loop pins
 * "correction is always visible" as a non-goal boundary. This gate keeps that
 * boundary mechanical: a rule, skill, or command that *directs* an agent to
 * silently re-run, or to hide a detected failure, is a CI failure — while
 * prose that *describes* or *forbids* the falsified mechanism stays legal,
 * because describing the failure mode is how the corpus teaches against it.
 *
 * The describe-vs-direct split is decided per matching line:
 *   - a line carrying a negation / prohibition / falsification marker
 *     ("never", "forbidden", "must not", "falsified", "violation", …) is a
 *     DESCRIPTION and passes;
 *   - a line carrying an explicit `<!-- never-silent-allow: <reason> -->`
 *     marker (same line or the line above) passes;
 *   - anything else that matches is a DIRECTIVE and fails.
 *
 * Exit codes: 0 = clean, 1 = violations, 2 = usage.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.dirname(path.dirname(SCRIPTS_DIR));

/** The shipped-guidance surfaces the ban covers, relative to the repo root. */
export const SCAN_ROOTS = ['src/rules', 'src/skills', 'src/agent-src/commands'] as const;

export const ALLOW_MARKER = 'never-silent-allow:';

/**
 * The two directive families the falsified mechanism decomposes into:
 * re-running without telling, and concealing what was detected.
 */
const SILENT_RERUN_RES: readonly RegExp[] = [
    /\bsilent(?:ly)?\s+(?:re-?run|re-?runs|re-?attempt|retry|retries|re-?execute)\b/i,
    /\b(?:re-?run|re-?attempt|retry|re-?execute)\b[^.\n]{0,40}\bsilently\b/i,
];
const CONCEAL_RES: readonly RegExp[] = [
    /\b(?:hide|conceal|paper over|cover up|suppress)\b[^.\n]{0,50}\b(?:miss(?:es)?|failure|mistake|error|defect|violation)\b/i,
];

/**
 * A matching line that also carries one of these is prose ABOUT the mechanism —
 * a prohibition, a description of the falsified variant, or a named failure
 * mode — never a directive to perform it. Checked on the matching line AND the
 * line above it: markdown wraps sentences, so the negation of a bullet like
 * "Do NOT promise zero flake; … disguises silent retries" can sit one physical
 * line before the phrase that matches.
 */
const DESCRIPTION_MARKERS =
    /\b(?:never|niemals|no\b|kein\w*|forbidden|must not|do(?:es)? not|don'?t|won'?t|cannot|can not|falsified|benchmarked|anti-?pattern|violation|banned|prohibited|refus\w*|stays out|is the failure|non-goal|disguis\w*|mask\w*|not\b)/i;

export interface Violation {
    readonly file: string;
    readonly line: number;
    readonly text: string;
    readonly family: 'silent-rerun' | 'conceal-miss';
}

function matchFamily(line: string): Violation['family'] | null {
    if (SILENT_RERUN_RES.some((re) => re.test(line))) {
        return 'silent-rerun';
    }
    if (CONCEAL_RES.some((re) => re.test(line))) {
        return 'conceal-miss';
    }
    return null;
}

/** Pure per-file check — exported so the corpus behaviour is unit-testable. */
export function checkText(file: string, text: string): Violation[] {
    const out: Violation[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const family = matchFamily(line);
        if (family === null) {
            continue;
        }
        const prev = i > 0 ? lines[i - 1]! : '';
        if (DESCRIPTION_MARKERS.test(line) || DESCRIPTION_MARKERS.test(prev)) {
            continue;
        }
        if (line.includes(ALLOW_MARKER) || prev.includes(ALLOW_MARKER)) {
            continue;
        }
        out.push({ file, line: i + 1, text: line.trim(), family });
    }
    return out;
}

function collectMarkdown(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (e.isFile() && e.name.endsWith('.md')) {
                out.push(p);
            }
        }
    };
    walk(root);
    return out.sort();
}

function parseArgs(argv: readonly string[]): { quiet: boolean } {
    let quiet = false;
    for (const a of argv) {
        if (a === '--quiet') {
            quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_never_silent [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_never_silent: unrecognized argument: ${a}\n`);
            process.exit(2);
        }
    }
    return { quiet };
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lns-'));
    const mk = (body: string): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
        const p = path.join(root, 'src', 'rules', 'r.md');
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, `# R\n\n${body}\n`, 'utf-8');
        return root;
    };
    const run = (root: string): number => {
        process.env['LINT_NEVER_SILENT_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/lint_never_silent.ts', ['--quiet'], root);
        } finally {
            delete process.env['LINT_NEVER_SILENT_ROOT'];
        }
    };
    try {
        return runSelfTest({
            gate: 'lint_never_silent',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a directive to silently re-run the turn is rejected',
                    expect: 'reject',
                    run: () =>
                        run(mk('On a detected miss, silently re-run the turn and present the corrected answer.')),
                },
                {
                    name: 'a directive to conceal a detected failure is rejected',
                    expect: 'reject',
                    run: () => run(mk('If the gate fails, suppress the error and continue as if it passed.')),
                },
                {
                    name: 'a no-prefixed word (Note:, now) does not exonerate a directive — R2 finding #1',
                    expect: 'reject',
                    run: () => run(mk('Note: silently re-run the suite after fixing.')),
                },
                {
                    name: 'prose that FORBIDS the mechanism passes — describing is how the corpus teaches',
                    expect: 'accept',
                    run: () =>
                        run(mk('NEVER silently re-run the turn — that mechanism was built and falsified.')),
                },
                {
                    name: 'an explicit allow-marker passes',
                    expect: 'accept',
                    run: () =>
                        run(mk('<!-- never-silent-allow: negative example in documentation -->\nsilently re-run the turn')),
                },
                {
                    name: 'a clean rule passes',
                    expect: 'accept',
                    run: () => run(mk('Verify with the real tool and surface the result to the user.')),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv?: readonly string[]): number {
    const raw = argv ?? process.argv.slice(2);
    if (raw.includes('--self-test')) {
        return selfTest();
    }
    const args = parseArgs(raw);
    const root = process.env['LINT_NEVER_SILENT_ROOT'] ?? REAL_REPO_ROOT;

    const ledger = new GateLedger('lint_never_silent');
    const violations: Violation[] = [];
    let scanned = 0;
    for (const rel of SCAN_ROOTS) {
        for (const file of collectMarkdown(path.join(root, rel))) {
            ledger.plan(file);
            const found = checkText(path.relative(root, file), fs.readFileSync(file, 'utf-8'));
            scanned += 1;
            if (found.length > 0) {
                violations.push(...found);
                ledger.fail(file, `${String(found.length)} never-silent directive(s)`);
            } else {
                ledger.complete(file);
            }
        }
    }

    if (violations.length > 0) {
        process.stderr.write(`❌  lint_never_silent: ${String(violations.length)} violation(s):\n`);
        for (const v of violations) {
            process.stderr.write(
                `  • ${v.file}:${String(v.line)} [${v.family}] ${v.text}\n` +
                    '    Shipped guidance must not direct a silent re-run or the concealment of a\n' +
                    '    detected miss (the mechanism is falsified — correction is always visible).\n' +
                    `    Describing/forbidding it is fine; mark a deliberate negative example with\n` +
                    `    <!-- ${ALLOW_MARKER} <reason> --> on or above the line.\n`,
            );
        }
    } else if (!args.quiet) {
        process.stdout.write(`✅  never-silent clean — ${String(scanned)} shipped artefact(s).\n`);
    }

    ledger.report();
    reportScanned({
        gate: 'lint_never_silent',
        scanned,
        units: 'markdown artefact(s)',
        roots: [...SCAN_ROOTS],
    });
    return violations.length > 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
        return true;
    }
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
