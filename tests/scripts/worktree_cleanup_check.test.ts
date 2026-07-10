// Edge-case matrix for the /worktree cleanup safety gates
// (road-to-fable-feedback-5 Phase 5). Every row builds a REAL git repo +
// worktree in a tmp dir and asserts refuse-vs-proceed exactly.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkWorktree,
    findScopeOverlaps,
    ownsOverlap,
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
