/**
 * Strike ledger — signature and fold.
 *
 * Synthetic runs only. Each verdict is asserted from both sides: the case that
 * must produce it and the nearest case that must not.
 */
import { describe, expect, it } from 'vitest';

import {
    coerceLedger,
    emptyLedger,
    failureSignature,
    observeRun,
    pruneLedger,
    recordEdit,
    targetKey,
    type StrikeLedger,
} from '../../src/scripts/_lib/strike_ledger.js';
import type { RunRecord } from '../../src/scripts/_lib/verification_evidence.js';

const CMD = 'npx vitest run tests/a.test.ts';

function red(failing: string, duration = '1.23s', line = 12): RunRecord {
    return {
        command: CMD,
        runner: 'vitest',
        exit_code: 1,
        stdout_tail:
            // Drift sits INSIDE the failure-bearing lines, where the signature reads it.
            ` FAIL  tests/a.test.ts > ${failing} ${duration}\n` +
            `AssertionError: expected 2 to be 3 at tests/a.test.ts:${String(line)}:9 (2026-11-03T10:${String(line).padStart(2, '0')}:01Z, 0x7f${String(line)}a)\n` +
            `      Tests  1 failed | 4 passed (5)\n   Duration  ${duration} (transform 40ms)\n` +
            `   Start at  10:${String(line).padStart(2, '0')}:01\n`,
        stderr_tail: '',
    };
}

const green: RunRecord = {
    command: CMD,
    runner: 'vitest',
    exit_code: 0,
    stdout_tail: '      Tests  5 passed (5)\n',
    stderr_tail: '',
};

const ctx = (n: number) => ({ agent: 'main', now: `2026-11-03T10:00:${String(n).padStart(2, '0')}Z`, platform: 'claude' });

function step(l: StrikeLedger, run: RunRecord, n: number, edit = true) {
    const before = edit ? recordEdit(l, 'main') : l;
    return observeRun(before, run, ctx(n));
}

describe('failureSignature', () => {
    it('is stable across duration, timestamp and line-number drift', () => {
        expect(failureSignature(red('adds', '1.23s', 12))).toBe(failureSignature(red('adds', '9.80s', 47)));
    });

    it('differs when a different test fails', () => {
        expect(failureSignature(red('adds'))).not.toBe(failureSignature(red('subtracts')));
    });

    it('differs when the failure count differs', () => {
        const two = { ...red('adds'), stdout_tail: red('adds').stdout_tail?.replace('1 failed', '2 failed') };
        expect(failureSignature(red('adds'))).not.toBe(failureSignature(two));
    });
});

describe('observeRun — the ledger verdicts', () => {
    it('red, edit, same red → SAME with streak 2', () => {
        let r = step(emptyLedger(), red('adds'), 1);
        expect(r.verdict).toBe('NEW');
        r = step(r.ledger, red('adds', '2.0s', 30), 2);
        expect(r.verdict).toBe('SAME');
        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(2);
    });

    it('a re-run with no edit between is not a new attempt', () => {
        let r = step(emptyLedger(), red('adds'), 1);
        r = step(r.ledger, red('adds'), 2, false);
        expect(r.verdict).toBe('SAME');
        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(1);
    });

    it('a different failure is NEW and restarts the streak — progress, not looping', () => {
        let r = step(emptyLedger(), red('adds'), 1);
        r = step(r.ledger, red('adds'), 2);
        r = step(r.ledger, red('subtracts'), 3);
        expect(r.verdict).toBe('NEW');
        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(1);
    });

    it('red then green after an edit → FIXED, streak 0', () => {
        let r = step(emptyLedger(), red('adds'), 1);
        r = step(r.ledger, green, 2);
        expect(r.verdict).toBe('FIXED');
        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(0);
    });

    it('red / green / red with no edit → FLAKY, and the streak does not grow', () => {
        let r = step(emptyLedger(), red('adds'), 1);
        r = step(r.ledger, green, 2, false);
        r = step(r.ledger, red('adds'), 3, false);
        expect(r.verdict).toBe('FLAKY');
        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(1);
    });

    it('red / green / red WITH an edit before the second red is not FLAKY', () => {
        let r = step(emptyLedger(), red('adds'), 1);
        r = step(r.ledger, green, 2);
        r = step(r.ledger, red('adds'), 3);
        expect(r.verdict).toBe('NEW');
    });

    it('two agents on the same command keep separate streaks', () => {
        let l = recordEdit(emptyLedger(), 'a');
        l = observeRun(l, red('adds'), { ...ctx(1), agent: 'a' }).ledger;
        l = recordEdit(l, 'b');
        l = observeRun(l, red('adds'), { ...ctx(2), agent: 'b' }).ledger;
        expect(l.entries[targetKey('a', green)]?.streak).toBe(1);
        expect(l.entries[targetKey('b', green)]?.streak).toBe(1);
    });

    it("another agent's edit is not this agent's attempt", () => {
        let l = recordEdit(emptyLedger(), 'a');
        l = observeRun(l, red('adds'), { ...ctx(1), agent: 'a' }).ledger;
        l = recordEdit(l, 'b'); // b edits the shared tree; a only re-runs
        const r = observeRun(l, red('adds'), { ...ctx(2), agent: 'a' });
        expect(r.verdict).toBe('SAME');
        expect(r.ledger.entries[targetKey('a', green)]?.streak).toBe(1);
    });

    it('an instrument gap leaves the ledger untouched', () => {
        const l = step(emptyLedger(), red('adds'), 1).ledger;
        const gap: RunRecord = { ...green, exit_code: null };
        const r = observeRun(l, gap, ctx(2));
        expect(r.verdict).toBeNull();
        expect(r.ledger).toBe(l);
    });
});

describe('ledger lifetime and shape', () => {
    it('a later session within the TTL inherits the streak; an older one is pruned', () => {
        let r = step(emptyLedger(), red('adds'), 1);
        r = step(r.ledger, red('adds'), 2);
        const later = pruneLedger(r.ledger, '2026-11-08T10:00:00Z');
        expect(later.entries[targetKey('main', green)]?.streak).toBe(2);
        expect(pruneLedger(r.ledger, '2026-11-11T10:00:00Z').entries).toEqual({});
    });

    it('rebuilds persisted entries from allowlisted fields and drops invalid ones', () => {
        const good = step(emptyLedger(), red('adds'), 1).ledger;
        const [key, entry] = Object.entries(good.entries)[0] ?? [];
        const raw = {
            edits: { ...good.edits, notahash: 3, deadbeefdeadbeef: -1 },
            entries: {
                [key as string]: { ...entry, stdout_tail: 'SECRET token=abc' },
                ffffffffffffffff: null,
                eeeeeeeeeeeeeeee: { ...entry, streak: -2 },
                'not a key': entry,
            },
        };
        const back = coerceLedger(raw);
        expect(Object.keys(back.entries)).toEqual([key]);
        expect(JSON.stringify(back)).not.toMatch(/SECRET|notahash|deadbeefdeadbeef/);
        expect(() => pruneLedger(back, '2026-11-04T00:00:00Z')).not.toThrow();
    });

    it('stores no text from the run', () => {
        const r = step(emptyLedger(), red('adds'), 1);
        const json = JSON.stringify(r.ledger);
        expect(json).not.toMatch(/AssertionError|adds|tests\/a\.test\.ts|vitest/);
    });
});
