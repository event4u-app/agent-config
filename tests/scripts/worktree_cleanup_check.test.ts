// Edge-case matrix for the /worktree cleanup safety gates
// (road-to-fable-feedback-5 Phase 5). Every row builds a REAL git repo +
// worktree in a tmp dir and asserts refuse-vs-proceed exactly.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    applyRemovals,
    cleanupMode,
    DAILY_RECORD,
    dailyCleanup,
    buildInventory,
    checkWorktree,
    findScopeOverlaps,
    isStandardLocation,
    localOnlyIgnored,
    mergeEvidence,
    ownsOverlap,
    type PrIndex,
    readPrIndex,
    registerWorktree,
    REMOVAL_JOURNAL,
    REMOVAL_LOCK,
    removalPlan,
    removalSummary,
    resolveTrunk,
    shQuote,
} from '../../src/scripts/worktree_cleanup_check.js';
import { register_dir, write_record } from '../../src/scripts/_lib/session_register.js';

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
        expect(plan.some((c) => c.includes(wt) && c.includes("git branch -d 'feat/safe'"))).toBe(
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
        expect(removalPlan(inv).some((c) => c.includes(`'${repo}'`))).toBe(false);
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

describe('printed commands quote a branch name a PR author chose', () => {
    // git allows `$`, `(`, `)` and backticks in a ref name; a copied line must
    // hand the shell the literal name, never a command substitution.
    const HOSTILE = 'feat/a$(id)`id`';
    const literal = (arg: string): string => execFileSync('sh', ['-c', `printf '%s' ${arg}`], { encoding: 'utf-8' });

    it('the removal plan prints the branch as one literal argv element', () => {
        const wt = addStandardWorktree('wt-hostile', HOSTILE);
        commitFile(wt, 'a.txt', 'x', 'work');
        mergeIntoMain(HOSTILE);
        const line = removalPlan(buildInventory(repo, afterEverything())).find((c) => c.includes('git branch -d '));
        expect(line).toBeDefined();
        expect(literal((line as string).slice((line as string).indexOf('git branch -d ') + 'git branch -d '.length))).toBe(HOSTILE);
    });

    it('the kept-branches hint prints each branch as one literal argv element', () => {
        const inv = { rows: [] } as unknown as Parameters<typeof removalSummary>[0];
        const summary = removalSummary(inv, [
            { path: '/w', branch: HOSTILE, tip: null, evidence: 'merged-equivalent', removed: true, error: null },
        ]);
        expect(literal(summary.slice(summary.indexOf('git branch -D ') + 'git branch -D '.length))).toBe(HOSTILE);
    });

    it('a single quote inside the name survives quoting', () => {
        expect(literal(shQuote("feat/it's"))).toBe("feat/it's");
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

    // Regression, measured 2026-08-13: called with a LINKED worktree as the base
    // instead of the main worktree, every conventional sibling resolves to `..`
    // and the safe set collapses to empty. On the real repo that read as
    // "safe 0 of 304" from inside a worktree versus "safe 181" from the main
    // checkout — a cleanup tool failing silently, toward inaction.
    it('a conventional worktree is standard against the MAIN worktree, not against a sibling', () => {
        const wtA = path.join(repo, '.claude', 'worktrees', 'a');
        const wtB = path.join(repo, '.claude', 'worktrees', 'b');
        expect(isStandardLocation(repo, wtA)).toBe(true);
        // The defect: judging sibling `a` from inside sibling `b`.
        expect(isStandardLocation(wtB, wtA)).toBe(false);
    });

    // The assertion above is a UNIT test of the predicate. The shipped defect
    // (52d7fe1b8 / 5cf7450da) was in the CALLER: `buildInventoryInner` had
    // `mainPath` computed and passed `repoPath` instead, so run from inside a
    // worktree the safe set collapsed from 181 to 0. Re-introducing exactly
    // that one-word substitution leaves the unit test above green, so it needs
    // its own pin at the level the defect actually shipped at.
    it('regression: the INVENTORY classifies identically from a worktree and from the main checkout', () => {
        const wtA = path.join(repo, '.claude', 'worktrees', 'a');
        const wtB = path.join(repo, '.worktrees', 'b');
        git(repo, ['worktree', 'add', '-q', wtA, '-b', 'feat/a']);
        git(repo, ['worktree', 'add', '-q', wtB, '-b', 'feat/b']);

        const fromMain = buildInventory(repo);
        const fromWorktree = buildInventory(wtA);

        const flags = (inv: ReturnType<typeof buildInventory>): Record<string, boolean> =>
            Object.fromEntries(inv.rows.map((r) => [fs.realpathSync(r.path), r.standardLocation]));

        expect(fromWorktree.rows.length).toBe(fromMain.rows.length);
        expect(flags(fromWorktree)).toEqual(flags(fromMain));
        // And not vacuously — both conventional siblings must read as standard.
        expect(flags(fromMain)[fs.realpathSync(wtA)]).toBe(true);
        expect(flags(fromMain)[fs.realpathSync(wtB)]).toBe(true);
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

// road-to-worktrees-that-leave-after-the-merge Phase 1–2: the fixtures F1–F12.
// Each one is a real repository; the PR index is injected, never read from a
// forge, so the matrix runs offline and deterministically.
describe('merge evidence and the removable set — F1–F12', () => {
    function squashMerge(branch: string): void {
        git(repo, ['merge', '--squash', branch]);
        git(repo, ['commit', '-m', `squash ${branch} (#1)`]);
    }
    function tipOf(branch: string): string {
        return git(repo, ['rev-parse', `refs/heads/${branch}`]).trim();
    }
    function prIndex(rows: Array<[string, 'MERGED' | 'CLOSED' | 'OPEN', string, string | null]>): PrIndex {
        const m: PrIndex = new Map();
        for (const [branch, state, headOid, mergedAt] of rows) {
            m.set(branch, [...(m.get(branch) ?? []), { state, headOid, mergedAt, base: 'main' }]);
        }
        return m;
    }
    const longAgo = '2020-01-01T00:00:00Z';

    it('F1: squash-merged + clean → review under the graph proof alone, safe under the PR proof', () => {
        const wt = addStandardWorktree('f1', 'feat/f1');
        commitFile(wt, 'a.txt', 'x', 'w1');
        commitFile(wt, 'b.txt', 'y', 'w2');
        squashMerge('feat/f1');

        // The defect this fixture pins: the graph proof alone never holds for a
        // squash merge. `merged-ancestor` is absent here by construction.
        expect(() => git(repo, ['merge-base', '--is-ancestor', 'feat/f1', 'main'])).toThrow();
        expect(mergeEvidence(repo, 'feat/f1', 'refs/heads/main', prIndex([])).evidence).toBe('merged-equivalent');

        const index = prIndex([['feat/f1', 'MERGED', tipOf('feat/f1'), longAgo]]);
        const row = rowFor(buildInventory(repo, { now: afterEverything(), prIndex: index }), wt);
        expect(row.mergeEvidence).toBe('merged-pr');
        expect(row.classification).toBe('safe');
    });

    it('F2: merge-commit → merged-ancestor, safe', () => {
        const wt = addStandardWorktree('f2', 'feat/f2');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/f2');
        const row = rowFor(buildInventory(repo, { now: afterEverything() }), wt);
        expect(row.mergeEvidence).toBe('merged-ancestor');
        expect(row.classification).toBe('safe');
    });

    it('F3: rebase-merged (fast-forward onto main) → merged-ancestor, safe', () => {
        const wt = addStandardWorktree('f3', 'feat/f3');
        commitFile(wt, 'a.txt', 'x', 'w');
        git(repo, ['merge', '--ff-only', 'feat/f3']);
        expect(rowFor(buildInventory(repo, { now: afterEverything() }), wt).classification).toBe('safe');
    });

    it('F4: squash-merged, then one more local commit → the PR head no longer matches → review', () => {
        const wt = addStandardWorktree('f4', 'feat/f4');
        commitFile(wt, 'a.txt', 'x', 'w');
        const headAtMerge = tipOf('feat/f4');
        squashMerge('feat/f4');
        commitFile(wt, 'later.txt', 'z', 'after the merge');
        const index = prIndex([['feat/f4', 'MERGED', headAtMerge, longAgo]]);
        const row = rowFor(buildInventory(repo, { now: afterEverything(), prIndex: index }), wt);
        expect(row.mergeEvidence).toBeNull();
        expect(row.classification).toBe('review');
    });

    it('F5: proven merged but dirty → review', () => {
        const wt = addStandardWorktree('f5', 'feat/f5');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/f5');
        fs.writeFileSync(path.join(wt, 'a.txt'), 'edited');
        expect(rowFor(buildInventory(repo, { now: afterEverything() }), wt).classification).toBe('review');
    });

    it('F6: a live session registered in the tree → live, whatever the mtimes say', () => {
        const wt = addStandardWorktree('f6', 'feat/f6');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/f6');
        const now = afterEverything();
        expect(rowFor(buildInventory(repo, { now, excludeLiveSessions: true }), wt).classification).toBe('safe');

        const dir = register_dir(repo)!;
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, {
            session_id: 'f6-session',
            platform: 'claude',
            worktree: wt,
            branch: 'feat/f6',
            roadmap_slug: null,
            started_at: now.toISOString(),
            last_seen: now.toISOString(),
        });
        const row = rowFor(buildInventory(repo, { now, excludeLiveSessions: true }), wt);
        expect(row.classification).toBe('live');
        expect(applyRemovals(repo, buildInventory(repo, { now, excludeLiveSessions: true }))).toEqual([]);
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('F7: a host-locked worktree → review naming the lock, never removed (R2 #18)', () => {
        const wt = addStandardWorktree('f7', 'feat/f7');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/f7');
        git(repo, ['worktree', 'lock', wt]);
        const inv = buildInventory(repo, { now: afterEverything() });
        const row = rowFor(inv, wt);
        expect(row.classification).toBe('review');
        expect(row.reasons.join('\n')).toContain('locked');
        expect(applyRemovals(repo, inv)).toEqual([]);
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('F8: a directory deleted by hand → review with the prune hint, never applied', () => {
        const wt = addStandardWorktree('f8', 'feat/f8');
        fs.rmSync(wt, { recursive: true, force: true });
        const row = rowFor2(buildInventory(repo, { now: afterEverything() }), wt);
        expect(row.classification).toBe('review');
        expect(row.reasons.join('\n')).toContain('git worktree prune');
    });

    it('F9: PR closed unmerged → closed-unmerged, kept', () => {
        const wt = addStandardWorktree('f9', 'feat/f9');
        commitFile(wt, 'a.txt', 'x', 'w');
        const index = prIndex([['feat/f9', 'CLOSED', tipOf('feat/f9'), null]]);
        const row = rowFor(buildInventory(repo, { now: afterEverything(), prIndex: index }), wt);
        expect(row.mergeEvidence).toBe('closed-unmerged');
        expect(row.classification).toBe('review');
    });

    it('F10: forge unreadable → the offline tree proof carries a squash merge, and stops a later commit', () => {
        const wt = addStandardWorktree('f10', 'feat/f10');
        commitFile(wt, 'a.txt', 'x', 'w');
        squashMerge('feat/f10');
        const unreadable = readPrIndex(repo, {
            run: () => {
                throw new Error('gh: not logged in');
            },
        });
        expect(unreadable).toBeNull();
        const row = rowFor(buildInventory(repo, { now: afterEverything(), prIndex: unreadable }), wt);
        expect(row.mergeEvidence).toBe('merged-equivalent');
        expect(row.classification).toBe('safe');

        commitFile(wt, 'later.txt', 'z', 'after');
        const again = rowFor(buildInventory(repo, { now: afterEverything(), prIndex: null }), wt);
        expect(again.mergeEvidence).toBeNull();
    });

    it('F11: an ignored file outside the regenerable set → review naming it; node_modules alone stays safe', () => {
        fs.writeFileSync(path.join(repo, '.gitignore'), 'local.cfg\nnode_modules/\n');
        git(repo, ['add', '.gitignore']);
        git(repo, ['commit', '-m', 'ignore']);
        const wt = addStandardWorktree('f11', 'feat/f11');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/f11');
        fs.mkdirSync(path.join(wt, 'node_modules', 'pkg'), { recursive: true });
        fs.writeFileSync(path.join(wt, 'node_modules', 'pkg', 'index.js'), '');
        expect(rowFor(buildInventory(repo, { now: afterEverything() }), wt).classification).toBe('safe');

        fs.writeFileSync(path.join(wt, 'local.cfg'), 'secret-ish');
        const row = rowFor(buildInventory(repo, { now: afterEverything() }), wt);
        expect(row.classification).toBe('review');
        expect(row.reasons.join('\n')).toContain('local.cfg');
    });

    it('F11b: a pattern whose .gitignore comment says "generated" counts as regenerable', () => {
        fs.writeFileSync(path.join(repo, '.gitignore'), '# Generated projection, rebuilt by sync\n/.projection/\n');
        git(repo, ['add', '.gitignore']);
        git(repo, ['commit', '-m', 'ignore']);
        const wt = addStandardWorktree('f11b', 'feat/f11b');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/f11b');
        fs.mkdirSync(path.join(wt, '.projection'), { recursive: true });
        fs.writeFileSync(path.join(wt, '.projection', 'x.md'), '');
        expect(localOnlyIgnored(wt)).toEqual([]);
    });

    it('F12: a sibling worktree is eligible by registration or by `<repo>-*` plus proof, never by location', () => {
        const sib = path.join(tmp, 'repo-lane-a');
        git(repo, ['worktree', 'add', sib, '-b', 'feat/f12']);
        commitFile(sib, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/f12');
        expect(rowFor(buildInventory(repo, { now: afterEverything() }), sib).classification).toBe('safe');

        const other = path.join(tmp, 'unrelated-dir');
        git(repo, ['worktree', 'add', other, '-b', 'feat/f12b']);
        commitFile(other, 'b.txt', 'x', 'w');
        mergeIntoMain('feat/f12b');
        const before = rowFor(buildInventory(repo, { now: afterEverything() }), other);
        expect(before.classification).toBe('review');
        expect(before.reasons.join('\n')).toContain('non-standard location');

        registerWorktree(repo, other, 'test lane');
        const after = rowFor(buildInventory(repo, { now: afterEverything() }), other);
        expect(after.registered).toBe(true);
        expect(after.classification).toBe('safe');
    });

    it('apply removes exactly the safe set, never the main tree, and journals the tip', () => {
        const done = addStandardWorktree('ap1', 'feat/ap1');
        commitFile(done, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/ap1');
        const open = addStandardWorktree('ap2', 'feat/ap2');
        commitFile(open, 'b.txt', 'y', 'unique');
        const tip = tipOf('feat/ap1');

        const inv = buildInventory(repo, { now: afterEverything() });
        const outcomes = applyRemovals(repo, inv);
        expect(outcomes.filter((o) => o.removed).length).toBe(1);
        expect(fs.existsSync(done)).toBe(false);
        expect(fs.existsSync(open)).toBe(true);
        expect(fs.existsSync(repo)).toBe(true);
        const journal = fs.readFileSync(path.join(repo, '.git', REMOVAL_JOURNAL), 'utf-8');
        expect(journal).toContain(tip);
        // The branch survives: D3, branches are never deleted by this tool.
        expect(git(repo, ['branch', '--list', 'feat/ap1']).trim()).not.toBe('');
    });

    it('apply --branch removes only that PR’s tree, and the merge delay keeps a fresh merge', () => {
        const a = addStandardWorktree('br1', 'feat/br1');
        commitFile(a, 'a.txt', 'x', 'w');
        squashMerge('feat/br1');
        const b = addStandardWorktree('br2', 'feat/br2');
        commitFile(b, 'b.txt', 'y', 'w');
        mergeIntoMain('feat/br2');

        const justNow = afterEverything().toISOString();
        const index = prIndex([['feat/br1', 'MERGED', tipOf('feat/br1'), justNow]]);
        const delayed = rowFor(buildInventory(repo, { now: afterEverything(), prIndex: index }), a);
        expect(delayed.classification).toBe('review');
        expect(delayed.reasons.join('\n')).toContain('merged less than 24h ago');

        const inv = buildInventory(repo, { now: afterEverything(), prIndex: index, mergeDelayHours: 0 });
        applyRemovals(repo, inv, { onlyBranch: 'feat/br1' });
        expect(fs.existsSync(a)).toBe(false);
        expect(fs.existsSync(b)).toBe(true);
    });

    it('two consecutive inventories leave every per-worktree index mtime unchanged', () => {
        const wt = addStandardWorktree('mt', 'feat/mt');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/mt');
        backdateGitDir('mt', 10);
        const idx = path.join(repo, '.git', 'worktrees', 'mt', 'index');
        const before = fs.statSync(idx).mtimeMs;
        buildInventory(repo, new Date());
        buildInventory(repo, new Date());
        expect(fs.statSync(idx).mtimeMs).toBe(before);
    });
});

function rowFor2(inv: ReturnType<typeof buildInventory>, wt: string) {
    const row = inv.rows.find((r) => path.basename(r.path) === path.basename(wt));
    if (row === undefined) throw new Error(`no inventory row for ${wt}`);
    return row;
}

describe('check-to-remove and the daily pass (council 2026-10-21)', () => {
    it('a tree that turns dirty between inventory and removal is kept by the re-check', () => {
        const wt = addStandardWorktree('toctou', 'feat/toctou');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/toctou');
        const inv = buildInventory(repo, { now: afterEverything() });
        expect(rowFor(inv, wt).classification).toBe('safe');
        fs.writeFileSync(path.join(wt, 'late.txt'), 'arrived after the inventory');
        const [o] = applyRemovals(repo, inv);
        expect(o!.removed).toBe(false);
        expect(o!.error).toContain('changed since the inventory');
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('a held removal lock makes a second pass do nothing', () => {
        const wt = addStandardWorktree('lock', 'feat/lock');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/lock');
        fs.writeFileSync(path.join(repo, '.git', REMOVAL_LOCK), 'other-pass');
        expect(applyRemovals(repo, buildInventory(repo, { now: afterEverything() }))).toEqual([]);
        expect(fs.existsSync(wt)).toBe(true);
    });

    function backdateAll(): void {
        for (const name of fs.readdirSync(path.join(repo, '.git', 'worktrees'))) backdateGitDir(name, 10);
    }

    it('notify mode removes nothing and says how many it could', () => {
        const wt = addStandardWorktree('dn', 'feat/dn');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/dn');
        backdateAll();
        const r = dailyCleanup(repo, { mode: 'notify', run: () => '[]' })!;
        expect(r.removable).toBe(1);
        expect(r.removed).toBe(0);
        expect(r.line).toContain('worktrees.cleanup: auto');
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('auto mode removes the proven set, records every candidate, and is stamped once', () => {
        const done = addStandardWorktree('da', 'feat/da');
        commitFile(done, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/da');
        const open = addStandardWorktree('db', 'feat/db');
        commitFile(open, 'b.txt', 'y', 'unique');
        backdateAll();
        let stamped = 0;
        const r = dailyCleanup(repo, { mode: 'auto', run: () => '[]', stamp: () => void stamped++ })!;
        expect(r.removed).toBe(1);
        expect(r.line).toContain('1 removed');
        expect(fs.existsSync(done)).toBe(false);
        expect(fs.existsSync(open)).toBe(true);
        expect(stamped).toBe(1);
        const record = JSON.parse(fs.readFileSync(path.join(repo, '.git', DAILY_RECORD), 'utf-8'));
        expect(record.rows.length).toBe(2);
    });

    it('off and an already-run day do nothing; a spent budget fails closed', () => {
        const wt = addStandardWorktree('dx', 'feat/dx');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/dx');
        backdateAll();
        expect(dailyCleanup(repo, { mode: 'off' })).toBeNull();
        expect(dailyCleanup(repo, { mode: 'auto', ranToday: () => true })).toBeNull();
        expect(dailyCleanup(repo, { mode: 'auto', budgetMs: 0, run: () => '[]' })).toBeNull();
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('one forge read per pass, however many worktrees (1.3)', () => {
        for (let i = 0; i < 6; i++) {
            const wt = addStandardWorktree(`gh${i}`, `feat/gh${i}`);
            commitFile(wt, `f${i}.txt`, 'x', `w${i}`);
        }
        backdateAll();
        let calls = 0;
        dailyCleanup(repo, {
            mode: 'notify',
            run: (args) => {
                calls++;
                expect(args.slice(0, 2)).toEqual(['pr', 'list']);
                return '[]';
            },
        });
        expect(calls).toBe(1);
    });

    it('a PR merged outside the session is removed by the next daily pass (3.2)', () => {
        const wt = addStandardWorktree('elsewhere', 'feat/elsewhere');
        commitFile(wt, 'a.txt', 'x', 'w');
        const head = git(repo, ['rev-parse', 'refs/heads/feat/elsewhere']).trim();
        git(repo, ['merge', '--squash', 'feat/elsewhere']);
        git(repo, ['commit', '-m', 'squash (#9)']);
        commitFile(repo, 'unrelated.txt', 'z', 'trunk moved on');
        backdateAll();
        const forge = JSON.stringify([
            { headRefName: 'feat/elsewhere', headRefOid: head, state: 'MERGED', mergedAt: '2020-01-01T00:00:00Z', baseRefName: 'main' },
        ]);
        const r = dailyCleanup(repo, { mode: 'auto', run: () => forge })!;
        expect(r.removed).toBe(1);
        expect(fs.existsSync(wt)).toBe(false);
    });
});


describe('regenerable declaration on the trunk', () => {
    it('an old branch without the comment is covered by the trunk .gitignore', () => {
        fs.writeFileSync(path.join(repo, '.gitignore'), '/out/\n');
        git(repo, ['add', '.gitignore']);
        git(repo, ['commit', '-m', 'ignore out']);
        const wt = path.join(repo, '.claude', 'worktrees', 'old');
        fs.mkdirSync(path.dirname(wt), { recursive: true });
        git(repo, ['worktree', 'add', wt, '-b', 'feat/old']);
        fs.mkdirSync(path.join(wt, 'out'), { recursive: true });
        fs.writeFileSync(path.join(wt, 'out', 'x.js'), '');
        expect(localOnlyIgnored(wt, 'refs/heads/main')).toEqual(['out/']);
        fs.writeFileSync(path.join(repo, '.gitignore'), '# Generated build output\n/out/\n');
        git(repo, ['add', '.gitignore']);
        git(repo, ['commit', '-m', 'declare out generated']);
        expect(localOnlyIgnored(wt, 'refs/heads/main')).toEqual([]);
    });
});

describe('R2 review fixes (2026-10-21)', () => {
    it('#1 — the merge path removes the tree it just merged on a REAL clock, its own session aside', () => {
        const wt = addStandardWorktree('own', 'feat/own');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/own');
        const now = new Date();
        const dir = register_dir(repo)!;
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, { session_id: 'me', platform: 'claude', worktree: wt, branch: 'feat/own', roadmap_slug: null, started_at: now.toISOString(), last_seen: now.toISOString() });
        // Without the merge-path options: live (fresh mtimes, its own session in the register).
        expect(rowFor(buildInventory(repo, { now, excludeLiveSessions: true }), wt).classification).toBe('live');
        const inv = buildInventory(repo, { now, excludeLiveSessions: true, mergedBranch: 'feat/own', selfSessionId: 'me', mergeDelayHours: 0 });
        expect(rowFor(inv, wt).classification).toBe('safe');
        applyRemovals(repo, inv, { onlyBranch: 'feat/own' });
        expect(fs.existsSync(wt)).toBe(false);
    });

    it('#1 — another session in the merged tree still keeps it', () => {
        const wt = addStandardWorktree('other', 'feat/other');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/other');
        const now = new Date();
        const dir = register_dir(repo)!;
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, { session_id: 'someone-else', platform: 'claude', worktree: wt, branch: 'feat/other', roadmap_slug: null, started_at: now.toISOString(), last_seen: now.toISOString() });
        const inv = buildInventory(repo, { now, excludeLiveSessions: true, mergedBranch: 'feat/other', selfSessionId: 'me', mergeDelayHours: 0 });
        expect(rowFor(inv, wt).classification).toBe('live');
    });

    it('#16 — a session that registers between inventory and removal keeps the tree', () => {
        const wt = addStandardWorktree('late', 'feat/late');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/late');
        backdateGitDir('late', 10);
        const inv = buildInventory(repo, { excludeLiveSessions: true });
        expect(rowFor(inv, wt).classification).toBe('safe');
        const dir = register_dir(repo)!;
        fs.mkdirSync(dir, { recursive: true });
        const now = new Date();
        write_record(dir, { session_id: 'late', platform: 'claude', worktree: wt, branch: 'feat/late', roadmap_slug: null, started_at: now.toISOString(), last_seen: now.toISOString() });
        const [o] = applyRemovals(repo, inv);
        expect(o!.removed).toBe(false);
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('#15 — one matching comment does not vouch for a secret, nor for another block', () => {
        fs.writeFileSync(path.join(repo, '.gitignore'), '# Generated build output\n/out/\n\n# local secrets and generated files\n.env.local\nnotes.txt\n');
        git(repo, ['add', '.gitignore']);
        git(repo, ['commit', '-m', 'ignore']);
        const wt = addStandardWorktree('cmt', 'feat/cmt');
        fs.mkdirSync(path.join(wt, 'out'), { recursive: true });
        fs.writeFileSync(path.join(wt, 'out', 'x.js'), '');
        fs.writeFileSync(path.join(wt, '.env.local'), 'SECRET=1');
        const local = localOnlyIgnored(wt);
        expect(local).toContain('.env.local');
        expect(local).not.toContain('out/');
    });
});


describe('council code review fixes (2026-10-21)', () => {
    it('a tree switched to a clean detached commit after the inventory is kept', () => {
        const wt = addStandardWorktree('det', 'feat/det');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/det');
        backdateGitDir('det', 10);
        const inv = buildInventory(repo, { excludeLiveSessions: true });
        expect(rowFor(inv, wt).classification).toBe('safe');
        commitFile(wt, 'unique.txt', 'only here', 'unique work');
        git(wt, ['checkout', '--detach', 'HEAD']);
        git(repo, ['branch', '-f', 'feat/det', 'main']);
        const [o] = applyRemovals(repo, inv);
        expect(o!.removed).toBe(false);
        expect(o!.error).toMatch(/HEAD or branch changed/);
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('a generated comment does not vouch for a rule appended under another pattern', () => {
        fs.writeFileSync(path.join(repo, '.gitignore'), '# generated build output\n/out/\n.secrets-here\n');
        git(repo, ['add', '.gitignore']);
        git(repo, ['commit', '-m', 'ignore']);
        const wt = addStandardWorktree('bleed', 'feat/bleed');
        fs.writeFileSync(path.join(wt, '.secrets-here'), 'x');
        expect(localOnlyIgnored(wt)).toContain('.secrets-here');
    });

    it('a PR merged into another base is no proof for the trunk', () => {
        const wt = addStandardWorktree('rel', 'feat/rel');
        commitFile(wt, 'a.txt', 'x', 'w');
        const head = git(repo, ['rev-parse', 'refs/heads/feat/rel']).trim();
        const idx: PrIndex = new Map([['feat/rel', [{ state: 'MERGED', headOid: head, mergedAt: '2020-01-01T00:00:00Z', base: 'release/next' }]]]);
        expect(mergeEvidence(wt, 'feat/rel', 'refs/heads/main', idx).evidence).toBeNull();
        const onTrunk: PrIndex = new Map([['feat/rel', [{ state: 'MERGED', headOid: head, mergedAt: '2020-01-01T00:00:00Z', base: 'main' }]]]);
        expect(mergeEvidence(wt, 'feat/rel', 'refs/heads/main', onTrunk).evidence).toBe('merged-pr');
    });

    it('a forge merge with no readable merge time keeps the tree under the delay', () => {
        const wt = addStandardWorktree('nots', 'feat/nots');
        commitFile(wt, 'a.txt', 'x', 'w');
        const head = git(repo, ['rev-parse', 'refs/heads/feat/nots']).trim();
        git(repo, ['merge', '--squash', 'feat/nots']);
        git(repo, ['commit', '-m', 'squash (#3)']);
        commitFile(repo, 'later.txt', 'z', 'trunk moved on');
        backdateGitDir('nots', 10);
        const forge = JSON.stringify([{ headRefName: 'feat/nots', headRefOid: head, state: 'MERGED', mergedAt: null, baseRefName: 'main' }]);
        const r = dailyCleanup(repo, { mode: 'auto', run: () => forge, budgetMs: 60000 })!;
        expect(r.removed).toBe(0);
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('a throwing ranToday never escapes the daily pass', () => {
        expect(
            dailyCleanup(repo, {
                mode: 'auto',
                ranToday: () => {
                    throw new Error('unreadable stamp');
                },
            }),
        ).toBeNull();
    });

    it('the daily line names no branch; the journal writes intent before outcome', () => {
        const wt = addStandardWorktree('quiet', 'feat/quiet-private-name');
        commitFile(wt, 'a.txt', 'x', 'w');
        const head = git(repo, ['rev-parse', 'refs/heads/feat/quiet-private-name']).trim();
        git(repo, ['merge', '--squash', 'feat/quiet-private-name']);
        git(repo, ['commit', '-m', 'squash (#4)']);
        backdateGitDir('quiet', 10);
        const forge = JSON.stringify([{ headRefName: 'feat/quiet-private-name', headRefOid: head, state: 'MERGED', mergedAt: '2020-01-01T00:00:00Z', baseRefName: 'main' }]);
        const r = dailyCleanup(repo, { mode: 'auto', run: () => forge, budgetMs: 60000 })!;
        expect(r.removed).toBe(1);
        expect(r.line).not.toContain('quiet-private-name');
        const common = git(repo, ['rev-parse', '--git-common-dir']).trim();
        const lines = fs
            .readFileSync(path.resolve(repo, common, REMOVAL_JOURNAL), 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as { phase: string; tip: string });
        expect(lines.map((l) => l.phase)).toEqual(['intent', 'outcome']);
        expect(lines[0]!.tip).toBe(head);
    });
});

describe('R2 round 2 fixes (2026-10-21)', () => {
    it('#1 — never the tree the caller stands in', () => {
        const wt = addStandardWorktree('mine', 'feat/mine');
        commitFile(wt, 'a.txt', 'x', 'w');
        mergeIntoMain('feat/mine');
        backdateGitDir('mine', 10);
        const inv = buildInventory(repo, { excludeLiveSessions: true });
        expect(rowFor(inv, wt).classification).toBe('safe');
        expect(applyRemovals(repo, inv, { here: path.join(wt, 'sub') })).toEqual([]);
        expect(fs.existsSync(wt)).toBe(true);
        const r = dailyCleanup(wt, { mode: 'auto', run: () => '[]', budgetMs: 60000 })!;
        expect(r.removed).toBe(0);
        expect(fs.existsSync(wt)).toBe(true);
    });

    it('#10 — each generated rule carries its own comment in this repository', () => {
        const lines = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.gitignore'), 'utf-8').split('\n');
        const at = lines.indexOf('/.eslintcache');
        expect(at).toBeGreaterThan(0);
        expect(lines[at - 1]!.startsWith('#')).toBe(true);
    });
});

describe('R2 round 3 fixes (2026-10-21)', () => {
    it('#13 — a short `origin/main` trunk still matches the PR base `main`', () => {
        const wt = addStandardWorktree('short', 'feat/short');
        commitFile(wt, 'a.txt', 'x', 'w');
        const head = git(repo, ['rev-parse', 'refs/heads/feat/short']).trim();
        const idx: PrIndex = new Map([['feat/short', [{ state: 'MERGED', headOid: head, mergedAt: '2020-01-01T00:00:00Z', base: 'main' }]]]);
        expect(mergeEvidence(wt, 'feat/short', 'origin/main', idx).evidence).toBe('merged-pr');
    });
});

describe('R2 round 5 — YAML off', () => {
    it('an unquoted `off` (YAML false) switches the cleanup off', () => {
        fs.writeFileSync(path.join(repo, '.agent-settings.yml'), 'worktrees:\n  cleanup: off\n');
        expect(cleanupMode(repo, { userGlobalPath: path.join(repo, 'no-global.yml') })).toBe('off');
    });
});

describe('only the user grants auto-removal', () => {
    it('a project layer cannot raise the mode to auto; the user-global layer can, and the project may still lower it', () => {
        const global = path.join(repo, 'global.yml');
        fs.writeFileSync(path.join(repo, '.agent-settings.yml'), 'worktrees:\n  cleanup: auto\n');
        expect(cleanupMode(repo, { userGlobalPath: path.join(repo, 'no-global.yml') })).toBe('notify');
        fs.writeFileSync(global, 'worktrees:\n  cleanup: auto\n');
        expect(cleanupMode(repo, { userGlobalPath: global })).toBe('auto');
        fs.writeFileSync(path.join(repo, '.agent-settings.yml'), 'worktrees:\n  cleanup: notify\n');
        expect(cleanupMode(repo, { userGlobalPath: global })).toBe('notify');
    });
});
