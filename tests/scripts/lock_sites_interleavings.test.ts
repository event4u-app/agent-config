// Every file lock that breaks a stale guard, run through the same three-caller
// interleaving harness (road-to-verified-stale-lock-reclaim, Phase 2).
//
// Two starts per site: an abandoned guard that two callers may both judge
// stale, and a holder that pauses past the stale threshold before it releases.
// A finding is a schedule in which two callers are inside the critical section
// at once. The paused-holder start allows exactly one overlap shape and no
// other: the paused holder itself beside the caller that superseded it, which is
// the lease-without-fencing limit every site names. Its release must never let a
// THIRD caller in beside the superseder.
//
// `state_io` runs non-blocking only: its blocking acquire is the same attempt
// repeated for up to 2,500 spins, which this nested harness pays per schedule.
// A repeat is one more caller of the protocol the explorer in
// `generation_lock_interleavings.test.ts` already covers, and the wait itself is
// tested there. The blocking variant was run red against the stat-then-remove
// code before the switch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _withLedgerLock } from '../../src/scripts/ai_council/budget_guard.js';
import { withStateLock } from '../../src/scripts/ai_council/cli_call_budget.js';
import { pruneSessionTables, updateTable, sessionTablePath } from '../../src/scripts/_lib/egress_session_table.js';
import { updateRegistry } from '../../src/scripts/_lib/project_registry.js';
import { update_text_under_lock } from '../../src/scripts/hooks/state_io.js';
import { _withToolWriteLock, statePathFor } from '../../src/scripts/language_mirror_hook.js';

import { tryAcquire } from '../../src/scripts/_lib/generation_lock.js';

import { installHarness, type Harness, type LockSite } from './_lock_interleaving_harness.js';

let tmp = '';
let harness: Harness | null = null;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lock-sites-')));
});

afterEach(() => {
    harness?.uninstall();
    harness = null;
    fs.rmSync(tmp, { recursive: true, force: true });
});

const SITES: Record<string, () => LockSite> = {
    'state_io update_text_under_lock (non-blocking)': () => {
        const target = path.join(tmp, 'state.json');
        return {
            guardPrefix: `${target}.lock`,
            call: (body) => void update_text_under_lock(target, () => (body(), null), { blocking: false }),
        };
    },
    'state_io update_text_under_lock (strict)': () => {
        const target = path.join(tmp, 'state.json');
        return {
            guardPrefix: `${target}.lock`,
            call: (body) => void update_text_under_lock(target, () => (body(), null), { blocking: false, strict: true }),
        };
    },
    'language_mirror_hook _withToolWriteLock': () => ({
        guardPrefix: `${path.join(tmp, statePathFor('s1'))}.lock`,
        call: (body) => void _withToolWriteLock(tmp, 's1', null, () => (body(), null)),
    }),
    'egress_session_table updateTable': () => {
        const dir = path.join(tmp, 'table');
        return {
            guardPrefix: `${sessionTablePath(dir, 's1')}.lock`,
            call: (body) => void updateTable({ dir, sessionId: 's1', workspaceRoot: path.join(tmp, 'ws') }, () => body()),
        };
    },
    'budget_guard _withLedgerLock': () => {
        const ledger = path.join(tmp, 'council', 'spend.jsonl');
        return {
            guardPrefix: `${ledger}.lock`,
            call: (body) => void _withLedgerLock(ledger, 3000, () => body()),
        };
    },
    'project_registry updateRegistry': () => {
        const dir = path.join(tmp, 'projects');
        return {
            guardPrefix: path.join(dir, 'registry.lock'),
            call: (body) => void updateRegistry(() => body(), { dir }),
        };
    },
};

// A strict caller never supersedes a stale guard, so its `abandoned` exploration
// below is empty by construction; this is the property that row stands for.
describe('state_io strict caller over an abandoned guard', () => {
    it('never enters, blocking or not, and returns at once', () => {
        const target = path.join(tmp, 'state.json');
        fs.writeFileSync(`${target}.lock.held`, '');
        const old = (Date.now() - 3_600_000) / 1000;
        fs.utimesSync(`${target}.lock.held`, old, old);
        let entered = 0;
        const t = Date.now();
        for (const blocking of [false, true]) update_text_under_lock(target, () => (entered++, null), { strict: true, blocking });
        expect(entered).toBe(0);
        expect(Date.now() - t).toBeLessThan(1_000);
    });
});

describe.each(Object.keys(SITES))('%s', (name) => {
    const site = (): Harness => (harness = installHarness((SITES[name] as () => LockSite)()));

    // Every refusal below would also pass a lock that never lets anyone in.
    it('a lone caller enters, and so does the next one after its release', () => {
        const s = (SITES[name] as () => LockSite)();
        let entered = 0;
        s.call(() => void (entered += 1));
        s.call(() => void (entered += 1));
        expect(entered).toBe(2);
    });

    it('the harness reaches the lock: a lone caller passes several injection points', () => {
        expect(site().pointsOfSoloRun('abandoned')).toBeGreaterThan(2);
    });

    // Each completed critical section of a site is a real write (the registry's
    // is fsynced), across a few hundred schedules.
    it('no schedule over an abandoned guard admits two holders', () => {
        expect(site().explore('abandoned')).toEqual([]);
    }, 120_000);

    it('a paused holder overlaps at most its superseder, never a third caller', () => {
        const hits = site().explore('paused-holder');
        expect(hits.filter((h) => !/→ A\+[BC]$/.test(h))).toEqual([]);
    }, 120_000);
});

// A release ages its generation instead of removing it, so a site whose file is
// pruned must prune its lock family with it, or one lock file per session stays.
describe('the egress table pruner', () => {
    it('removes a retired table and every lock generation but the highest', () => {
        const dir = path.join(tmp, 'table');
        const t = { dir, sessionId: 's1', workspaceRoot: path.join(tmp, 'ws'), now: Date.parse('2020-01-01T00:00:00Z') };
        updateTable(t, () => undefined);
        updateTable(t, () => undefined);
        expect(fs.readdirSync(dir).some((n) => n.includes('.lock'))).toBe(true);
        expect(fs.readdirSync(dir).filter((n) => n.includes('.lock'))).toHaveLength(1);
        fs.writeFileSync(`${sessionTablePath(dir, 's1')}.lock`, ''); // a lower leftover
        expect(pruneSessionTables(dir)).toBe(1);
        expect(fs.readdirSync(dir)).toEqual([`${path.basename(sessionTablePath(dir, 's1'))}.lock.1`]);
    });

    it('keeps a lock generation that may be held, while the table is pruned', () => {
        const dir = path.join(tmp, 'table');
        const t = { dir, sessionId: 's1', workspaceRoot: path.join(tmp, 'ws'), now: Date.parse('2020-01-01T00:00:00Z') };
        updateTable(t, () => undefined);
        const peer = tryAcquire(`${sessionTablePath(dir, 's1')}.lock`, { staleMs: 5_000 });
        expect(peer).not.toBeNull();
        expect(pruneSessionTables(dir)).toBe(1);
        expect(fs.readdirSync(dir).filter((n) => n.includes('.lock'))).toHaveLength(1);
    });
});

// A filesystem error on the ledger lock is a refusal, as a timed-out wait is,
// never a throw: the reservation callers have no try.
describe('the council ledger lock', () => {
    it('refuses rather than throws when its lock directory cannot be listed', () => {
        const ledger = path.join(tmp, 'council', 'spend.jsonl');
        fs.mkdirSync(path.dirname(ledger), { recursive: true });
        const real = fs.readdirSync;
        const spy = vi.spyOn(fs, 'readdirSync').mockImplementation(((...a: Parameters<typeof fs.readdirSync>) => {
            if (String(a[0]) === path.dirname(ledger)) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
            return real(...a);
        }) as typeof fs.readdirSync);
        try {
            expect(_withLedgerLock(ledger, 50, () => 'ran')).toBeNull();
        } finally {
            spy.mockRestore();
        }
    });
});

// The CLI call budget's break compared `performance.now()` with an epoch mtime
// and never fired; on the generation lock it does.
describe('the CLI call budget lock', () => {
    it('supersedes a lock abandoned for longer than its one-second threshold', () => {
        const target = path.join(tmp, 'cli-calls.json');
        fs.writeFileSync(`${target}.lock`, '');
        const old = (Date.now() - 5_000) / 1000;
        fs.utimesSync(`${target}.lock`, old, old);
        const t = Date.now();
        expect(withStateLock(target, () => 'ran')).toBe('ran');
        expect(Date.now() - t).toBeLessThan(500);
        expect(fs.existsSync(`${target}.lock.1`)).toBe(true);
    });
});
