#!/usr/bin/env tsx
/**
 * `check_golden_intent` — a golden baseline changes only with a stated reason.
 *
 * The capture driver rewrites its own baseline, so a regenerated scenario looks
 * the same in review whether the drift was intended or accidental. For every
 * scenario directory `tests/golden/baseline/GT-<id>/` touched in the range, a
 * commit message in the range or the PR body must carry
 * `Golden-Intent: GT-<id> — <reason>` (`—` or `-`, non-empty reason). The id is
 * compared exactly, so a line for GT-U1 does not cover GT-U10.
 *
 * Usage: check_golden_intent [--base <ref>] [--head <ref>] [--pr-body-file <path>] [--self-test]
 * Defaults: --base origin/main, --head HEAD (range `base...head`).
 *
 * Exit codes: 0 satisfied or no scenario changed · 1 a changed scenario has no
 * intent line · 2 usage error or cannot run (unknown flag, bad ref, not a repo,
 * unreadable PR body file).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const GATE = 'check_golden_intent';
const BASELINE_PREFIX = 'tests/golden/baseline/';
const SCENARIO_RE = /^tests\/golden\/baseline\/(GT-[A-Za-z0-9_]+)\//;
const INTENT_RE = /^[ \t]*Golden-Intent:[ \t]*(GT-[A-Za-z0-9_]+)[ \t]+[—-][ \t]+\S/gm;

/** Scenario ids whose baseline directory a changed path sits in. */
export function changedScenarios(paths: readonly string[]): string[] {
    const ids = new Set<string>();
    for (const p of paths) {
        const m = SCENARIO_RE.exec(p.trim());
        if (m?.[1] !== undefined) ids.add(m[1]);
    }
    return [...ids].sort();
}

/** Scenario ids named by a well-formed `Golden-Intent:` line in `text`. */
export function declaredIntents(text: string): Set<string> {
    const ids = new Set<string>();
    for (const m of text.matchAll(INTENT_RE)) {
        if (m[1] !== undefined) ids.add(m[1]);
    }
    return ids;
}

function git(args: readonly string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
    const res = spawnSync('git', [...args], { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return { ok: res.status === 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function usage(msg: string): number {
    process.stderr.write(
        `❌  ${GATE}: ${msg}\n` +
            `    usage: ${GATE} [--base <ref>] [--head <ref>] [--pr-body-file <path>] [--self-test]\n`,
    );
    return 2;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let values: { base?: string; head?: string; 'pr-body-file'?: string; 'self-test'?: boolean };
    try {
        ({ values } = parseArgs({
            args: [...argv],
            strict: true,
            allowPositionals: false,
            options: {
                base: { type: 'string' },
                head: { type: 'string' },
                'pr-body-file': { type: 'string' },
                'self-test': { type: 'boolean' },
            },
        }));
    } catch (e) {
        return usage(e instanceof Error ? e.message : String(e));
    }
    if (values['self-test'] === true) return selfTest();

    const cwd = process.cwd();
    const base = values.base ?? 'origin/main';
    const head = values.head ?? 'HEAD';
    for (const ref of [base, head]) {
        if (!git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd).ok) {
            process.stderr.write(`❌  ${GATE}: cannot resolve ref '${ref}' to a commit — nothing was checked.\n`);
            return 2;
        }
    }

    let prBody = '';
    const bodyFile = values['pr-body-file'];
    if (bodyFile !== undefined) {
        try {
            prBody = fs.readFileSync(bodyFile, 'utf-8');
        } catch (e) {
            process.stderr.write(`❌  ${GATE}: cannot read --pr-body-file '${bodyFile}': ${String(e)}\n`);
            return 2;
        }
    }

    const diff = git(['diff', '--name-only', '--no-renames', `${base}...${head}`, '--', BASELINE_PREFIX], cwd);
    if (!diff.ok) {
        process.stderr.write(`❌  ${GATE}: git diff ${base}...${head} failed: ${diff.stderr.trim()}\n`);
        return 2;
    }
    const scenarios = changedScenarios(diff.stdout.split('\n'));
    reportScanned({
        gate: GATE,
        scanned: scenarios.length,
        units: 'changed scenario(s)',
        roots: [`git diff ${base}...${head} -- ${BASELINE_PREFIX}`],
        allowEmpty:
            'EMPTY_VALID: the scan root is a DIFF, and most changes touch no golden scenario. ' +
            'Both refs were verified above and a failed diff exits 2, so zero here means git ' +
            'answered "nothing under the baseline changed", not that a root moved.',
    });
    if (scenarios.length === 0) {
        process.stdout.write(`✅  ${GATE}: no golden scenario changed in ${base}...${head}.\n`);
        return 0;
    }

    const log = git(['log', '--format=%B%x00', `${base}..${head}`], cwd);
    if (!log.ok) {
        process.stderr.write(`❌  ${GATE}: git log ${base}..${head} failed: ${log.stderr.trim()}\n`);
        return 2;
    }
    const declared = declaredIntents(`${log.stdout}\n${prBody}`);
    const missing = scenarios.filter((id) => !declared.has(id));
    if (missing.length > 0) {
        process.stderr.write(
            `❌  ${GATE}: ${String(missing.length)} changed golden scenario(s) carry no intent line:\n` +
                missing.map((id) => `    ${id}\n`).join('') +
                '    Add one line per scenario to a commit message in the range or the PR body:\n' +
                '      Golden-Intent: GT-<id> — <why this baseline changed>\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅  ${GATE}: ${String(scenarios.length)} changed golden scenario(s), each with a Golden-Intent line.\n`,
    );
    return 0;
}

/** Floors for `--self-test`, declared here so a truncation is a visible diff. */
const SELF_TEST_MIN_CASES = 7;
const SELF_TEST_MIN_REJECT = 4;

function selfTest(): number {
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const script = path.join('src', 'scripts', 'check_golden_intent.ts');
    const roots: string[] = [];

    const fixture = (opts: { changed: string; message: string; prBody?: string; extraArgs?: string[] }): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gi-selftest-'));
        roots.push(dir);
        const put = (rel: string, body: string): void => {
            fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), body, 'utf-8');
        };
        const g = (...args: string[]): void => {
            spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
        };
        g('init', '-q', '-b', 'main');
        g('config', 'user.email', 'selftest@local');
        g('config', 'user.name', 'selftest');
        g('config', 'commit.gpgsign', 'false');
        put('tests/golden/baseline/GT-U1/exit-codes.json', '[0]\n');
        put('tests/golden/baseline/GT-U10/exit-codes.json', '[0]\n');
        put('README.md', 'fixture\n');
        g('add', '-A');
        g('commit', '-qm', 'base');
        g('checkout', '-qb', 'feat/x');
        put(opts.changed, '[1]\n');
        g('add', '-A');
        g('commit', '-qm', opts.message);
        const args = ['--base', 'main', '--head', 'HEAD', ...(opts.extraArgs ?? [])];
        if (opts.prBody !== undefined) {
            put('.pr-body.md', opts.prBody);
            args.push('--pr-body-file', path.join(dir, '.pr-body.md'));
        }
        return runGateCli(repo, script, args, dir);
    };

    const GT_U10 = 'tests/golden/baseline/GT-U10/exit-codes.json';
    const cases: SelfTestCase[] = [
        {
            name: 'baseline scenario changed, no intent line → reject',
            expect: 'reject',
            run: () => fixture({ changed: GT_U10, message: 'test: recapture golden' }),
        },
        {
            name: 'baseline scenario changed, intent line in the commit message → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    changed: GT_U10,
                    message: 'test: recapture golden\n\nGolden-Intent: GT-U10 — halt marker reworded on purpose\n',
                }),
        },
        {
            name: 'baseline scenario changed, intent line with a hyphen in the PR body → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    changed: GT_U10,
                    message: 'test: recapture golden',
                    prBody: '## Summary\n\nGolden-Intent: GT-U10 - halt marker reworded on purpose\n',
                }),
        },
        {
            name: 'change outside the baseline, no intent line → accept',
            expect: 'accept',
            run: () => fixture({ changed: 'README.md', message: 'docs: touch readme' }),
        },
        {
            name: 'lookalike intent line naming another scenario (GT-U1 for GT-U10) → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    changed: GT_U10,
                    message: 'test: recapture golden\n\nGolden-Intent: GT-U1 — halt marker reworded\n',
                }),
        },
        {
            name: 'intent line with an empty reason → reject',
            expect: 'reject',
            run: () => fixture({ changed: GT_U10, message: 'test: recapture golden\n\nGolden-Intent: GT-U10 — \n' }),
        },
        {
            name: 'unknown flag → reject (usage, exit 2)',
            expect: 'reject',
            run: () => fixture({ changed: 'README.md', message: 'docs: touch readme', extraArgs: ['--quiet'] }),
        },
    ];

    try {
        return runSelfTest({ gate: GATE, cases, minCases: SELF_TEST_MIN_CASES, minRejectCases: SELF_TEST_MIN_REJECT });
    } finally {
        for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
    }
}

function isCliEntry(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return pathToFileURL(path.resolve(entry)).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
}

if (isCliEntry()) {
    process.exit(main());
}
