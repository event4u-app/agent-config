#!/usr/bin/env tsx
/**
 * Deterministic core of the /worktree cleanup + verify gates
 * (road-to-fable-feedback-5 Phase 5; extracted from the prose in
 * src/domains/engineering-base/worktree/cleanup/command.md so the refusal
 * semantics are testable — the command doc calls this instead of ad-hoc
 * shell).
 *
 * Modes:
 *   check <worktree-path>   Cleanup gates for ONE worktree, in order:
 *                             1. detached HEAD            → refuse
 *                             2. dirty (incl. untracked)  → refuse
 *                             3. commits unique to branch → refuse
 *                           Refusal is the SUCCESS path of the safety gate;
 *                           this tool never removes anything.
 *   scope-overlap           Scan every worktree's .worktree-scope.md and
 *                           report pairwise `owns:` overlaps (the hazard
 *                           /worktree status + verify must surface).
 *
 * Reachability counts ALL other refs — local branches, remotes, AND tags
 * (a branch whose only other ref is a tag is still reachable elsewhere).
 * Exit codes: 0 = allowed / no overlap, 1 = refused / overlap found,
 * 2 = usage error, 3 = internal error.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface CheckResult {
    allowed: boolean;
    reasons: string[];
}

export interface ScopeOverlap {
    a: { worktree: string; own: string };
    b: { worktree: string; own: string };
}

function git(cwd: string, args: string[]): string {
    return execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

function tryGit(cwd: string, args: string[]): string | null {
    try {
        return git(cwd, args);
    } catch {
        return null;
    }
}

/** Refs (heads + remotes + tags) EXCLUDING the given branch's own head ref. */
function otherRefs(cwd: string, branch: string): string[] {
    const out = git(cwd, ['for-each-ref', '--format=%(refname)']);
    return out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && l !== `refs/heads/${branch}`);
}

export function checkWorktree(worktreePath: string): CheckResult {
    const reasons: string[] = [];
    if (!fs.existsSync(worktreePath)) {
        return { allowed: false, reasons: [`worktree path does not exist: ${worktreePath}`] };
    }

    const headRef = tryGit(worktreePath, ['symbolic-ref', '-q', 'HEAD']);
    if (headRef === null) {
        reasons.push(
            'detached HEAD — no branch to judge reachability for; resolve the state manually before cleanup',
        );
        return { allowed: false, reasons };
    }
    const branch = headRef.trim().replace(/^refs\/heads\//, '');

    const status = git(worktreePath, ['status', '--porcelain']);
    if (status.trim().length > 0) {
        const files = status
            .trimEnd()
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n');
        reasons.push(`unsaved work (dirty or untracked files count as work):\n${files}`);
    }

    const others = otherRefs(worktreePath, branch);
    const revListArgs = ['rev-list', '--oneline', branch, '--not', ...others];
    const unique = git(worktreePath, revListArgs).trimEnd();
    if (unique.length > 0) {
        const commits = unique
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n');
        reasons.push(
            `commits on '${branch}' reachable from NO other ref (branch, remote, or tag):\n${commits}`,
        );
    }

    return { allowed: reasons.length === 0, reasons };
}

interface WorktreeEntry {
    path: string;
    branch: string | null;
}

export function listWorktrees(repoPath: string): WorktreeEntry[] {
    const out = git(repoPath, ['worktree', 'list', '--porcelain']);
    const entries: WorktreeEntry[] = [];
    let current: Partial<WorktreeEntry> = {};
    for (const line of out.split('\n')) {
        if (line.startsWith('worktree ')) {
            if (current.path !== undefined) {
                entries.push({ path: current.path, branch: current.branch ?? null });
            }
            current = { path: line.slice('worktree '.length) };
        } else if (line.startsWith('branch ')) {
            current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
        } else if (line === 'detached') {
            current.branch = null;
        }
    }
    if (current.path !== undefined) {
        entries.push({ path: current.path, branch: current.branch ?? null });
    }
    return entries;
}

/** Non-glob prefix of an `owns:` entry (`src/middleware/**` → `src/middleware/`). */
function globPrefix(own: string): string {
    const starIdx = own.indexOf('*');
    const prefix = starIdx === -1 ? own : own.slice(0, starIdx);
    return prefix.replace(/\/+$/, '') + '/';
}

/** Two owns entries overlap when one's non-glob prefix contains the other's. */
export function ownsOverlap(a: string, b: string): boolean {
    const pa = globPrefix(a);
    const pb = globPrefix(b);
    return pa.startsWith(pb) || pb.startsWith(pa);
}

function readOwns(worktreePath: string): string[] {
    const p = path.join(worktreePath, '.worktree-scope.md');
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf-8');
    // owns: entries are a YAML list under an `owns:` key (see
    // worktree-lifecycle § Scope lock). Tolerant line parser — the scope
    // note is hand-written, often inside a fenced block.
    const owns: string[] = [];
    let inOwns = false;
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (/^-?\s*owns:\s*$/.test(line)) {
            inOwns = true;
            continue;
        }
        if (inOwns) {
            const m = line.match(/^-\s+(.+)$/);
            if (m) {
                owns.push(m[1]!.trim());
            } else if (line.length > 0 && !line.startsWith('#')) {
                inOwns = false;
            }
        }
    }
    return owns;
}

export function findScopeOverlaps(repoPath: string): ScopeOverlap[] {
    const entries = listWorktrees(repoPath).filter((e) => fs.existsSync(e.path));
    const scoped = entries
        .map((e) => ({ worktree: e.path, owns: readOwns(e.path) }))
        .filter((e) => e.owns.length > 0);
    const overlaps: ScopeOverlap[] = [];
    for (let i = 0; i < scoped.length; i++) {
        for (let j = i + 1; j < scoped.length; j++) {
            for (const a of scoped[i]!.owns) {
                for (const b of scoped[j]!.owns) {
                    if (ownsOverlap(a, b)) {
                        overlaps.push({
                            a: { worktree: scoped[i]!.worktree, own: a },
                            b: { worktree: scoped[j]!.worktree, own: b },
                        });
                    }
                }
            }
        }
    }
    return overlaps;
}

function usage(): never {
    process.stderr.write(
        'usage: worktree_cleanup_check check <worktree-path> | scope-overlap [repo-path]\n',
    );
    process.exit(2);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const mode = argv[0];
    if (mode === 'check') {
        const p = argv[1];
        if (p === undefined) usage();
        const r = checkWorktree(path.resolve(p));
        if (r.allowed) {
            process.stdout.write(`✅  cleanup allowed: ${p}\n`);
            return 0;
        }
        process.stdout.write(`⛔  cleanup refused: ${p}\n`);
        for (const reason of r.reasons) {
            process.stdout.write(`  - ${reason}\n`);
        }
        process.stdout.write(
            '\nRefusal is the safety gate working — commit/stash the work or merge/preserve ' +
                'the unique commits, then re-run. Never bypass with --force or branch -D.\n',
        );
        return 1;
    }
    if (mode === 'scope-overlap') {
        const repo = path.resolve(argv[1] ?? '.');
        const overlaps = findScopeOverlaps(repo);
        if (overlaps.length === 0) {
            process.stdout.write('✅  no scope-lock overlaps across live worktrees.\n');
            return 0;
        }
        process.stdout.write(`⚠️  ${overlaps.length} scope-lock overlap(s):\n`);
        for (const o of overlaps) {
            process.stdout.write(
                `  - ${o.a.worktree} owns '${o.a.own}'  ×  ${o.b.worktree} owns '${o.b.own}'\n`,
            );
        }
        return 1;
    }
    usage();
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

if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (e) {
        process.stderr.write(`Internal error: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(3);
    }
}
