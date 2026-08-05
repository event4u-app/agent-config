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
 *   inventory               Classify EVERY worktree safe / review / live and
 *                           report the counts, the review reasons, and a
 *                           prepared removal plan for the safe set. Reporting
 *                           only — it never removes anything, because bulk
 *                           worktree + branch deletion is a Hard-Floor action
 *                           (`non-destructive-by-default`) that needs the
 *                           user's explicit this-turn approval.
 *
 * Reachability counts ALL other refs — local branches, remotes, AND tags
 * (a branch whose only other ref is a tag is still reachable elsewhere).
 * Exit codes: 0 = allowed / no overlap / inventory reported, 1 = refused /
 * overlap found, 2 = usage error, 3 = internal error.
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

/**
 * `git status` with the index left alone. Plain `git status` refreshes the
 * on-disk index, which bumps its mtime — and the inventory mode reads that
 * mtime as the "another session is working here" signal. Without
 * `--no-optional-locks` the check corrupts the very signal it is measured
 * against: two consecutive inventory runs moved 10 worktrees from safe to live.
 */
function statusPorcelain(cwd: string): string {
    return git(cwd, ['--no-optional-locks', 'status', '--porcelain']);
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

    const status = statusPorcelain(worktreePath);
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

/**
 * A worktree is "live" when another session may be working in it. Git touches
 * the per-worktree index on almost every command, so its mtime is the cheapest
 * available activity signal.
 */
export const LIVE_WINDOW_HOURS = 48;

/**
 * The two conventional worktree roots, relative to the repo. Anything else is
 * a non-standard location: it is not wrong, but it is excluded from the safe
 * set on purpose — worktrees that sit beside the repo can be mistaken for
 * sibling packages, so their removal is a judgement the maintainer makes.
 */
export const STANDARD_WORKTREE_DIRS = ['.claude/worktrees', '.worktrees'] as const;

/**
 * Symlink-resolved absolute path, falling back to a plain resolve when the
 * path is gone. Git reports worktree paths as realpaths, so a repo reached
 * through a symlinked parent (`/tmp` → `/private/tmp` on macOS, or any
 * symlinked checkout root) would otherwise fail every path comparison and
 * mis-report conventional worktrees as non-standard.
 */
function canonical(p: string): string {
    const abs = path.resolve(p);
    const tail: string[] = [];
    let head = abs;
    for (;;) {
        try {
            // Resolve the longest existing ancestor, then re-append the rest —
            // a registration pointing at an already-deleted directory still has
            // to classify its location correctly.
            const real = fs.realpathSync(head);
            return tail.length === 0 ? real : path.join(real, ...tail);
        } catch {
            const parent = path.dirname(head);
            if (parent === head) return abs;
            tail.unshift(path.basename(head));
            head = parent;
        }
    }
}

export type Classification = 'safe' | 'review' | 'live';

export interface InventoryRow {
    path: string;
    branch: string | null;
    classification: Classification;
    /** Why it is not safe. Empty exactly when `classification === 'safe'`. */
    reasons: string[];
    /** The branch is an ancestor of the trunk, so `git branch -d` is safe. */
    mergedIntoTrunk: boolean;
    standardLocation: boolean;
    /** Main worktree — never removable, and never counted as residue. */
    isMain: boolean;
}

export interface Inventory {
    trunk: string;
    rows: InventoryRow[];
    counts: {
        total: number;
        safe: number;
        review: number;
        live: number;
        /** Review rows grouped by reason, highest first. */
        reviewReasons: Record<string, number>;
    };
}

/** First existing trunk ref, preferring the remote (the merge authority). */
export function resolveTrunk(repoPath: string): string {
    for (const ref of [
        'refs/remotes/origin/main',
        'refs/remotes/origin/master',
        'refs/heads/main',
        'refs/heads/master',
    ]) {
        if (tryGit(repoPath, ['rev-parse', '--verify', '--quiet', ref]) !== null) return ref;
    }
    return 'HEAD';
}

function isAncestor(repoPath: string, branch: string, trunk: string): boolean {
    try {
        git(repoPath, ['merge-base', '--is-ancestor', branch, trunk]);
        return true;
    } catch {
        return false;
    }
}

export function isStandardLocation(repoPath: string, worktreePath: string): boolean {
    const rel = path.relative(canonical(repoPath), canonical(worktreePath));
    if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
    return STANDARD_WORKTREE_DIRS.some(
        (dir) => rel === dir || rel.startsWith(`${dir}${path.sep}`),
    );
}

/**
 * Per-worktree git-dir mtime, or null when it cannot be read. A linked
 * worktree's `.git` is a file holding `gitdir: <path>`; the main worktree's is
 * a directory.
 */
function lastGitActivity(worktreePath: string): Date | null {
    const dotGit = path.join(worktreePath, '.git');
    let gitDir: string;
    try {
        const st = fs.statSync(dotGit);
        if (st.isDirectory()) {
            gitDir = dotGit;
        } else {
            const m = fs.readFileSync(dotGit, 'utf-8').match(/^gitdir:\s*(.+)$/m);
            if (!m) return null;
            gitDir = path.resolve(worktreePath, m[1]!.trim());
        }
    } catch {
        return null;
    }
    let newest: number | null = null;
    for (const name of ['index', 'HEAD']) {
        try {
            const t = fs.statSync(path.join(gitDir, name)).mtimeMs;
            if (newest === null || t > newest) newest = t;
        } catch {
            /* absent is not an error — the other candidate may still exist */
        }
    }
    return newest === null ? null : new Date(newest);
}

/**
 * Classify every worktree. `now` is injectable so the live-window boundary is
 * testable rather than wall-clock dependent.
 */
export function buildInventory(repoPath: string, now: Date = new Date()): Inventory {
    const trunk = resolveTrunk(repoPath);
    const entries = listWorktrees(repoPath);
    const mainPath = canonical(entries.length > 0 ? entries[0]!.path : repoPath);
    const liveCutoff = now.getTime() - LIVE_WINDOW_HOURS * 3600 * 1000;

    const rows: InventoryRow[] = entries.map((e) => {
        const resolved = canonical(e.path);
        const isMain = resolved === mainPath;
        const standardLocation = isMain ? true : isStandardLocation(repoPath, resolved);
        const reasons: string[] = [];

        if (!fs.existsSync(resolved)) {
            return {
                path: e.path,
                branch: e.branch,
                classification: 'review',
                reasons: ['registration points at a missing directory — `git worktree prune` clears it'],
                mergedIntoTrunk: false,
                standardLocation,
                isMain,
            };
        }

        const activity = lastGitActivity(resolved);
        if (activity !== null && activity.getTime() >= liveCutoff) {
            return {
                path: e.path,
                branch: e.branch,
                classification: 'live',
                reasons: [`git activity within the last ${LIVE_WINDOW_HOURS}h — another session may hold it`],
                mergedIntoTrunk: e.branch !== null && isAncestor(resolved, e.branch, trunk),
                standardLocation,
                isMain,
            };
        }

        if (isMain) reasons.push('main worktree — cannot be removed');
        if (e.branch === null) {
            reasons.push('detached HEAD — no branch to judge reachability for');
        }
        if (!standardLocation) {
            reasons.push('non-standard location — outside the conventional worktree roots');
        }

        const mergedIntoTrunk = e.branch !== null && isAncestor(resolved, e.branch, trunk);

        // A branch that is an ancestor of the trunk has every commit reachable
        // from the trunk ref, so the expensive rev-list gate cannot find a
        // unique commit. Only run it for the branches that are NOT merged —
        // that is where it can actually refuse.
        if (e.branch !== null && !mergedIntoTrunk) {
            reasons.push(`branch is not an ancestor of ${trunk} — unmerged work`);
            const gate = checkWorktree(resolved);
            if (!gate.allowed) reasons.push(...gate.reasons);
        } else if (e.branch !== null) {
            const status = statusPorcelain(resolved);
            if (status.trim().length > 0) {
                const n = status.trimEnd().split('\n').length;
                reasons.push(`unsaved work — ${n} dirty or untracked path(s)`);
            }
        }

        return {
            path: e.path,
            branch: e.branch,
            classification: reasons.length === 0 ? 'safe' : 'review',
            reasons,
            mergedIntoTrunk,
            standardLocation,
            isMain,
        };
    });

    const reviewReasons: Record<string, number> = {};
    for (const r of rows) {
        if (r.classification !== 'review') continue;
        // Group by the first reason: it is the primary disqualifier, and the
        // per-row reasons stay available in --json for the full picture.
        const key = (r.reasons[0] ?? 'unknown').split('\n')[0]!;
        reviewReasons[key] = (reviewReasons[key] ?? 0) + 1;
    }

    return {
        trunk,
        rows,
        counts: {
            total: rows.length,
            safe: rows.filter((r) => r.classification === 'safe').length,
            review: rows.filter((r) => r.classification === 'review').length,
            live: rows.filter((r) => r.classification === 'live').length,
            reviewReasons: Object.fromEntries(
                Object.entries(reviewReasons).sort((a, b) => b[1] - a[1]),
            ),
        },
    };
}

/**
 * The removal commands for the safe set — printed for a human to review and
 * run, never executed here. `git branch -d` (never `-D`) so git itself
 * re-checks the merge before the branch goes.
 */
export function removalPlan(inv: Inventory): string[] {
    return inv.rows
        .filter((r) => r.classification === 'safe')
        .map((r) => {
            const remove = `git worktree remove ${JSON.stringify(r.path)}`;
            return r.branch !== null && r.mergedIntoTrunk
                ? `${remove} && git branch -d ${JSON.stringify(r.branch)}`
                : remove;
        });
}

function usage(): never {
    process.stderr.write(
        'usage: worktree_cleanup_check check <worktree-path> | scope-overlap [repo-path] | ' +
            'inventory [repo-path] [--json|--plan]\n',
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
    if (mode === 'inventory') {
        const rest = argv.slice(1);
        const flags = rest.filter((a) => a.startsWith('--'));
        const positional = rest.filter((a) => !a.startsWith('--'));
        if (positional.length > 1 || flags.some((f) => f !== '--json' && f !== '--plan')) usage();
        const repo = path.resolve(positional[0] ?? '.');
        const inv = buildInventory(repo);

        if (flags.includes('--json')) {
            process.stdout.write(`${JSON.stringify(inv, null, 2)}\n`);
            return 0;
        }
        if (flags.includes('--plan')) {
            const plan = removalPlan(inv);
            if (plan.length === 0) {
                process.stdout.write('# no safe worktrees — nothing to propose.\n');
                return 0;
            }
            process.stdout.write(
                `# Prepared removal plan for ${plan.length} safe worktree(s).\n` +
                    '# NOT executed: bulk worktree + branch deletion is a Hard-Floor action that\n' +
                    '# needs the maintainer\'s explicit approval. Review, then run deliberately.\n',
            );
            process.stdout.write(`${plan.join('\n')}\n`);
            return 0;
        }

        const c = inv.counts;
        process.stdout.write(
            `worktree inventory · ${c.total} registered · trunk ${inv.trunk}\n` +
                `  safe    ${c.safe}\n` +
                `  review  ${c.review}\n` +
                `  live    ${c.live}\n`,
        );
        if (c.review > 0) {
            process.stdout.write('\nreview reasons (primary disqualifier):\n');
            for (const [reason, n] of Object.entries(c.reviewReasons)) {
                process.stdout.write(`  ${String(n).padStart(4)}  ${reason}\n`);
            }
        }
        process.stdout.write(
            '\nThis mode reports only. `--plan` prints the removal commands for the safe set;\n' +
                'running them is a Hard-Floor action needing the maintainer\'s explicit approval.\n',
        );
        return 0;
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
