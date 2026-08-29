// Repository and worktree identity across two checkouts and a branch switch
// (road-to-runtime-event-journal 2.3).
//
// WHY THIS FILE WAS REWRITTEN. Step 2.3's original verify line asked for "a
// test [that] writes from two worktrees of one repository and asserts distinct
// namespaces". That is not achievable and not desirable, and an AI council
// (2026-08-28, anthropic + openai, 2/2) amended the roadmap rather than let the
// test quietly assert something else:
//
//   * The single `namespace` was a digest of the COMMON git directory — the one
//     directory every worktree of a repo shares by definition. Two worktrees
//     could never resolve distinct values from it.
//   * Worse, describing that one field as keeping records "attributable when
//     read together" was FALSE in one direction: it cannot attribute a record
//     to a particular worktree at all.
//
// So the concept is split, and the three properties below are what the contract
// actually has. `repository_id` is the JOIN key; `worktree_id` is the
// ATTRIBUTION key; the DATABASE PATH is a third thing again and decides only
// whether two checkouts share one store.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    isJournalAvailable,
    openJournal,
    projectionKey,
    readAllEvents,
    reconstructEpisode,
    recordEvent,
    resolveJournal,
} from '../../src/scripts/_lib/runtime_journal.js';

const sqliteOk = isJournalAvailable();

let tmp: string;
let repoA: string;
let repoAWorktree: string;
let repoB: string;

function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, stdio: 'pipe' }).toString();
}

function makeRepo(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '--initial-branch=main');
    git(dir, 'config', 'user.email', 'test@example.com');
    git(dir, 'config', 'user.name', 'Journal Test');
    fs.writeFileSync(path.join(dir, 'README.md'), 'fixture\n', 'utf8');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-m', 'fixture');
}

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-journal-id-'));
    repoA = path.join(tmp, 'repo-a');
    repoAWorktree = path.join(tmp, 'repo-a-wt');
    repoB = path.join(tmp, 'repo-b');
    makeRepo(repoA);
    makeRepo(repoB);
    git(repoA, 'worktree', 'add', '-b', 'side', repoAWorktree);
});

afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Property 1 — two worktrees of one repository SHARE repository_id and the store
// ---------------------------------------------------------------------------

describe('2.3 property 1 — one repository, one store, one repository_id', () => {
    it('two worktrees of one repository resolve the SAME database file', () => {
        expect(resolveJournal(repoAWorktree).path).toBe(resolveJournal(repoA).path);
        expect(resolveJournal(repoA).scope).toBe('repo-shared');
        expect(resolveJournal(repoAWorktree).scope).toBe('repo-shared');
    });

    it('two worktrees of one repository resolve the SAME repository_id', () => {
        // By construction — the digest is of the common git dir. This is the
        // property that lets records written from either checkout join into one
        // episode, and it is the opposite of what 2.3 originally asked for.
        expect(resolveJournal(repoAWorktree).repository_id).toBe(resolveJournal(repoA).repository_id);
    });

    it('a branch switch does not change repository_id', () => {
        const before = resolveJournal(repoA).repository_id;
        git(repoA, 'checkout', '-b', 'feature/other');
        try {
            expect(resolveJournal(repoA).repository_id).toBe(before);
        } finally {
            git(repoA, 'checkout', 'main');
        }
    });
});

// ---------------------------------------------------------------------------
// Property 2 — the same two worktrees carry DISTINCT worktree_id
// ---------------------------------------------------------------------------

describe('2.3 property 2 — one repository, two checkouts, two worktree_ids', () => {
    it('the main checkout and its linked worktree resolve DIFFERENT worktree_ids', () => {
        expect(resolveJournal(repoAWorktree).worktree_id).not.toBe(resolveJournal(repoA).worktree_id);
    });

    it('worktree_id is a bounded digest, never a path', () => {
        for (const root of [repoA, repoAWorktree, repoB]) {
            const loc = resolveJournal(root);
            expect(loc.worktree_id).toMatch(/^[0-9a-f]{12}$/);
            expect(loc.repository_id).toMatch(/^[0-9a-f]{12}$/);
        }
    });

    it('the two ids are distinct concepts even in a main checkout, where the input directory is the same', () => {
        // Domain separation. Without it these would collide on the commonest
        // layout, and a reader could not tell one concept from two.
        const loc = resolveJournal(repoA);
        expect(loc.worktree_id).not.toBe(loc.repository_id);
    });

    it('a branch switch does not change worktree_id either — a checkout is not a branch', () => {
        const before = resolveJournal(repoA).worktree_id;
        git(repoA, 'checkout', '-b', 'feature/wt');
        try {
            expect(resolveJournal(repoA).worktree_id).toBe(before);
        } finally {
            git(repoA, 'checkout', 'main');
        }
    });
});

// ---------------------------------------------------------------------------
// Property 3 — two unrelated repositories: distinct stores AND distinct ids
// ---------------------------------------------------------------------------

describe('2.3 property 3 — two repositories share nothing', () => {
    it('two different repositories never share a database file', () => {
        expect(resolveJournal(repoB).path).not.toBe(resolveJournal(repoA).path);
    });

    it('two different repositories resolve DIFFERENT repository_ids', () => {
        // This is the collision the digest actually prevents: records read
        // together from two stores stay attributable to their own repository.
        expect(resolveJournal(repoB).repository_id).not.toBe(resolveJournal(repoA).repository_id);
    });

    it('and DIFFERENT worktree_ids', () => {
        expect(resolveJournal(repoB).worktree_id).not.toBe(resolveJournal(repoA).worktree_id);
    });
});

// ---------------------------------------------------------------------------
// The projection key — the one thing a branch switch DOES invalidate
// ---------------------------------------------------------------------------

describe('2.3 — a branch switch invalidates a projection, never a record', () => {
    it('PROJECTION KEY: a branch switch changes it', () => {
        const before = projectionKey(repoA);
        git(repoA, 'checkout', '-b', 'feature/projection');
        try {
            const after = projectionKey(repoA);
            expect(after).not.toBe(before);
            // Same repository half, different branch half.
            expect(after.split(':')[0]).toBe(before.split(':')[0]);
            expect(after.endsWith(':feature/projection')).toBe(true);
        } finally {
            git(repoA, 'checkout', 'main');
        }
    });

    it('PROJECTION KEY: a detached HEAD is named, not guessed', () => {
        const head = git(repoA, 'rev-parse', 'HEAD').trim();
        git(repoA, 'checkout', '--detach', head);
        try {
            expect(projectionKey(repoA).endsWith(':detached')).toBe(true);
        } finally {
            git(repoA, 'checkout', 'main');
        }
    });
});

// ---------------------------------------------------------------------------
// The three properties, exercised on real records rather than on the resolver
// ---------------------------------------------------------------------------

describe.runIf(sqliteOk)('records written from two worktrees join, and stay attributable (2.3)', () => {
    it('one episode, one repository_id, two worktree_ids', () => {
        const a = openJournal(repoA);
        let mainWorktreeId: string;
        try {
            const first = recordEvent(a, {
                event: 'user_prompt_submit',
                session_id: 'sess-a',
                task_id: 'task-shared',
                capability: 'skill-route',
                at: '2026-08-01T10:00:00.000Z',
            });
            mainWorktreeId = first.worktree_id;
        } finally {
            a.close();
        }

        const b = openJournal(repoAWorktree);
        try {
            const second = recordEvent(b, {
                event: 'stop',
                session_id: 'sess-b',
                task_id: 'task-shared',
                capability: 'dispatch_hook',
                terminal_state: 'success',
                at: '2026-08-01T11:00:00.000Z',
            });
            const all = readAllEvents(b);
            expect(all).toHaveLength(2);

            // JOIN: one episode across two checkouts and two sessions. The
            // shared repository_id is what makes the derived episode id agree.
            expect(new Set(all.map((e) => e.episode_id)).size).toBe(1);
            expect(all.every((e) => e.episode_id === second.episode_id)).toBe(true);
            expect(new Set(all.map((e) => e.repository_id)).size).toBe(1);

            // ATTRIBUTION: and each record still says which checkout wrote it.
            // This is the assertion the single-field schema could not make.
            expect(new Set(all.map((e) => e.worktree_id)).size).toBe(2);
            expect(second.worktree_id).not.toBe(mainWorktreeId);

            // The reconstruction surfaces both, in first-seen order.
            const episode = reconstructEpisode(b, second.episode_id);
            expect(episode).not.toBeNull();
            expect(episode?.worktree_ids).toEqual([mainWorktreeId, second.worktree_id]);
            expect(episode?.session_ids).toEqual(['sess-a', 'sess-b']);
        } finally {
            b.close();
        }
    });
});
