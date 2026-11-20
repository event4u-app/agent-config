// feedback_policy — only an outcome worth reading on its own keeps a
// per-concern feedback file (road-to-a-hook-system-that-pays-for-what-it-does 2.4).
import { describe, expect, it } from 'vitest';

import { isQuietAllow, keepNewerOutcome } from '../../../src/scripts/hooks/feedback_policy.js';

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
