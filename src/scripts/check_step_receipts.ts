#!/usr/bin/env tsx
/**
 * Every roadmap step a pull request ticks carries a receipt.
 *
 * Reads only the PR's own diff (`<base>...HEAD`, renames followed): a step line
 * that becomes `- [x] **<id>` there must carry a `<!-- receipt: … -->` marker,
 * the line `step_receipt` prints. A tick that already existed at the base —
 * edited, moved into an archive, or untouched — is not read, so the estate's
 * older unreceipted ticks never red a later PR.
 *
 * The receipt is what lets a lowered ceremony depth be audited afterwards; a
 * step ticked without one is a step whose class nobody can check. So the check
 * blocks only once something can be lowered: while the depth table is in
 * `shadow` mode it reports and exits 0, and from the flip on it refuses.
 * `--enforce` refuses regardless of the table.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_step_receipts [--base <ref>] [--root <dir>] [--enforce]
 *   ./scripts-run src/scripts/check_step_receipts --self-test
 *
 * Exit 0 clean or report-only · 1 a newly ticked step without a receipt while
 * enforcing · 2 usage or git error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';
import { classifyPaths } from './classify_change_risk.js';
import { isStructurallySafe, parseReceipt } from './_lib/depth_flip.js';
import { DEPTH_TABLE_REL, loadDepthTable, type DepthTable } from './step_receipt.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SCRIPT_REL = 'src/scripts/check_step_receipts.ts';
const ROADMAP_ROOT = 'agents/roadmaps';

const TICK = /^- \[x\] \*\*([^\s*]+)/;
const RECEIPT = /<!--\s*receipt:/;

export interface MissingReceipt {
    file: string;
    step: string;
}

/**
 * Newly ticked steps without a receipt, from a `git diff -U0 --find-renames` text.
 *
 * A step counts as newly ticked when an added line ticks it and no removed line
 * of the same file ticked it already — a reworded or relocated tick is not new.
 */
export function missingReceipts(diff: string): { files: number; missing: MissingReceipt[]; lowered: MissingReceipt[] } {
    const perFile = new Map<string, { added: string[]; removed: string[] }>();
    let current: { added: string[]; removed: string[] } | null = null;
    for (const line of diff.split('\n')) {
        if (line.startsWith('+++ ')) {
            const target = line.slice(4).replace(/^b\//, '');
            current = target === '/dev/null' ? null : { added: [], removed: [] };
            if (current !== null) {
                perFile.set(target, current);
            }
            continue;
        }
        if (current === null || line.startsWith('--- ')) {
            continue;
        }
        if (line.startsWith('+')) {
            current.added.push(line.slice(1));
        } else if (line.startsWith('-')) {
            current.removed.push(line.slice(1));
        }
    }
    const missing: MissingReceipt[] = [];
    const lowered: MissingReceipt[] = [];
    for (const [file, { added, removed }] of perFile) {
        const tickedBefore = new Set(removed.map((l) => TICK.exec(l)?.[1]).filter((id): id is string => id !== undefined));
        for (const line of added) {
            const step = TICK.exec(line)?.[1];
            if (step === undefined || tickedBefore.has(step)) continue;
            if (!RECEIPT.test(line)) missing.push({ file, step });
            else if (parseReceipt(line)?.mode === 'active') lowered.push({ file, step });
        }
    }
    return { files: perFile.size, missing, lowered };
}

/**
 * Whether this diff may carry a receipt that claims a lowered depth. A receipt
 * is written by hand, so its class and mode are not trusted: a lowered claim
 * stands only when the table is active and the WHOLE diff — every path any of
 * its steps touched — is structurally safe and of a flip class. One step's
 * paths cannot be recovered from the diff, so the whole diff is the bound.
 */
export function loweredClaimAllowed(table: DepthTable, diffPaths: readonly string[]): boolean {
    return table.mode === 'active' && isStructurallySafe(diffPaths) && table.flip.classes.includes(classifyPaths(diffPaths).cls);
}

function roadmapDiff(root: string, base: string): string | null {
    const res = spawnSync(
        'git',
        ['diff', '-U0', '--find-renames', '--no-color', `${base}...HEAD`, '--', `${ROADMAP_ROOT}/`],
        { cwd: root, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 },
    );
    return res.status === 0 ? res.stdout : null;
}

function diffPaths(root: string, base: string): string[] {
    const res = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return res.status === 0 ? res.stdout.split('\n').filter((p) => p !== '') : [];
}

function selfTest(repoRoot: string): number {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'step-receipts-'));
    const git = (...args: string[]): void => {
        const res = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
        if (res.status !== 0) {
            throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
        }
    };
    const roadmap = (body: string, name = 'road-x.md'): void => {
        fs.mkdirSync(path.join(dir, ROADMAP_ROOT), { recursive: true });
        fs.writeFileSync(path.join(dir, ROADMAP_ROOT, name), body);
    };
    const base = ['# Road X', '', '- [x] **0.1 Old step.** Done long ago.', '- [ ] **1.1 New step.**', ''].join('\n');
    const caseOn = (edit: () => void): number => {
        git('checkout', '-q', '-B', 'case', 'main');
        edit();
        git('add', '-A');
        git('commit', '-q', '--allow-empty', '-m', 'case');
        return runGateCli(repoRoot, SCRIPT_REL, ['--base', 'main', '--root', dir, '--enforce'], dir);
    };
    try {
        git('init', '-q', '-b', 'main');
        git('config', 'user.email', 'self-test@local');
        git('config', 'user.name', 'self-test');
        git('config', 'commit.gpgsign', 'false');
        roadmap(base);
        git('add', '-A');
        git('commit', '-q', '-m', 'base');
        const receipt = '<!-- receipt: class=R0 · shadow · would-skip=review · bound=fixture -->';
        const cases: SelfTestCase[] = [
            {
                name: 'a step ticked without a receipt',
                expect: 'reject',
                run: () => caseOn(() => roadmap(base.replace('- [ ] **1.1 New step.**', '- [x] **1.1 New step.** Done.'))),
            },
            {
                name: 'a new roadmap arriving with a ticked step and no receipt',
                expect: 'reject',
                run: () => caseOn(() => roadmap('# Road Y\n\n- [x] **1.1 Born done.**\n', 'road-y.md')),
            },
            {
                name: 'a hand-written receipt claiming a lowered depth the diff does not allow',
                expect: 'reject',
                run: () =>
                    caseOn(() =>
                        roadmap(base.replace('- [ ] **1.1 New step.**', `- [x] **1.1 New step.** Done. ${receipt.replace('· shadow ·', '· active ·')}`)),
                    ),
            },
            {
                name: 'a step ticked with its receipt',
                expect: 'accept',
                run: () => caseOn(() => roadmap(base.replace('- [ ] **1.1 New step.**', `- [x] **1.1 New step.** Done. ${receipt}`))),
            },
            {
                name: 'an older unreceipted tick reworded',
                expect: 'accept',
                run: () => caseOn(() => roadmap(base.replace('Done long ago.', 'Done long ago, reworded.'))),
            },
            {
                name: 'no roadmap in the diff',
                expect: 'accept',
                run: () => caseOn(() => fs.writeFileSync(path.join(dir, 'a.txt'), 'x\n')),
            },
        ];
        return runSelfTest({ gate: 'check_step_receipts', cases, minCases: 6, minRejectCases: 3 });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) {
        return selfTest(REPO_ROOT);
    }
    const value = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const base = value('--base') ?? 'origin/main';
    const root = path.resolve(value('--root') ?? REPO_ROOT);
    const diff = roadmapDiff(root, base);
    if (diff === null) {
        process.stderr.write(`check_step_receipts: cannot diff ${base}...HEAD in ${root}\n`);
        return 2;
    }
    const { files, missing, lowered } = missingReceipts(diff);
    reportScanned({
        gate: 'check_step_receipts',
        scanned: files,
        units: 'roadmap file(s) in the diff',
        roots: [`git diff ${base}...HEAD -- ${ROADMAP_ROOT}/`],
        allowEmpty:
            'EMPTY_VALID: the scan root is a DIFF, and most pull requests tick no roadmap step; git ' +
            'answered for the range, and an unreadable ref already exits 2 above.',
    });
    const table = loadDepthTable(fs.existsSync(path.join(root, DEPTH_TABLE_REL)) ? root : REPO_ROOT);
    const forged = lowered.length > 0 && !loweredClaimAllowed(table, diffPaths(root, base));
    if (missing.length === 0 && !forged) {
        process.stdout.write('✅  check_step_receipts: every step this diff ticks carries a receipt\n');
        return 0;
    }
    const enforce = enforcing(table.mode, argv);
    const mark = enforce ? '❌' : '⚠️ ';
    for (const m of missing) {
        process.stdout.write(`${mark}  ${m.file}: step ${m.step} is ticked without a receipt\n`);
    }
    if (forged) {
        for (const m of lowered) {
            process.stdout.write(
                `${mark}  ${m.file}: step ${m.step} claims a lowered depth (\`active\`) that this diff does not allow — ` +
                    'the table must be active and every changed path structurally safe and of a flip class\n',
            );
        }
    }
    process.stdout.write(
        '   Append the line `./scripts-run src/scripts/step_receipt --range <base>..HEAD` prints to the step\n' +
            '   (roadmap-process-loop § the receipt).\n',
    );
    if (!enforce) {
        process.stdout.write('   Report only: the depth table is in shadow mode, so nothing is lowered yet.\n');
    }
    return enforce ? 1 : 0;
}

/** Blocking once the depth table is active — the point from which a missing receipt hides a skipped ceremony. */
export function enforcing(tableMode: 'shadow' | 'active', argv: readonly string[]): boolean {
    return tableMode === 'active' || argv.includes('--enforce');
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}
