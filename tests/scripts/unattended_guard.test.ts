/**
 * unattended_guard — the three preconditions, and the defaults that decide
 * what happens when a config is missing.
 *
 * Every case here is really about one question: when the guard cannot tell,
 * which way does it fail? An unattended run spends money and can push, so
 * every ambiguity resolves toward refusing.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    BUDGET_REL,
    JOBS_REL,
    bookSpend,
    checkBudget,
    checkRemotes,
    emptyBudget,
    isProductionRemote,
    jobKey,
    preflight,
    readBudget,
    readJobs,
    utcDay,
    writeBudget,
    writeJobs,
    type UnattendedBudget,
} from '../../src/scripts/_lib/unattended_guard.js';

const dirs: string[] = [];
afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'unattended-'));
    dirs.push(d);
    return d;
}

function gitRepo(remotes: Record<string, string> = {}): string {
    const d = tmp();
    spawnSync('git', ['init', '-q'], { cwd: d });
    for (const [name, url] of Object.entries(remotes)) {
        spawnSync('git', ['remote', 'add', name, url], { cwd: d });
    }
    return d;
}

describe('isProductionRemote — a shape test, not a host allowlist', () => {
    it('network-reachable URLs are production', () => {
        for (const u of [
            'https://github.com/org/repo.git',
            'http://internal/repo.git',
            'ssh://git@host/repo.git',
            'git://host/repo.git',
            'git@github.com:org/repo.git',
        ]) {
            expect(isProductionRemote(u), u).toBe(true);
        }
    });

    it('filesystem remotes are not — a push there reaches nobody', () => {
        for (const u of ['/srv/mirrors/repo.git', './sibling', 'file:///tmp/repo.git']) {
            expect(isProductionRemote(u), u).toBe(false);
        }
    });

    it('empty is not a remote', () => {
        expect(isProductionRemote('   ')).toBe(false);
    });
});

describe('checkRemotes', () => {
    it('a worktree with no remote is safe', () => {
        const v = checkRemotes(gitRepo());
        expect(v.safe).toBe(true);
        expect(v.remotes).toEqual([]);
    });

    it('a local-path remote is safe and still reported', () => {
        const v = checkRemotes(gitRepo({ mirror: '/srv/mirror.git' }));
        expect(v.safe).toBe(true);
        expect(v.remotes).toEqual([{ name: 'mirror', url: '/srv/mirror.git', production: false }]);
    });

    it('a production remote refuses and NAMES the offender', () => {
        const v = checkRemotes(gitRepo({ origin: 'git@github.com:org/repo.git' }));
        expect(v.safe).toBe(false);
        expect(v.reason).toContain('origin');
        expect(v.reason).toContain('github.com');
    });

    it('an unreadable git config FAILS CLOSED', () => {
        // "I could not tell" and "there is no production remote" must not
        // resolve to the same answer when being wrong means an unattended
        // push to a real remote.
        const v = checkRemotes(tmp()); // not a git repository
        expect(v.safe).toBe(false);
        expect(v.reason).toContain('refusing');
    });
});

describe('the budget — an absent one DISABLES rather than permits', () => {
    it('a missing file reads as both ceilings zero', () => {
        const b = readBudget(tmp());
        expect(b.max_usd).toBe(0);
        expect(b.max_tokens).toBe(0);
    });

    it('both ceilings zero refuses, and says why', () => {
        const v = checkBudget(emptyBudget(utcDay()), 1, 1);
        expect(v.allowed).toBe(false);
        expect(v.reason).toContain('disables unattended runs');
    });

    it('a malformed file reads as disabled, never as unlimited', () => {
        const r = tmp();
        const f = path.join(r, BUDGET_REL);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, 'not json', 'utf-8');
        expect(readBudget(r).max_usd).toBe(0);
    });

    it('a negative or non-numeric ceiling reads as zero', () => {
        const r = tmp();
        const f = path.join(r, BUDGET_REL);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, JSON.stringify({ max_usd: -5, max_tokens: 'lots' }), 'utf-8');
        const b = readBudget(r);
        expect(b.max_usd).toBe(0);
        expect(b.max_tokens).toBe(0);
    });

    it('the projection is checked BEFORE the call, not after', () => {
        const b = { ...emptyBudget(utcDay()), max_usd: 10, spent_usd: 9 };
        // 9 + 2 > 10 → refused while still at 9, rather than reported at 11.
        expect(checkBudget(b, 2, 0).allowed).toBe(false);
        expect(checkBudget(b, 1, 0).allowed).toBe(true);
    });

    it('a token-only budget gates on tokens', () => {
        const b = { ...emptyBudget(utcDay()), max_tokens: 100, spent_tokens: 90 };
        expect(checkBudget(b, 0, 20).allowed).toBe(false);
        expect(checkBudget(b, 0, 10).allowed).toBe(true);
    });

    it('booking spend accumulates without touching the ceilings', () => {
        const b = bookSpend({ ...emptyBudget(utcDay()), max_usd: 10 }, 2.5, 100);
        expect(b).toMatchObject({ max_usd: 10, spent_usd: 2.5, spent_tokens: 100 });
    });

    it('a new UTC day rolls the spend and keeps the caps', () => {
        const r = tmp();
        writeBudget(r, {
            schema_version: 1,
            max_usd: 10,
            max_tokens: 1000,
            spent_usd: 9,
            spent_tokens: 900,
            window_opened: '2026-08-18',
        });
        const b = readBudget(r, new Date('2026-08-19T01:00:00.000Z'));
        expect(b.max_usd).toBe(10);
        expect(b.spent_usd).toBe(0);
        expect(b.window_opened).toBe('2026-08-19');
    });

    it('the same day does NOT roll', () => {
        const r = tmp();
        writeBudget(r, {
            schema_version: 1,
            max_usd: 10,
            max_tokens: 0,
            spent_usd: 9,
            spent_tokens: 0,
            window_opened: '2026-08-19',
        });
        expect(readBudget(r, new Date('2026-08-19T23:00:00.000Z')).spent_usd).toBe(9);
    });
});

describe('job dedup — derived from the work, never random', () => {
    it('the same roadmap at the same head yields the same key', () => {
        expect(jobKey('road-to-x', 'abcdef1234567890')).toBe(jobKey('road-to-x', 'abcdef1234567890'));
    });

    it('a different head is a different job', () => {
        expect(jobKey('road-to-x', 'aaaaaaaaaaaa')).not.toBe(jobKey('road-to-x', 'bbbbbbbbbbbb'));
    });

    it('the ledger round-trips and a malformed entry is dropped', () => {
        const r = tmp();
        writeJobs(r, { 'road-to-x@abc': { started_at: 'now' } });
        expect(readJobs(r)).toEqual({ 'road-to-x@abc': { started_at: 'now' } });
        fs.writeFileSync(path.join(r, JOBS_REL), JSON.stringify({ a: 1, b: { started_at: 'x' } }), 'utf-8');
        expect(readJobs(r)).toEqual({ b: { started_at: 'x' } });
    });
});

describe('preflight — every refusal, not just the first', () => {
    it('reports all three failures in one pass', () => {
        // An operator fixing one precondition at a time round-trips three
        // times; answering in one pass is the point of a preflight.
        const wt = tmp(); // not a repo → remote check fails closed
        const repo = tmp(); // no budget → disabled
        writeJobs(repo, { 'road-to-x@abcdef123456': { started_at: 'earlier' } });
        const v = preflight({
            repoRoot: repo,
            worktree: wt,
            roadmapSlug: 'road-to-x',
            head: 'abcdef1234567890',
            projectedUsd: 1,
            projectedTokens: 1,
        });
        expect(v.ok).toBe(false);
        expect(v.refusals).toHaveLength(3);
        expect(v.refusals.join(' ')).toContain('remote:');
        expect(v.refusals.join(' ')).toContain('budget:');
        expect(v.refusals.join(' ')).toContain('dedup:');
    });

    it('passes when all three clear', () => {
        const wt = gitRepo();
        const repo = tmp();
        writeBudget(repo, {
            schema_version: 1,
            max_usd: 10,
            max_tokens: 100_000,
            spent_usd: 0,
            spent_tokens: 0,
            window_opened: utcDay(),
        });
        const v = preflight({
            repoRoot: repo,
            worktree: wt,
            roadmapSlug: 'road-to-x',
            head: 'abcdef1234567890',
            projectedUsd: 1,
            projectedTokens: 1,
        });
        expect(v.ok).toBe(true);
        expect(v.refusals).toEqual([]);
        expect(v.jobKey).toBe('road-to-x@abcdef123456');
    });
});

describe('checkBudget — a ceiling written as 0 disables its dimension', () => {
    // R2 review, finding 5. `0` is documented as "disables" on BOTH fields,
    // and the guard read it as "skip this check" on the token side.
    const at = (over: Partial<UnattendedBudget>): UnattendedBudget => ({
        ...emptyBudget('2026-08-19'),
        ...over,
    });

    it('max_tokens: 0 refuses token spend even when the USD ceiling has room', () => {
        const v = checkBudget(at({ max_usd: 5 }), 0.01, 1000);
        expect(v.allowed).toBe(false);
        expect(v.reason).toContain('token ceiling is 0');
    });

    it('max_usd: 0 refuses USD spend even when the token ceiling has room', () => {
        const v = checkBudget(at({ max_tokens: 10_000 }), 0.01, 100);
        expect(v.allowed).toBe(false);
        expect(v.reason).toContain('USD ceiling is 0');
    });

    it('a disabled dimension still permits a run that consumes none of it', () => {
        // The refusal is on CONSUMPTION, not on the dimension existing — a
        // token-only run under a token ceiling is a legitimate shape.
        expect(checkBudget(at({ max_tokens: 10_000 }), 0, 100).allowed).toBe(true);
    });

    it('both ceilings set behave exactly as before', () => {
        expect(checkBudget(at({ max_usd: 5, max_tokens: 10_000 }), 1, 100).allowed).toBe(true);
        expect(checkBudget(at({ max_usd: 5, max_tokens: 10_000 }), 9, 100).allowed).toBe(false);
    });
});
