// feedback_policy — only an outcome worth reading on its own keeps a
// per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { update_json_under_lock } from '../../../src/scripts/hooks/state_io.js';

import { isQuietAllow, keepNewerOutcome, withLatestRuns } from '../../../src/scripts/hooks/feedback_policy.js';

const allow = { concern: 'c', exit_code: 0, raw_exit_code: 0, decision: 'allow', reason: null };

describe('feedback_policy — isQuietAllow', () => {
    it('a plain allow is quiet', () => {
        expect(isQuietAllow(allow)).toBe(true);
        expect(isQuietAllow({ ...allow, reason: undefined })).toBe(true);
    });

    it('a warn, a block, a crash resolved to allow, a non-allow decision or a reason keep their file', () => {
        expect(isQuietAllow({ ...allow, exit_code: 1, decision: 'warn' })).toBe(false);
        expect(isQuietAllow({ ...allow, exit_code: 2, decision: 'block' })).toBe(false);
        expect(isQuietAllow({ ...allow, raw_exit_code: 3 })).toBe(false);
        expect(isQuietAllow({ ...allow, decision: 'ask' })).toBe(false);
        expect(isQuietAllow({ ...allow, reason: 'context injected' })).toBe(false);
    });
});


describe('feedback_policy — keepNewerOutcome', () => {
    it('two warnings published in reverse completion order leave the later-completed one', () => {
        const later = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:02Z' };
        const earlier = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:01Z' };
        // The later-completed dispatch publishes first; the earlier one arrives after it.
        expect(keepNewerOutcome({}, later)).toBe(later);
        expect(keepNewerOutcome(later, earlier)).toBeNull();
        expect(keepNewerOutcome(earlier, later)).toBe(later);
    });

    it('compares instants, and lets the write through when either timestamp is unreadable', () => {
        expect(keepNewerOutcome({ completed_at: '2026-11-20T10:00:00.500Z' }, { completed_at: '2026-11-20T10:00:00Z' })).toBeNull();
        const e = { completed_at: 'not a date' };
        expect(keepNewerOutcome({ completed_at: '2026-11-20T10:00:00Z' }, e)).toBe(e);
    });
});

describe('feedback_policy — through the locked update on a real file', () => {
    it('reverse-order publishes leave the later-completed warning on disk', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-order-'));
        try {
            const f = path.join(dir, 'c.json');
            const later = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:02Z' };
            const earlier = { concern: 'c', decision: 'warn', completed_at: '2026-11-20T10:00:01Z' };
            expect(update_json_under_lock(f, (loaded) => keepNewerOutcome(loaded, later))).toBe('written');
            expect(update_json_under_lock(f, (loaded) => keepNewerOutcome(loaded, earlier))).toBe('skipped');
            expect(JSON.parse(fs.readFileSync(f, 'utf-8')).completed_at).toBe(later.completed_at);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('feedback_policy — withLatestRuns, the summary\'s uncapped per-concern row', () => {
    const run = (concern: string, at: string): Record<string, unknown> => ({ concern, completed_at: at });

    it('in order: the later dispatch replaces the row', () => {
        const a = withLatestRuns({}, [run('c', '2026-11-20T10:00:00Z')], 'pid-A');
        const b = withLatestRuns(a, [run('c', '2026-11-20T11:00:00Z')], 'pid-B');
        expect(b['c']).toEqual({ invocation: 'pid-B', completed_at: '2026-11-20T11:00:00Z' });
    });

    it('reverse publication: an older run publishing after a newer one does not overwrite it', () => {
        const newer = withLatestRuns({}, [run('c', '2026-11-20T11:00:00Z')], 'pid-quiet-allow');
        const after = withLatestRuns(newer, [run('c', '2026-11-20T10:00:00Z')], 'pid-older-block');
        expect(after['c']).toEqual({ invocation: 'pid-quiet-allow', completed_at: '2026-11-20T11:00:00Z' });
    });

    it('orders by the concern\'s own completion, not by the dispatch\'s', () => {
        // Dispatch A finished last overall, but its run of `c` completed before B's run of `c`.
        const b = withLatestRuns({}, [run('c', '2026-11-20T10:00:05Z')], 'pid-B');
        const a = withLatestRuns(b, [run('c', '2026-11-20T10:00:01Z'), run('d', '2026-11-20T10:00:09Z')], 'pid-A');
        expect(a['c']?.invocation).toBe('pid-B');
        expect(a['d']?.invocation).toBe('pid-A');
    });

    it('keeps other concerns\' rows and drops malformed ones', () => {
        const held = { other: { invocation: 'pid-0', completed_at: '2026-11-20T09:00:00Z' }, junk: 'x', bad: { completed_at: 'y' } };
        const out = withLatestRuns(held, [run('c', '2026-11-20T10:00:00Z')], 'pid-1');
        expect(Object.keys(out).sort()).toEqual(['c', 'other']);
        expect(withLatestRuns([], [run('c', '2026-11-20T10:00:00Z')], 'pid-1')['c']?.invocation).toBe('pid-1');
    });
});
