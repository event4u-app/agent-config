#!/usr/bin/env tsx
/**
 * check_test_delta — a code change with no credible test delta is a finding.
 *
 * `road-to-adversarial-verification-and-long-runs` Phase 2.4, first of two. The
 * rule `test-first` states that a behaviour change gets a failing test first;
 * nothing could see whether one arrived. This gate sees the cheap half: a diff
 * that touches production code and touches no test at all.
 *
 * **What it deliberately cannot see.** Whether the test came FIRST, and whether
 * it tests the thing that changed. Both are judgements about intent and content
 * that no diff carries, and claiming them here would be the coverage inflation
 * `evaluator-independence` exists over. This gate proves an ABSENCE, which is
 * the one thing about a diff that is mechanically decidable.
 *
 * **The exemption is owner-set, and that is Risk 4's mitigation.** A gate that
 * reds a legitimate PR invites the cheapest repair — widening the exemption until
 * the gate finds nothing. So the escape is a PR LABEL a human applies, mirroring
 * `check_kernel_rule_bundle`'s `bundled-always-rules-acknowledged`: it is visible
 * on the PR, it is one click for the owner, and no agent can apply it by editing
 * a file in the diff under review.
 *
 * Usage:
 *   check_test_delta [--files F …] [--base-ref REF] [--root DIR]
 *                    [--label NAME] [--event-path P] [--quiet] [--self-test]
 *
 * Exit codes: 0 = pass (or exempted) · 1 = fail · 2 = usage error / dead scope.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';
import { isCodePath, isTestPath } from './_lib/test_delta.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

/** The label an owner applies to accept a code change with no test delta. */
export const DEFAULT_LABEL = 'test-delta-acknowledged';

export interface DeltaVerdict {
    readonly code: string[];
    readonly tests: string[];
    readonly scanned: number;
}

/** Classify a changed-file list. Pure — the whole decision, without I/O. */
export function classify(files: readonly string[]): DeltaVerdict {
    return {
        code: files.filter(isCodePath),
        tests: files.filter(isTestPath),
        scanned: files.length,
    };
}

/** The finding, or `null`. Separated from rendering so a test reads the decision. */
export function findingFor(v: DeltaVerdict): string | null {
    if (v.code.length === 0) return null;
    if (v.tests.length > 0) return null;
    const shown = v.code.slice(0, 5).join(', ');
    const more = v.code.length > 5 ? `, +${String(v.code.length - 5)} more` : '';
    return (
        `${String(v.code.length)} code path(s) changed and no test path did: ${shown}${more}. ` +
        `A behaviour change gets a test (src/rules/test-first.md). If this change genuinely ` +
        `has no testable behaviour, apply the \`${DEFAULT_LABEL}\` label to the PR — that is ` +
        `an owner decision, deliberately not a file an agent can edit inside this diff.`
    );
}

function gitChangedFiles(baseRef: string, root: string): string[] | null {
    const r = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
        cwd: root,
        encoding: 'utf8',
    });
    if (r.status !== 0) return null;
    return r.stdout
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '');
}

function resolveBaseRef(explicit: string | null, root: string): string {
    if (explicit !== null) return explicit;
    for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
        const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
            cwd: root,
            encoding: 'utf8',
        });
        if (r.status === 0) return ref;
    }
    return 'HEAD~1';
}

/** PR labels from the GitHub event JSON, or `[]` when there is none to read. */
export function labelsFrom(eventPath: string | null): string[] {
    if (eventPath === null || eventPath === '') return [];
    try {
        const raw = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as Record<string, unknown>;
        const pr = raw['pull_request'] as { labels?: unknown } | undefined;
        const labels = Array.isArray(pr?.labels) ? pr.labels : [];
        return labels
            .map((l) => (l as { name?: unknown }).name)
            .filter((n): n is string => typeof n === 'string');
    } catch {
        return [];
    }
}

function usage(): string {
    return (
        'usage: check_test_delta [--files F …] [--base-ref REF] [--root DIR]\n' +
        '                        [--label NAME] [--event-path P] [--quiet] [--self-test]\n'
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
    const label = at('--label') ?? DEFAULT_LABEL;
    const eventPath = at('--event-path') ?? process.env['GITHUB_EVENT_PATH'] ?? null;

    let files: string[];
    const fi = argv.indexOf('--files');
    if (fi >= 0) {
        files = argv.slice(fi + 1).filter((a) => !a.startsWith('--'));
    } else {
        const fromGit = gitChangedFiles(resolveBaseRef(at('--base-ref'), root), root);
        if (fromGit === null) {
            process.stderr.write('check_test_delta: git diff failed\n');
            return 2;
        }
        files = fromGit;
    }

    // Per-path accounting, so "no code changed" and "code changed and nothing
    // was looked at" stop printing the same green line. Every changed path is a
    // planned target: a code path completes or fails, and everything else is out
    // of scope by classification rather than silently skipped.
    const ledger = new GateLedger('check_test_delta');
    ledger.plan(files.map((f) => `path:${f}`));

    const verdict = classify(files);
    const finding0 = findingFor(verdict);
    for (const f of files) {
        const target = `path:${f}`;
        if (!isCodePath(f)) {
            ledger.outOfScope(target, 'not_applicable_kind');
            continue;
        }
        if (finding0 === null) ledger.complete(target);
        else ledger.fail(target, `${f}: no test path changed alongside it`);
    }
    ledger.report();

    reportScanned({
        gate: 'check_test_delta',
        scanned: verdict.scanned,
        units: 'changed path(s)',
        roots: ['<the diff against the base ref>'],
        // A diff with nothing in it is a real state — a docs-only branch, or a
        // re-run against an already-merged base — and it is not this gate's job
        // to red on it. Declared rather than silently passing a zero.
        allowEmpty: 'EMPTY_VALID: a diff with no changed files carries no code change to gate',
    });

    const finding = finding0;
    if (finding === null) {
        if (!quiet) {
            process.stdout.write(
                `✅  check_test_delta: ${String(verdict.code.length)} code path(s), ` +
                    `${String(verdict.tests.length)} test path(s)\n`,
            );
        }
        return 0;
    }

    if (labelsFrom(eventPath).includes(label)) {
        process.stdout.write(
            `✅  check_test_delta: exempted by the \`${label}\` label — ` +
                'an owner accepted a code change with no test delta.\n',
        );
        return 0;
    }

    process.stderr.write(`❌  check_test_delta: ${finding}\n`);
    return 1;
}

function selfTest(): number {
    const run = (files: Record<string, string>, args: readonly string[] = []): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctd-'));
        try {
            return runGateCli(
                REPO,
                'src/scripts/check_test_delta.ts',
                ['--root', dir, '--quiet', ...args],
                dir,
            );
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
            void files;
        }
    };
    const eventWith = (labels: string[]): string => {
        const f = path.join(
            fs.mkdtempSync(path.join(os.tmpdir(), 'ctd-ev-')),
            'event.json',
        );
        fs.writeFileSync(f, JSON.stringify({ pull_request: { labels: labels.map((name) => ({ name })) } }));
        return f;
    };

    return runSelfTest({
        gate: 'check_test_delta',
        minCases: 6,
        minRejectCases: 2,
        cases: [
            {
                name: 'code change with no test delta is REJECTED',
                expect: 'reject',
                run: () => run({}, ['--files', 'src/scripts/thing.ts']),
            },
            {
                name: 'several code changes with no test delta are REJECTED',
                expect: 'reject',
                run: () => run({}, ['--files', 'src/a.ts', 'src/b.ts', 'docs/x.md']),
            },
            {
                name: 'code change WITH a test delta passes',
                expect: 'accept',
                run: () => run({}, ['--files', 'src/scripts/thing.ts', 'tests/scripts/thing.test.ts']),
            },
            {
                name: 'a co-located *.test.ts counts as the test delta',
                expect: 'accept',
                run: () => run({}, ['--files', 'src/a.ts', 'src/a.test.ts']),
            },
            {
                name: 'docs-only change is not a code change',
                expect: 'accept',
                run: () => run({}, ['--files', 'docs/x.md', 'README.md']),
            },
            {
                name: 'a generated projection is not an independent code change',
                expect: 'accept',
                run: () => run({}, ['--files', 'dist/agent-src/scripts/thing.ts']),
            },
            {
                name: 'the owner label exempts a real finding',
                expect: 'accept',
                run: () =>
                    run({}, [
                        '--files',
                        'src/scripts/thing.ts',
                        '--event-path',
                        eventWith([DEFAULT_LABEL]),
                    ]),
            },
            {
                name: 'an unrelated label does NOT exempt it',
                expect: 'reject',
                run: () =>
                    run({}, [
                        '--files',
                        'src/scripts/thing.ts',
                        '--event-path',
                        eventWith(['documentation']),
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
