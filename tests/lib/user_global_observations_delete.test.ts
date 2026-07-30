/**
 * Tests for the Phase 4 ("delete, revoke, audit") additions to
 * `src/scripts/_lib/user_global_observations.ts` — per-observation delete
 * and whole-project-context purge, per
 * `agents/roadmaps/road-to-global-user-memory.md` Phase 4.
 *
 * Every test injects `EVENT4U_CONFIG_HOME` at a temp dir and pins `$HOME`
 * to an empty temp dir (mirrors the sibling Phase 2/3 suites) so the real
 * `~/.event4u/agent-config/` and `~/.config/agent-config/` on the machine
 * running this suite are never touched.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as ugo from '../../src/scripts/_lib/user_global_observations';
import * as ugr from '../../src/scripts/_lib/user_global_revocations';

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp_dirs.push(dir);
    return dir;
}

function isolate_home(): void {
    const fake_home = make_tmp('ugo-del-fakehome-');
    saved_env.push(['HOME', process.env.HOME]);
    process.env.HOME = fake_home;
}

beforeEach(() => {
    isolate_home();
});

afterEach(() => {
    vi.restoreAllMocks();
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

function fakeConfigHome(): { home: string; env: { EVENT4U_CONFIG_HOME: string } } {
    const home = make_tmp('ugo-del-config-');
    return { home, env: { EVENT4U_CONFIG_HOME: home } };
}

function bufferPath(home: string): string {
    return path.join(home, 'user', 'observations.jsonl');
}

function seedBuffer(home: string, entries: readonly ugo.ObservationCandidate[]): void {
    const target = bufferPath(home);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
}

function candidate(overrides: Partial<ugo.ObservationCandidate> = {}): ugo.ObservationCandidate {
    return {
        ts: '2026-08-01T10:00:00Z',
        field: 'notes',
        suggest: 'user prefers short replies',
        source: 'agent',
        evidence: 'user prefers short replies',
        ...overrides,
    };
}

describe('observationId', () => {
    it('is deterministic — same {ts, field, suggest} always hashes the same', () => {
        const a = candidate();
        const b = candidate();
        expect(ugo.observationId(a)).toBe(ugo.observationId(b));
    });

    it('differs when suggest differs, even with the same ts/field', () => {
        const a = candidate({ suggest: 'A' });
        const b = candidate({ suggest: 'B' });
        expect(ugo.observationId(a)).not.toBe(ugo.observationId(b));
    });

    it('is stable across source/evidence/context differences — identity is ts+field+suggest only', () => {
        const a = candidate({ source: 'chat', evidence: 'e1' });
        const b = candidate({ source: 'agent', evidence: 'e2' });
        expect(ugo.observationId(a)).toBe(ugo.observationId(b));
    });
});

describe('deleteGlobalObservation', () => {
    it('removes exactly the matched entry, leaving the rest untouched', () => {
        const { home, env } = fakeConfigHome();
        const keep = candidate({ ts: '2026-08-01T10:00:00Z', suggest: 'keep me' });
        const drop = candidate({ ts: '2026-08-01T11:00:00Z', suggest: 'drop me' });
        seedBuffer(home, [keep, drop]);

        const result = ugo.deleteGlobalObservation(ugo.observationId(drop), 'stale', {
            env,
            today: '2026-08-05',
        });

        expect(result.deleted).toBe(true);
        const remaining = ugo.readGlobalObservations({ env }).entries;
        expect(remaining).toHaveLength(1);
        expect(remaining[0]?.suggest).toBe('keep me');
    });

    it('records a tombstone for the removed observation', () => {
        const { home, env } = fakeConfigHome();
        const drop = candidate({ suggest: 'forget this one' });
        seedBuffer(home, [drop]);

        ugo.deleteGlobalObservation(ugo.observationId(drop), 'user requested deletion', {
            env,
            today: '2026-08-06',
        });

        const trail = ugr.loadTombstones(env);
        expect(trail).toEqual([
            {
                revoked_at: '2026-08-06',
                entity_id: ugo.observationId(drop),
                reason: 'user requested deletion',
            },
        ]);
    });

    it('reports deleted: false and writes NO tombstone when the id has no match', () => {
        const { home, env } = fakeConfigHome();
        seedBuffer(home, [candidate()]);

        const result = ugo.deleteGlobalObservation('does-not-exist', 'n/a', { env });

        expect(result.deleted).toBe(false);
        expect(result.tombstone).toBeUndefined();
        expect(ugr.loadTombstones(env)).toEqual([]);
    });

    it('tombstone precedes deletion — a failed tombstone write leaves the buffer untouched', () => {
        // `node:fs`'s ES-module namespace object is non-configurable (Node
        // built-ins reject `Object.defineProperty` on their bindings), so
        // `vi.spyOn(fs, ...)` cannot observe call order directly. Gating the
        // ledger write instead proves the same thing more strongly: if
        // `appendTombstone` throws, `deleteGlobalObservation` must propagate
        // that error WITHOUT having rewritten the buffer — the delete step
        // never runs unless the tombstone step ran (and succeeded) first.
        const { home, env } = fakeConfigHome();
        const drop = candidate({ suggest: 'order matters' });
        seedBuffer(home, [drop]);
        const before = fs.readFileSync(bufferPath(home), 'utf-8');

        const tombstoneSpy = vi.spyOn(ugr, 'appendTombstone').mockImplementation(() => {
            throw new Error('ledger unavailable');
        });

        expect(() =>
            ugo.deleteGlobalObservation(ugo.observationId(drop), 'order check', { env, today: '2026-08-07' }),
        ).toThrow('ledger unavailable');

        expect(tombstoneSpy).toHaveBeenCalledTimes(1);
        expect(fs.readFileSync(bufferPath(home), 'utf-8')).toBe(before);
    });
});

describe('purgeProjectContext', () => {
    function contextEntry(project: string, suggest: string): ugo.ObservationCandidate {
        return candidate({
            suggest,
            context: {
                project_path: `/Users/matze/projects/${project}`,
                project_name: project,
                first_seen: '2026-08-01T10:00:00Z',
            },
        });
    }

    it('removes every observation attributed to the purged project and leaves no residue', () => {
        const { home, env } = fakeConfigHome();
        const acmeWeb1 = contextEntry('acme-web', 'use pnpm');
        const acmeWeb2 = contextEntry('acme-web', 'use pnpm again');
        const acmeApi = contextEntry('acme-api', 'different project, different fact');
        const noContext = candidate({ suggest: 'pure user preference, no project' });
        seedBuffer(home, [acmeWeb1, acmeWeb2, acmeApi, noContext]);

        const result = ugo.purgeProjectContext('/Users/matze/projects/acme-web', 'project deleted', {
            env,
            today: '2026-08-08',
        });

        expect(result.purgedCount).toBe(2);
        const remaining = ugo.readGlobalObservations({ env }).entries;
        expect(remaining).toHaveLength(2);
        expect(remaining.some((e) => e.context?.project_path === '/Users/matze/projects/acme-web')).toBe(false);
        expect(remaining.some((e) => e.context?.project_name === 'acme-api')).toBe(true);
        expect(remaining.some((e) => e.suggest === 'pure user preference, no project')).toBe(true);
    });

    it('writes one tombstone per purged observation, all recorded in the ledger', () => {
        const { home, env } = fakeConfigHome();
        const a = contextEntry('acme-web', 'fact one');
        const b = contextEntry('acme-web', 'fact two');
        seedBuffer(home, [a, b]);

        const result = ugo.purgeProjectContext('/Users/matze/projects/acme-web', 'bulk purge', {
            env,
            today: '2026-08-09',
        });

        expect(result.tombstones).toHaveLength(2);
        const trail = ugr.loadTombstones(env);
        expect(trail.map((t) => t.entity_id).sort()).toEqual(
            [ugo.observationId(a), ugo.observationId(b)].sort(),
        );
    });

    it('tombstones precede deletion — a failure on the FIRST tombstone leaves the buffer untouched', () => {
        // Every removed entry is tombstoned before the buffer is rewritten
        // ONCE at the end (see `purgeProjectContext`'s implementation) — so
        // gating the very first `appendTombstone` call proves the whole
        // batch of tombstones happens before that single rewrite.
        const { home, env } = fakeConfigHome();
        const a = contextEntry('acme-web', 'fact one');
        const b = contextEntry('acme-web', 'fact two');
        seedBuffer(home, [a, b]);
        const before = fs.readFileSync(bufferPath(home), 'utf-8');

        const tombstoneSpy = vi.spyOn(ugr, 'appendTombstone').mockImplementation(() => {
            throw new Error('ledger unavailable');
        });

        expect(() =>
            ugo.purgeProjectContext('/Users/matze/projects/acme-web', 'bulk purge', { env }),
        ).toThrow('ledger unavailable');

        expect(tombstoneSpy).toHaveBeenCalledTimes(1);
        expect(fs.readFileSync(bufferPath(home), 'utf-8')).toBe(before);
    });

    it('a no-match purge writes nothing — purgedCount 0, no tombstone, buffer untouched', () => {
        const { home, env } = fakeConfigHome();
        const kept = contextEntry('acme-api', 'unrelated');
        seedBuffer(home, [kept]);
        const before = fs.readFileSync(bufferPath(home), 'utf-8');

        const tombstoneSpy = vi.spyOn(ugr, 'appendTombstone');
        const result = ugo.purgeProjectContext('/Users/matze/projects/nonexistent', 'no-op', { env });

        expect(result).toEqual({ purgedCount: 0, tombstones: [] });
        expect(tombstoneSpy).not.toHaveBeenCalled();
        expect(ugr.loadTombstones(env)).toEqual([]);
        expect(fs.readFileSync(bufferPath(home), 'utf-8')).toBe(before);
    });
});
