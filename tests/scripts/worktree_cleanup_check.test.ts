// Edge-case matrix for the /worktree cleanup safety gates
// (road-to-fable-feedback-5 Phase 5). Every row builds a REAL git repo +
// worktree in a tmp dir and asserts refuse-vs-proceed exactly.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildInventory,
    checkWorktree,
    findScopeOverlaps,
    isStandardLocation,
    ownsOverlap,
    removalPlan,
    resolveTrunk,
} from '../../src/scripts/worktree_cleanup_check.js';

let tmp = '';
let repo = '';

function git(cwd: string, args: string[]): string {
    return execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: 't',
            GIT_AUTHOR_EMAIL: 't@t',
            GIT_COMMITTER_NAME: 't',
            GIT_COMMITTER_EMAIL: 't@t',
        },
    });
}

function commitFile(cwd: string, file: string, content: string, msg: string): void {
    fs.writeFileSync(path.join(cwd, file), content);
    git(cwd, ['add', file]);
    git(cwd, ['commit', '-m', msg]);
}

/** Fresh repo with one commit on main. */
function mkRepo(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, ['init', '-b', 'main']);
    commitFile(dir, 'base.txt', 'base', 'init');
}

function addWorktree(name: string, branch: string): string {
    const wt = path.join(tmp, name);
    git(repo, ['worktree', 'add', wt, '-b', branch]);
    return wt;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wtc-'));
    repo = path.join(tmp, 'repo');
    mkRepo(repo);
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('cleanup gates — edge-case matrix', () => {
    it('row 1: branch with no remote — unique commit found against ALL local refs → refuse', () => {
        const wt = addWorktree('wt1', 'feat/no-remote');
        commitFile(wt, 'a.txt', 'x', 'unique work');
        const r = checkWorktree(wt);
        expect(r.allowed).toBe(false);
        expect(r.reasons.join('\n')).toContain('NO other ref');
    });

    it('row 1b: branch with no remote but fully merged into main → allowed', () => {
        const wt = addWorktree('wt1b', 'feat/merged');
        commitFile(wt, 'a.txt', 'x', 'work');
        git(repo, ['merge', 'feat/merged']);
        expect(checkWorktree(wt).allowed).toBe(true);
    });

    it('row 2: detached HEAD in the worktree → refuse with explanation, nothing judged', () => {
        const wt = addWorktree('wt2', 'feat/detach');
        const sha = git(wt, ['rev-parse', 'HEAD']).trim();
        git(wt, ['checkout', '--detach', sha]);
        const r = checkWorktree(wt);
        expect(r.allowed).toBe(false);
        expect(r.reasons.join('\n')).toContain('detached HEAD');
    });

    it('row 3: branch whose only other ref is a TAG → tag counts as reachability → allowed', () => {
        const wt = addWorktree('wt3', 'feat/tagged');
        commitFile(wt, 'a.txt', 'x', 'tagged work');
        git(repo, ['tag', 'v-experiment', 'feat/tagged']);
        expect(checkWorktree(wt).allowed).toBe(true);
    });

    it('row 4: remote branch deleted after push → local-only commits detected → refuse', () => {
        // Simulate: a remote once held the branch, then the remote-tracking
        // ref is gone (deleted upstream + pruned) — only the local branch
        // holds the commits.
        const remote = path.join(tmp, 'remote.git');
        git(repo, ['init', '--bare', remote]);
        git(repo, ['remote', 'add', 'origin', remote]);
        const wt = addWorktree('wt4', 'feat/pushed-then-deleted');
        commitFile(wt, 'a.txt', 'x', 'pushed work');
        git(wt, ['push', 'origin', 'feat/pushed-then-deleted']);
        expect(checkWorktree(wt).allowed).toBe(true);
        git(wt, ['push', 'origin', '--delete', 'feat/pushed-then-deleted']);
        git(wt, ['fetch', '--prune', 'origin']);
        const r = checkWorktree(wt);
        expect(r.allowed).toBe(false);
        expect(r.reasons.join('\n')).toContain('NO other ref');
    });

    it('row 5: untracked-but-not-modified file → counts as unsaved work → refuse', () => {
        const wt = addWorktree('wt5', 'feat/untracked');
        git(repo, ['merge', 'feat/untracked']);
        fs.writeFileSync(path.join(wt, 'scratch-notes.md'), 'wip');
        const r = checkWorktree(wt);
        expect(r.allowed).toBe(false);
        expect(r.reasons.join('\n')).toContain('unsaved work');
        expect(r.reasons.join('\n')).toContain('scratch-notes.md');
    });

    it('row 6: worktree path with spaces → all git invocations quoted → gates work', () => {
        const wt = path.join(tmp, 'wt with spaces');
        git(repo, ['worktree', 'add', wt, '-b', 'feat/spaces']);
        expect(checkWorktree(wt).allowed).toBe(true);
        commitFile(wt, 'a.txt', 'x', 'unique in spaced path');
        expect(checkWorktree(wt).allowed).toBe(false);
    });

    it('row 7: parent/child branches — reachability judged per-branch, not repo-global', () => {
        const wtParent = addWorktree('wt7p', 'feat/parent');
        commitFile(wtParent, 'p.txt', 'p', 'parent work');
        // child branches FROM parent, adds nothing of its own
        const wtChild = path.join(tmp, 'wt7c');
        git(repo, ['worktree', 'add', wtChild, '-b', 'feat/child', 'feat/parent']);
        // child's commits are all reachable from feat/parent → child allowed
        expect(checkWorktree(wtChild).allowed).toBe(true);
        // parent's tip commit is reachable from feat/child → parent ALSO
        // reachable-elsewhere; add a NEW parent commit → parent unique again
        commitFile(wtParent, 'p2.txt', 'p2', 'more parent work');
        expect(checkWorktree(wtParent).allowed).toBe(false);
    });

    it('row 8: overlapping scope globs across two live worktrees → surfaced', () => {
        const wtA = addWorktree('wt8a', 'feat/rate-limit');
        const wtB = addWorktree('wt8b', 'feat/logging');
        fs.writeFileSync(
            path.join(wtA, '.worktree-scope.md'),
            ['owns:', '  - src/middleware/**', '  - src/config/rate-limit.ts'].join('\n'),
        );
        fs.writeFileSync(
            path.join(wtB, '.worktree-scope.md'),
            ['owns:', '  - src/middleware/stack.ts', '  - src/logging/**'].join('\n'),
        );
        const overlaps = findScopeOverlaps(repo);
        expect(overlaps.length).toBe(1);
        expect(overlaps[0]!.a.own).toBe('src/middleware/**');
        expect(overlaps[0]!.b.own).toBe('src/middleware/stack.ts');
    });

    it('row 8b: disjoint scope globs → no overlap reported', () => {
        const wtA = addWorktree('wt8c', 'feat/x');
        const wtB = addWorktree('wt8d', 'feat/y');
        fs.writeFileSync(path.join(wtA, '.worktree-scope.md'), 'owns:\n  - src/a/**\n');
        fs.writeFileSync(path.join(wtB, '.worktree-scope.md'), 'owns:\n  - src/b/**\n');
        expect(findScopeOverlaps(repo)).toEqual([]);
    });
});

/** A worktree under a conventional root, so it can reach `safe`. */
function addStandardWorktree(name: string, branch: string): string {
    const wt = path.join(repo, '.claude', 'worktrees', name);
    fs.mkdirSync(path.dirname(wt), { recursive: true });
    git(repo, ['worktree', 'add', wt, '-b', branch]);
    return wt;
}

/** Merge `branch` into main so the worktree's commits are trunk-reachable. */
function mergeIntoMain(branch: string): void {
    git(repo, ['merge', '--no-ff', '-m', `merge ${branch}`, branch]);
}

/** Far enough ahead that no real mtime falls inside the live window. */
function afterEverything(): Date {
    return new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
}

function rowFor(inv: ReturnType<typeof buildInventory>, wt: string) {
    const canon = (p: string): string => fs.realpathSync(p);
    const row = inv.rows.find((r) => canon(r.path) === canon(wt));
    if (row === undefined) throw new Error(`no inventory row for ${wt}`);
    return row;
}

/**
 * Backdate a linked worktree's git-dir so it falls outside the live window.
 * Both `index` and `HEAD` count — liveness takes the newest of the two.
 */
function backdateGitDir(name: string, daysAgo: number): void {
    const t = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    for (const f of ['index', 'HEAD']) {
        fs.utimesSync(path.join(repo, '.git', 'worktrees', name, f), t, t);
    }
}

describe('inventory classification', () => {
    it('merged + clean + standard location + quiet → safe, with a branch -d plan entry', () => {
        const wt = addStandardWorktree('wt-safe', 'feat/safe');
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain('feat/safe');

        const inv = buildInventory(repo, afterEverything());
        const row = rowFor(inv, wt);
        expect(row.classification).toBe('safe');
        expect(row.reasons).toEqual([]);
        expect(row.mergedIntoTrunk).toBe(true);

        const plan = removalPlan(inv);
        expect(plan.some((c) => c.includes(wt) && c.includes('git branch -d "feat/safe"'))).toBe(
            true,
        );
    });

    it('merged + clean but OUTSIDE the conventional roots → review on location alone', () => {
        const wt = addWorktree('wt-outside', 'feat/outside');
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain('feat/outside');

        const row = rowFor(buildInventory(repo, afterEverything()), wt);
        expect(row.classification).toBe('review');
        expect(row.standardLocation).toBe(false);
        expect(row.reasons.join('\n')).toContain('non-standard location');
    });

    it('dirty worktree → review naming the unsaved-path count, never safe', () => {
        const wt = addStandardWorktree('wt-dirty', 'feat/dirty');
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain('feat/dirty');
        fs.writeFileSync(path.join(wt, 'scratch.txt'), 'untracked');

        const row = rowFor(buildInventory(repo, afterEverything()), wt);
        expect(row.classification).toBe('review');
        expect(row.reasons.join('\n')).toContain('unsaved work — 1 dirty or untracked path(s)');
    });

    it('unmerged branch → review naming the trunk it is not an ancestor of', () => {
        const wt = addStandardWorktree('wt-unmerged', 'feat/unmerged');
        commitFile(wt, 'a.txt', 'x', 'unique work');

        const inv = buildInventory(repo, afterEverything());
        const row = rowFor(inv, wt);
        expect(row.classification).toBe('review');
        expect(row.mergedIntoTrunk).toBe(false);
        expect(row.reasons.join('\n')).toContain(`not an ancestor of ${inv.trunk}`);
    });

    it('detached HEAD → review, and the main worktree is never safe', () => {
        const wt = addStandardWorktree('wt-detached', 'feat/detached');
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain('feat/detached');
        git(wt, ['checkout', '--detach', 'HEAD']);

        const inv = buildInventory(repo, afterEverything());
        expect(rowFor(inv, wt).classification).toBe('review');

        const main = rowFor(inv, repo);
        expect(main.isMain).toBe(true);
        expect(main.classification).not.toBe('safe');
        expect(main.reasons.join('\n')).toContain('main worktree');
        expect(removalPlan(inv).some((c) => c.includes(`"${repo}"`))).toBe(false);
    });

    it('recent git activity wins over the structural verdict → live, not safe', () => {
        const wt = addStandardWorktree('wt-live', 'feat/live');
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain('feat/live');

        // Real `now`: the worktree was created seconds ago, so its index mtime
        // is inside the window.
        const row = rowFor(buildInventory(repo, new Date()), wt);
        expect(row.classification).toBe('live');
        expect(row.reasons.join('\n')).toContain('another session may hold it');
    });

    it('counts partition the rows exactly, and review reasons are grouped', () => {
        const safe = addStandardWorktree('wt-c1', 'feat/c1');
        commitFile(safe, 'a.txt', 'x', 'w1');
        mergeIntoMain('feat/c1');
        const unmerged = addStandardWorktree('wt-c2', 'feat/c2');
        commitFile(unmerged, 'b.txt', 'y', 'w2');

        const inv = buildInventory(repo, afterEverything());
        const { total, safe: s, review, live } = inv.counts;
        expect(total).toBe(inv.rows.length);
        expect(s + review + live).toBe(total);
        expect(s).toBe(1);
        expect(Object.values(inv.counts.reviewReasons).reduce((a, b) => a + b, 0)).toBe(review);
    });

    it('regression: a second run must not reclassify — the check may not touch the index', () => {
        const wt = addStandardWorktree('wt-stable', 'feat/stable');
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain('feat/stable');
        // Outside the live window, so a status-triggered index rewrite would
        // pull it back in and flip safe → live on the next pass.
        backdateGitDir('wt-stable', 10);

        const first = buildInventory(repo, new Date());
        expect(rowFor(first, wt).classification).toBe('safe');
        const second = buildInventory(repo, new Date());
        expect(rowFor(second, wt).classification).toBe('safe');
        expect(second.counts).toEqual(first.counts);
    });

    it('the removal plan never uses the force flag', () => {
        const wt = addStandardWorktree('wt-force', 'feat/force');
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain('feat/force');
        const plan = removalPlan(buildInventory(repo, afterEverything()));
        expect(plan.length).toBeGreaterThan(0);
        expect(plan.join('\n')).not.toContain('branch -D');
        expect(plan.join('\n')).not.toContain('--force');
    });
});

describe('trunk resolution + location convention', () => {
    it('falls back to a local trunk when no remote exists, and prefers the remote when it does', () => {
        expect(resolveTrunk(repo)).toBe('refs/heads/main');
        const origin = path.join(tmp, 'origin.git');
        git(tmp, ['init', '--bare', '-b', 'main', 'origin.git']);
        git(repo, ['remote', 'add', 'origin', origin]);
        git(repo, ['push', '-q', 'origin', 'main']);
        expect(resolveTrunk(repo)).toBe('refs/remotes/origin/main');
    });

    it('only the two conventional roots are standard locations', () => {
        expect(isStandardLocation(repo, path.join(repo, '.claude', 'worktrees', 'a'))).toBe(true);
        expect(isStandardLocation(repo, path.join(repo, '.worktrees', 'b'))).toBe(true);
        expect(isStandardLocation(repo, path.join(repo, 'other', 'c'))).toBe(false);
        expect(isStandardLocation(repo, path.join(tmp, 'sibling'))).toBe(false);
        // A directory whose name merely starts with a root name is not inside it.
        expect(isStandardLocation(repo, path.join(repo, '.worktrees-old', 'd'))).toBe(false);
    });
});

describe('ownsOverlap glob-prefix semantics', () => {
    it('containment in either direction overlaps', () => {
        expect(ownsOverlap('src/middleware/**', 'src/middleware/stack.ts')).toBe(true);
        expect(ownsOverlap('src/middleware/stack.ts', 'src/middleware/**')).toBe(true);
        expect(ownsOverlap('src/a/**', 'src/b/**')).toBe(false);
    });

    it('sibling prefixes that share a string prefix do NOT overlap', () => {
        expect(ownsOverlap('src/app/**', 'src/apple/**')).toBe(false);
    });
});
