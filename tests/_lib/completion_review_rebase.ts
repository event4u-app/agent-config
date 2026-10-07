/**
 * A branch whose completion review has a `fixed` row, in the §2.5 order —
 * findings committed first, the fix after, the artifact finalised and committed
 * — and a base that moves so the branch can be rebased onto it.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { runInProc } from './run_in_process.js';
import { main, type Violation } from '../../src/scripts/check_completion_review.js';
import { computeReviewScope, deriveManifest } from '../../src/scripts/dispatch_r2_reviewer.js';

export const ART = 'agents/evidence/reviews/feat.findings.md';

function gitRaw(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', ['-c', 'user.email=gate@test.local', '-c', 'user.name=gate', '-c', 'commit.gpgsign=false', ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, GIT_EDITOR: 'true' },
    });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout;
}

export const git = (cwd: string, ...args: string[]): string => gitRaw(cwd, ...args).trim();

function write(dir: string, rel: string, body: string): void {
    const fp = path.join(dir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, body, 'utf-8');
}

function commitAll(dir: string, msg: string): string {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', msg);
    return git(dir, 'rev-parse', 'HEAD');
}

export function artifact(dir: string, rows: readonly string[]): string {
    const scope = computeReviewScope((a) => gitRaw(dir, ...a), 'main').hash;
    const manifest = deriveManifest({
        diffSha: '0'.repeat(40),
        scopeHash: scope,
        roadmap: 'none',
        roadmapHash: 'none',
        acHash: 'none',
        dispatched: '2026-10-07T09:00:00Z',
    });
    return [
        '# Findings: feat',
        `<!-- completion-review: v1 | reviewed: 2026-10-07 | scope: ${scope} | diff: ${'0'.repeat(40)} | reviewer: fresh-subagent-r2 -->`,
        '',
        manifest,
        '',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        ...rows,
        '',
    ].join('\n');
}

export const fixedRow = (sha: string): string => `| 1 | high | src/fix.ts:1 | bug | fixed | ${sha} |`;

export interface Reviewed { dir: string; fixSha: string }

export function reviewedBranch(made: string[]): Reviewed {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-rebase-'));
    made.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    write(dir, 'README.md', '# base\n');
    commitAll(dir, 'base');
    git(dir, 'checkout', '-qb', 'feat');
    write(dir, ART, artifact(dir, ['| 1 | high | src/fix.ts:1 | bug | open | |']));
    commitAll(dir, 'add findings artifact');
    write(dir, 'src/fix.ts', 'export const x = 1;\n');
    const fixSha = commitAll(dir, 'fix the bug');
    write(dir, ART, artifact(dir, [fixedRow(fixSha)]));
    commitAll(dir, 'finalize findings artifact');
    return { dir, fixSha };
}

/** The base moves on a file the branch does not touch, then the branch is rebased onto it. */
export function rebaseOntoMovedBase(dir: string): void {
    git(dir, 'checkout', '-q', 'main');
    write(dir, 'CHANGELOG.md', 'unrelated\n');
    commitAll(dir, 'base moves');
    git(dir, 'checkout', '-q', 'feat');
    git(dir, 'rebase', '-q', 'main');
}

/** A transport clone: only what is reachable from the refs travels. */
export function transportClone(dir: string, made: string[]): string {
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-clone-'));
    made.push(dst);
    fs.rmSync(dst, { recursive: true, force: true });
    git(os.tmpdir(), 'clone', '-q', '--no-local', '-b', 'feat', dir, dst);
    git(dst, 'branch', 'main', 'origin/main');
    return dst;
}

export interface GateResult { status: number; kinds: string[]; violations: Violation[] }

export function runGate(dir: string): GateResult {
    const res = runInProc(main, ['--repo', dir, '--base', 'main', '--format', 'json']);
    const nl = res.stdout.indexOf('\n');
    const rest = nl >= 0 ? res.stdout.slice(nl + 1).trim() : '';
    const violations = rest.startsWith('[') ? (JSON.parse(rest) as Violation[]) : [];
    return { status: res.status, kinds: violations.map((v) => v.kind), violations };
}
