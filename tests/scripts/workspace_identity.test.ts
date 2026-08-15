// `workspaceIdentity()` — the single resolver for the five workspace-identity
// questions (road-to-inbox-harvest-2026-08-c-workspace-identity Phase 2).
//
// Every row builds a REAL git repo plus a REAL linked worktree in a tmp dir.
// Two things are asserted that nothing else in the tree asserts:
//
//  1. TOTALITY — every field is either a value WITH its provenance or an
//     explicit reason. There is no third shape, and in particular no silently
//     plausible default. The census found three of eight repo-root sites
//     returning one.
//  2. THE MAIN-WORKTREE ANSWER FROM INSIDE A WORKTREE — the identity question
//     the 12.0.0 span shipped wrong twice (`52d7fe1b8`, `5cf7450da`).
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    type IdentityField,
    type WorkspaceIdentity,
    workspaceIdentity,
} from '../../src/scripts/_lib/git_common_dir.js';

let tmp = '';
let repo = '';
let worktree = '';

function git(cwd: string, args: string[]): string {
    return execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

const FIELDS = ['repoRoot', 'mainWorktree', 'currentWorktree', 'branch', 'prBase'] as const;

/** The totality assertion, applied to one field. */
function expectTotal(name: string, f: IdentityField): void {
    expect(typeof f.resolved, `${name}.resolved is a boolean`).toBe('boolean');
    if (f.resolved) {
        expect(f.value, `${name} resolved with a non-empty value`).toBeTruthy();
        expect(f.provenance, `${name} resolved with a non-empty provenance`).toBeTruthy();
    } else {
        expect(f.reason, `${name} unresolved with a non-empty reason`).toBeTruthy();
    }
}

function expectAllTotal(where: string, id: WorkspaceIdentity): void {
    for (const name of FIELDS) {
        expectTotal(`${where}.${name}`, id[name]);
    }
}

/** Narrow a field to its resolved value, failing the test when it is not. */
function value(f: IdentityField): string {
    if (!f.resolved) throw new Error(`expected resolved, got unresolved: ${f.reason}`);
    return f.value;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'wsid-'));
    repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    git(repo, ['init', '--initial-branch=main', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'test']);
    fs.writeFileSync(path.join(repo, 'README.md'), 'x\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'init']);
    worktree = path.join(tmp, 'wt');
    git(repo, ['worktree', 'add', '-q', worktree, '-b', 'feat/side']);
});

afterEach(() => {
    delete process.env.GIT_DIR;
    if (tmp !== '' && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = '';
});

describe('workspaceIdentity — totality', () => {
    it('every field is a value-with-provenance or a reason, from the main checkout', () => {
        expectAllTotal('main', workspaceIdentity(repo));
    });

    it('every field is a value-with-provenance or a reason, from inside a worktree', () => {
        expectAllTotal('worktree', workspaceIdentity(worktree));
    });

    it('every field is unresolved with a reason outside any repository', () => {
        const outside = path.join(tmp, 'not-a-repo');
        fs.mkdirSync(outside);
        const id = workspaceIdentity(outside);
        expectAllTotal('outside', id);
        for (const name of FIELDS) {
            expect(id[name].resolved, `${name} must not resolve outside a repo`).toBe(false);
        }
    });
});

describe('workspaceIdentity — the five answers', () => {
    it('repoRoot is the invoking checkout, in both locations', () => {
        expect(value(workspaceIdentity(repo).repoRoot)).toBe(fs.realpathSync(repo));
        expect(value(workspaceIdentity(worktree).repoRoot)).toBe(fs.realpathSync(worktree));
    });

    it('repoRoot is found from a nested subdirectory', () => {
        const nested = path.join(worktree, 'a', 'b');
        fs.mkdirSync(nested, { recursive: true });
        expect(value(workspaceIdentity(nested).repoRoot)).toBe(fs.realpathSync(worktree));
    });

    it('currentWorktree carries the distinguishing provenance', () => {
        const main = workspaceIdentity(repo).currentWorktree;
        expect(main.resolved && main.provenance).toContain('main-checkout');
        const wt = workspaceIdentity(worktree).currentWorktree;
        expect(wt.resolved && wt.provenance).toContain('linked-worktree');
    });

    it('branch is per-checkout', () => {
        expect(value(workspaceIdentity(repo).branch)).toBe('main');
        expect(value(workspaceIdentity(worktree).branch)).toBe('feat/side');
    });

    it('branch is unresolved, not guessed, on a detached HEAD', () => {
        const head = git(worktree, ['rev-parse', 'HEAD']);
        git(worktree, ['checkout', '-q', '--detach', head]);
        const f = workspaceIdentity(worktree).branch;
        expect(f.resolved).toBe(false);
        expect(f.resolved === false && f.reason).toMatch(/detached/i);
    });

    it('prBase is unresolved with an actionable reason when no remote HEAD is recorded', () => {
        const f = workspaceIdentity(repo).prBase;
        expect(f.resolved).toBe(false);
        // Never `main` by assumption — the census names the guessed default as
        // the failure mode this type exists to remove.
        expect(f.resolved === false && f.reason).toMatch(/git remote set-head/);
    });

    it('prBase resolves from a recorded remote HEAD symbolic ref', () => {
        const refs = path.join(repo, '.git', 'refs', 'remotes', 'origin');
        fs.mkdirSync(refs, { recursive: true });
        fs.writeFileSync(path.join(refs, 'HEAD'), 'ref: refs/remotes/origin/main\n');
        expect(value(workspaceIdentity(repo).prBase)).toBe('refs/remotes/origin/main');
        // and the same answer from the worktree, because it reads the COMMON dir
        expect(value(workspaceIdentity(worktree).prBase)).toBe('refs/remotes/origin/main');
    });
});

describe('regression — the two shipped worktree misclassification defects', () => {
    // `52d7fe1b8` (diagnosis) and `5cf7450da` (fix): `isStandardLocation` took
    // the INVOKING checkout as its base, so from inside a linked worktree every
    // conventional sibling resolved to `..` and the safe set collapsed to 0 of
    // 304. Both commits are the same identity question — "which checkout is the
    // main one" — answered against the wrong root.

    it('mainWorktree is the main checkout even when called from inside a worktree', () => {
        expect(value(workspaceIdentity(worktree).mainWorktree)).toBe(fs.realpathSync(repo));
    });

    it('mainWorktree is invariant across checkouts; the pre-migration primitive is not', () => {
        const fromMain = value(workspaceIdentity(repo).mainWorktree);
        const fromWorktree = value(workspaceIdentity(worktree).mainWorktree);
        expect(fromWorktree).toBe(fromMain);

        // The primitive the defective sites used. It is NOT invariant — this is
        // the assertion that fails against the pre-migration answer and passes
        // against the resolver, i.e. what pins the defect.
        const topFromMain = fs.realpathSync(git(repo, ['rev-parse', '--show-toplevel']));
        const topFromWorktree = fs.realpathSync(git(worktree, ['rev-parse', '--show-toplevel']));
        expect(topFromWorktree).not.toBe(topFromMain);
        expect(topFromWorktree).toBe(fs.realpathSync(worktree));

        // Stated as the defect: a location test based on the invoking toplevel
        // judges the worktree against itself; based on mainWorktree it judges
        // against the main checkout, which is the only stable base.
        expect(topFromWorktree).not.toBe(fromWorktree);
    });
});

describe('regression — inherited GIT_DIR does not redirect the answers', () => {
    // Hooks export GIT_DIR and every child inherits it; an inherited GIT_DIR
    // OVERRIDES repository discovery, so a `git`-based resolver silently
    // answers about the hook's repository. This resolver reads files, so there
    // is no process to redirect — asserted rather than assumed.
    //
    it('resolves the worktree correctly with GIT_DIR pointing at the main repo', () => {
        process.env.GIT_DIR = path.join(repo, '.git');
        const id = workspaceIdentity(worktree);
        expectAllTotal('worktree-with-GIT_DIR', id);
        expect(value(id.repoRoot)).toBe(fs.realpathSync(worktree));
        expect(value(id.branch)).toBe('feat/side');
        expect(value(id.mainWorktree)).toBe(fs.realpathSync(repo));
    });

    it('a git-based read of the same question IS redirected, which is the hazard', () => {
        // Control: proves the environment variable really does redirect, so the
        // assertion above is testing something rather than passing vacuously.
        const redirected = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: worktree,
            encoding: 'utf-8',
            env: { ...process.env, GIT_DIR: path.join(repo, '.git') },
        }).trim();
        expect(redirected).toBe('main'); // the MAIN repo's branch, from inside the worktree
        expect(value(workspaceIdentity(worktree).branch)).toBe('feat/side');
    });
});
