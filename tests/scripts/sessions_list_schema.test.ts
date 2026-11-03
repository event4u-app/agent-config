/**
 * `sessions:list --json --schema 1` is additive: the bare `--json` array and the
 * `--json --branches` object stay byte-identical because a scripted screen pins
 * them, and an unknown schema value is refused rather than silently served as
 * some other shape. Contract: docs/contracts/session-list.md.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type SessionRecord, iso_now, register_dir, write_record } from '../../src/scripts/_lib/session_register.js';
import { main, parse_schema_flag } from '../../src/scripts/sessions_cli.js';

let tmp: string;
let cwd: string;

function git(dir: string, ...args: string[]): void {
    execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
}

function make_repo(): string {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.email', 'test@example.com');
    git(repo, 'config', 'user.name', 'test');
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
    return repo;
}

function seed(repo: string, over: Partial<SessionRecord> = {}): SessionRecord {
    const dir = register_dir(repo);
    if (dir === null) throw new Error('no register dir');
    const r: SessionRecord = {
        session_id: 'sess-a',
        platform: 'claude',
        worktree: repo,
        branch: 'main',
        roadmap_slug: null,
        started_at: iso_now(),
        last_seen: iso_now(),
        ...over,
    };
    write_record(dir, r);
    return r;
}

function run(argv: string[]): { code: number; out: string; err: string } {
    let out = '';
    let err = '';
    const o = vi.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => {
        out += String(c);
        return true;
    });
    const e = vi.spyOn(process.stderr, 'write').mockImplementation((c: string | Uint8Array) => {
        err += String(c);
        return true;
    });
    try {
        const code = main(argv);
        return { code, out, err };
    } finally {
        o.mockRestore();
        e.mockRestore();
    }
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-list-schema-')));
    cwd = process.cwd();
});
afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('parse_schema_flag', () => {
    it('is undefined when absent, and accepts both spellings of 1', () => {
        expect(parse_schema_flag(['--json'])).toBeUndefined();
        expect(parse_schema_flag(['--json', '--schema', '1'])).toBe(1);
        expect(parse_schema_flag(['--schema=1', '--json'])).toBe(1);
    });

    it('refuses an unknown, missing or non-numeric value', () => {
        for (const argv of [['--schema', '2'], ['--schema'], ['--schema', 'one'], ['--schema=']]) {
            const r = parse_schema_flag(argv);
            expect(typeof r).toBe('object');
        }
    });
});

describe('sessions:list --json --schema 1', () => {
    it('prints one versioned object without the branch fields when --branches is absent', () => {
        const repo = make_repo();
        const r = seed(repo, { profile: { provider: 'claude', name: 'work', via: 'agent-switch' } });
        process.chdir(repo);
        const { code, out } = run(['list', '--json', '--schema', '1']);
        expect(code).toBe(0);
        const body = JSON.parse(out) as Record<string, unknown>;
        expect(Object.keys(body)).toEqual(['schema_version', 'sessions']);
        expect(body['schema_version']).toBe(1);
        expect(body['sessions']).toEqual([r]);
    });

    it('adds the branch fields with --branches, still one object', () => {
        const repo = make_repo();
        seed(repo);
        process.chdir(repo);
        const { code, out } = run(['list', '--json', '--branches', '--schema=1']);
        expect(code).toBe(0);
        const body = JSON.parse(out) as Record<string, unknown>;
        expect(Object.keys(body)).toEqual([
            'schema_version',
            'sessions',
            'other_worktree_branches',
            'unmerged_filter_applied',
        ]);
        expect(Array.isArray(body['other_worktree_branches'])).toBe(true);
        expect(typeof body['unmerged_filter_applied']).toBe('boolean');
    });

    it('prints an empty sessions list as an object, never a bare array', () => {
        const repo = make_repo();
        process.chdir(repo);
        const { out } = run(['list', '--json', '--schema', '1']);
        expect(JSON.parse(out)).toEqual({ schema_version: 1, sessions: [] });
    });

    it('leaves the unversioned forms byte-identical', () => {
        const repo = make_repo();
        const r = seed(repo);
        process.chdir(repo);
        expect(run(['list', '--json']).out).toBe(`${JSON.stringify([r], null, 2)}\n`);
        const withBranches = JSON.parse(run(['list', '--json', '--branches']).out) as Record<string, unknown>;
        expect(Object.keys(withBranches)).toEqual(['sessions', 'other_worktree_branches', 'unmerged_filter_applied']);
    });

    it('rejects an unknown schema with a clear error and exit 2', () => {
        const repo = make_repo();
        process.chdir(repo);
        const { code, out, err } = run(['list', '--json', '--schema', '7']);
        expect(code).toBe(2);
        expect(out).toBe('');
        expect(err).toContain('unknown --schema "7"');
        expect(err).toContain('supported: 1');
    });

    it('rejects --schema without --json', () => {
        const repo = make_repo();
        process.chdir(repo);
        const { code, err } = run(['list', '--schema', '1']);
        expect(code).toBe(2);
        expect(err).toContain('add --json');
    });
});
