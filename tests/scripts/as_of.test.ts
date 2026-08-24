/**
 * Tests for `src/scripts/_lib/as_of.ts` — the one sanctioned reader of the wall
 * clock in `src/scripts/`.
 *
 * The module's own `--self-test` drives the shipped CLI end to end (7 cases,
 * covering all four rungs plus two malformed-pin rejections). These tests cover
 * what a CLI probe cannot: the resolver's precedence table, the memo, and the
 * fact that a malformed pin THROWS rather than silently falling to the next
 * rung — the substitution failure the whole module exists to remove.
 *
 * SABOTAGE PROBE, run 2026-08-23 before this file was trusted. Observed, not
 * asserted: deleting the `throw` in `parsePin` (returning epoch 0 instead) left
 * **2 of 11 red**, and both are the pin-rejection cases; forcing the `inCi`
 * guard true so rung 3 always answers left **2 of 11 red** — the wall-clock rung
 * AND the `CI=false` case, which is the pair that pins "a falsey marker is not
 * CI" as a separate property rather than a restatement. Restoring each gives
 * 11/11 and `git diff --stat` over the module is empty.
 */
import { describe, expect, it } from 'vitest';

import {
    AsOfPinError,
    _resetAsOfCacheForTests,
    asOf,
    asOfBanner,
    asOfResolution,
    resolveAsOf,
} from '../../src/scripts/_lib/as_of.js';

const FIXED = new Date('2020-05-06T07:08:09Z');
const COMMIT = new Date('2021-01-02T03:04:05Z');

/** Sources with every rung stubbed, so no test touches the real environment. */
function sources(over: Partial<Parameters<typeof resolveAsOf>[0]> = {}) {
    return {
        argv: [],
        env: {},
        commitDate: () => COMMIT,
        wallClock: () => FIXED,
        warn: () => undefined,
        ...over,
    };
}

describe('resolveAsOf — precedence', () => {
    it('rung 1: --as-of on argv wins over everything', () => {
        const r = resolveAsOf(
            sources({
                argv: ['--as-of', '2026-08-23T00:00:00Z'],
                env: { AC_AS_OF: '2019-01-01T00:00:00Z', CI: 'true' },
            }),
        );
        expect(r.rung).toBe('argv');
        expect(r.at.toISOString()).toBe('2026-08-23T00:00:00.000Z');
        expect(r.reproducible).toBe(true);
    });

    it('rung 1: the --as-of=<iso> form is equivalent', () => {
        const r = resolveAsOf(sources({ argv: ['--as-of=2026-08-23T00:00:00Z'] }));
        expect(r.rung).toBe('argv');
        expect(r.at.toISOString()).toBe('2026-08-23T00:00:00.000Z');
    });

    it('rung 2: AC_AS_OF answers when argv is silent, and beats CI', () => {
        const r = resolveAsOf(sources({ env: { AC_AS_OF: '2025-03-04T05:06:07Z', CI: 'true' } }));
        expect(r.rung).toBe('env');
        expect(r.at.toISOString()).toBe('2025-03-04T05:06:07.000Z');
    });

    it('rung 3: under CI the committed clock answers', () => {
        const r = resolveAsOf(sources({ env: { CI: 'true' } }));
        expect(r.rung).toBe('commit');
        expect(r.at.toISOString()).toBe(COMMIT.toISOString());
        expect(r.reproducible).toBe(true);
    });

    it('rung 3 falls through when git cannot answer, rather than inventing a date', () => {
        const r = resolveAsOf(sources({ env: { CI: 'true' }, commitDate: () => null }));
        expect(r.rung).toBe('wall-clock');
        expect(r.at.toISOString()).toBe(FIXED.toISOString());
    });

    it('CI=false is not CI — a falsey marker must not pin', () => {
        const r = resolveAsOf(sources({ env: { CI: 'false' } }));
        expect(r.rung).toBe('wall-clock');
    });

    it('rung 4: an unpinned run resolves, WARNs, and declares itself irreproducible', () => {
        const lines: string[] = [];
        const r = resolveAsOf(sources({ warn: (l: string) => void lines.push(l) }));
        expect(r.rung).toBe('wall-clock');
        expect(r.reproducible).toBe(false);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('not reproducible');
    });
});

describe('resolveAsOf — a malformed pin is a rejection, never a downgrade', () => {
    it('throws on an unparseable --as-of', () => {
        expect(() => resolveAsOf(sources({ argv: ['--as-of', 'not-a-date'] }))).toThrow(
            AsOfPinError,
        );
    });

    it('throws on an unparseable AC_AS_OF', () => {
        expect(() => resolveAsOf(sources({ env: { AC_AS_OF: '2026-13-45' } }))).toThrow(
            AsOfPinError,
        );
    });
});

describe('asOf — the process-wide memo', () => {
    it('returns a defensive copy, so a mutating caller cannot poison the memo', () => {
        _resetAsOfCacheForTests();
        const first = asOf();
        first.setFullYear(1999);
        expect(asOf().getTime()).toBe(asOfResolution().at.getTime());
        expect(asOf().getFullYear()).not.toBe(1999);
        _resetAsOfCacheForTests();
    });
});

describe('asOfBanner', () => {
    it("reports a gate's own flag as the source when one is given", () => {
        expect(asOfBanner('2026-08-23')).toBe('as-of: 2026-08-23 (source=flag)');
    });
});
