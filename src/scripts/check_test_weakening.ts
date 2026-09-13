#!/usr/bin/env tsx
/**
 * check_test_weakening — a test that asserts less than it did needs a verdict.
 *
 * `road-to-adversarial-verification-and-long-runs` Phase 2.4, second of two.
 * `evaluator-independence` § Tests are evaluators forbids an implementer from
 * silently weakening an assertion, deleting a failing test, skipping it, or
 * loosening a threshold. This gate sees the shape of that in a diff.
 *
 * **NET counts, never raw removals — the whole gate turns on this.** Editing an
 * assertion removes one line and adds another, so a gate counting removals reds
 * every legitimate test edit. A gate that reds every PR gets its exemption
 * widened until it finds nothing, which is Risk 4 of the roadmap that
 * commissioned it and the allowlist-growth antipattern `autonomous-execution`
 * already names. A NET loss is a different, much narrower claim: after this
 * diff, the file asserts less than before.
 *
 * **What makes a weakening legitimate is an independent verdict**, and this gate
 * checks only that one was COMMITTED in the same diff. Whether it actually
 * contains an independent verdict is a judgement no gate can make, so it is not
 * claimed here.
 *
 * Usage:
 *   check_test_weakening [--diff-file F] [--files F …] [--base-ref REF]
 *                        [--root DIR] [--quiet] [--self-test]
 *
 * Exit codes: 0 = pass (or discharged) · 1 = fail · 2 = usage error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';
import {
    isTestPath,
    isVerdictArtefact,
    isWeakening,
    parseUnifiedDiff,
    weakeningSignal,
    type WeakeningSignal,
} from './_lib/test_delta.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

export interface WeakeningReport {
    readonly signals: readonly WeakeningSignal[];
    readonly discharged: boolean;
    readonly scanned: number;
}

/** The decision, pure: which test files weakened, and was a verdict committed. */
export function analyse(diff: string, changedFiles: readonly string[]): WeakeningReport {
    const files = parseUnifiedDiff(diff).filter((f) => isTestPath(f.path));
    const signals = files.map(weakeningSignal).filter(isWeakening);
    return {
        signals,
        discharged: changedFiles.some(isVerdictArtefact),
        scanned: files.length,
    };
}

/** One human-readable line per weakened file. */
export function renderSignal(s: WeakeningSignal): string {
    const parts: string[] = [];
    if (s.assertionsLost > 0) parts.push(`${String(s.assertionsLost)} assertion(s) net-removed`);
    if (s.suppressionsGained > 0) {
        parts.push(`${String(s.suppressionsGained)} suppression(s) net-added`);
    }
    return `${s.path}: ${parts.join(' · ')}`;
}

function git(args: readonly string[], root: string): string | null {
    const r = spawnSync('git', [...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
}

function resolveBaseRef(explicit: string | null, root: string): string {
    if (explicit !== null) return explicit;
    for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
        if (git(['rev-parse', '--verify', '--quiet', ref], root) !== null) return ref;
    }
    return 'HEAD~1';
}

function usage(): string {
    return (
        'usage: check_test_weakening [--diff-file F] [--files F …] [--base-ref REF]\n' +
        '                            [--root DIR] [--quiet] [--self-test]\n'
    );
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(usage());
        return 0;
    }
    if (argv.includes('--self-test')) return selfTest();

    const quiet = argv.includes('--quiet');
    const at = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i >= 0 ? (argv[i + 1] ?? null) : null;
    };
    const root = at('--root') ?? REPO;

    let diff: string;
    let changed: string[];
    const diffFile = at('--diff-file');
    const fi = argv.indexOf('--files');
    if (diffFile !== null) {
        try {
            diff = fs.readFileSync(diffFile, 'utf8');
        } catch {
            process.stderr.write(`check_test_weakening: cannot read ${diffFile}\n`);
            return 2;
        }
        changed = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : [];
    } else {
        const base = resolveBaseRef(at('--base-ref'), root);
        const d = git(['diff', '--unified=0', `${base}...HEAD`], root);
        const names = git(['diff', '--name-only', `${base}...HEAD`], root);
        if (d === null || names === null) {
            process.stderr.write('check_test_weakening: git diff failed\n');
            return 2;
        }
        diff = d;
        changed = names.split('\n').map((s) => s.trim()).filter((s) => s !== '');
    }

    // Per-file accounting: a changed test file either measured clean, measured
    // weakened, or was discharged by a committed verdict. Without it, "no test
    // file changed" and "every test file was skipped" print the same green line.
    const parsed = parseUnifiedDiff(diff);
    const ledger = new GateLedger('check_test_weakening');
    ledger.plan(parsed.map((f) => `file:${f.path}`));
    const report = analyse(diff, changed);
    const weakened = new Set(report.signals.map((s) => s.path));
    for (const f of parsed) {
        const target = `file:${f.path}`;
        if (!isTestPath(f.path)) {
            ledger.outOfScope(target, 'not_applicable_kind');
            continue;
        }
        if (!weakened.has(f.path)) ledger.complete(target);
        else if (report.discharged) ledger.outOfScope(target, 'declared_exemption');
        else ledger.fail(target, renderSignal(weakeningSignal(f)));
    }
    ledger.report();

    reportScanned({
        gate: 'check_test_weakening',
        scanned: report.scanned,
        units: 'changed test file(s)',
        roots: ['<the diff against the base ref>'],
        // A diff touching no test file is the normal case for a docs or config
        // change, and reporting it as a dead scope would make the gate cry wolf
        // on most of the PRs it runs against.
        allowEmpty: 'EMPTY_VALID: a diff that changes no test file has nothing to weaken',
    });

    if (report.signals.length === 0) {
        if (!quiet) {
            process.stdout.write(
                `✅  check_test_weakening: ${String(report.scanned)} test file(s), no net weakening\n`,
            );
        }
        return 0;
    }

    if (report.discharged) {
        process.stdout.write(
            `✅  check_test_weakening: ${String(report.signals.length)} weakened file(s), ` +
                'discharged by an independent-verdict artefact under agents/evidence/reviews/\n',
        );
        return 0;
    }

    process.stderr.write(
        `❌  check_test_weakening: ${String(report.signals.length)} test file(s) assert less ` +
            'than before, with no independent-verdict artefact in this diff:\n' +
            report.signals.map((s) => `  - ${renderSignal(s)}\n`).join('') +
            '  An implementer may not weaken a test silently (src/rules/evaluator-independence.md\n' +
            '  § Tests are evaluators). Where the test is genuinely wrong: evidence → independent\n' +
            '  test review → council or team, then commit the verdict under agents/evidence/reviews/.\n',
    );
    return 1;
}

function selfTest(): number {
    const withDiff = (diff: string, files: readonly string[] = []): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctw-'));
        const f = path.join(dir, 'd.diff');
        fs.writeFileSync(f, diff);
        try {
            const args = ['--diff-file', f, '--quiet'];
            if (files.length > 0) args.push('--files', ...files);
            return runGateCli(REPO, 'src/scripts/check_test_weakening.ts', args, dir);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
    const header = (p: string): string => `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@\n`;

    return runSelfTest({
        gate: 'check_test_weakening',
        minCases: 6,
        minRejectCases: 3,
        cases: [
            {
                name: 'a net-removed assertion is REJECTED',
                expect: 'reject',
                run: () =>
                    withDiff(header('tests/a.test.ts') + "-    expect(x).toBe(1);\n"),
            },
            {
                name: 'an added it.skip is REJECTED',
                expect: 'reject',
                run: () => withDiff(header('tests/a.test.ts') + "+    it.skip('x', () => {});\n"),
            },
            {
                name: 'an added @pytest.mark.skip is REJECTED — not a one-framework gate',
                expect: 'reject',
                run: () => withDiff(header('tests/a_test.py') + '+@pytest.mark.skip\n'),
            },
            {
                name: 'EDITING an assertion is not weakening — the net is zero',
                expect: 'accept',
                run: () =>
                    withDiff(
                        header('tests/a.test.ts') +
                            "-    expect(x).toBe(1);\n+    expect(x).toBe(2);\n",
                    ),
            },
            {
                name: 'ADDING assertions is never weakening',
                expect: 'accept',
                run: () =>
                    withDiff(
                        header('tests/a.test.ts') +
                            "+    expect(x).toBe(1);\n+    expect(y).toBe(2);\n",
                    ),
            },
            {
                name: 'a removed assertion in PRODUCTION code is out of scope',
                expect: 'accept',
                run: () => withDiff(header('src/a.ts') + '-    expect(x).toBe(1);\n'),
            },
            {
                name: 'REMOVING a skip is the opposite of weakening',
                expect: 'accept',
                run: () => withDiff(header('tests/a.test.ts') + "-    it.skip('x', () => {});\n"),
            },
            {
                name: 'a DIFF FIXTURE held as string data is not a suppression',
                expect: 'accept',
                run: () =>
                    withDiff(
                        header('tests/gate.test.ts') +
                            '+            \'+@pytest.mark.skip\\n\',\n',
                    ),
            },
            {
                name: '…and the same construct written as CODE still reds',
                expect: 'reject',
                run: () => withDiff(header('tests/gate.test.ts') + '+@pytest.mark.skip\n'),
            },
            {
                name: 'a committed verdict artefact discharges a real weakening',
                expect: 'accept',
                run: () =>
                    withDiff(header('tests/a.test.ts') + '-    expect(x).toBe(1);\n', [
                        'agents/evidence/reviews/some-review.md',
                    ]),
            },
        ],
    });
}

/* c8 ignore start — CLI entry, exercised by the self-test rather than in-process. */
if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href) {
    process.exit(main());
}
/* c8 ignore stop */
