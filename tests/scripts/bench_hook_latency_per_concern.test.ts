// Tests for the per-concern latency report (step 3.2 of
// road-to-a-kernel-that-guards-its-plumbing) and the dispatcher sink that
// feeds it.
//
// The step's verify line has one clause that carries the whole risk: a concern
// the bench could not time prints `not_measured`, NEVER `0`. Two different
// routes produce a false zero and only one of them is obvious, so both are
// pinned here:
//
//   1. the missing-sample route — no rows in the sink for a concern;
//   2. the truncation route — a real sub-millisecond measurement floored to an
//      integer millisecond. This one was live: every concern in the static
//      registry runs in-process and the first run of this report printed
//      `0 ms` for all nine blocking concerns.
//
// Route 2 is why the row carries microseconds. A test that only covered route 1
// would have passed against the broken version, which is the near-miss these
// cases exist to close.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    blockingConcerns,
    NOT_MEASURED,
    perConcernRows,
    readConcernTimings,
    renderConcernRow,
} from '../../src/scripts/bench_hook_latency.js';
import { _write_concern_timings } from '../../src/scripts/hooks/dispatch_hook.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-concern-timings-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const sink = (): string => path.join(tmp, 'timings.jsonl');

describe('readConcernTimings', () => {
    it('groups samples by concern', () => {
        const p = sink();
        fs.writeFileSync(
            p,
            [
                JSON.stringify({ concern: 'a', duration_us: 100 }),
                JSON.stringify({ concern: 'b', duration_us: 900 }),
                JSON.stringify({ concern: 'a', duration_us: 300 }),
            ].join('\n') + '\n',
        );
        const got = readConcernTimings(p);
        expect(got.get('a')).toEqual([100, 300]);
        expect(got.get('b')).toEqual([900]);
    });

    it('skips malformed and incomplete rows rather than throwing', () => {
        const p = sink();
        fs.writeFileSync(
            p,
            [
                'not json at all',
                JSON.stringify({ concern: 'a' }), // no duration
                JSON.stringify({ duration_us: 5 }), // no concern
                JSON.stringify({ concern: 'a', duration_us: 'slow' }), // wrong type
                '',
                JSON.stringify({ concern: 'a', duration_us: 42 }),
            ].join('\n') + '\n',
        );
        expect(readConcernTimings(p).get('a')).toEqual([42]);
    });

    it('returns empty for a sink that does not exist', () => {
        expect(readConcernTimings(path.join(tmp, 'absent.jsonl')).size).toBe(0);
    });
});

describe('perConcernRows — the two routes to a false zero', () => {
    const blocking = [
        { name: 'measured', fail_closed: true },
        { name: 'never-ran', fail_closed: false },
    ];

    it('route 1 — a concern with no samples is null, not 0', () => {
        const rows = perConcernRows(blocking, new Map([['measured', [500]]]));
        const missing = rows.find((r) => r.concern === 'never-ran');
        expect(missing?.n).toBe(0);
        expect(missing?.p95_us).toBeNull();
        // The distinction that matters: null is not 0, and the renderer must
        // not collapse them.
        expect(missing?.p95_us).not.toBe(0);
    });

    it('route 2 — a sub-millisecond concern keeps a non-zero p95', () => {
        // 197 microseconds is a real reading from this tree's own bench run.
        // Floored to milliseconds it is 0; in microseconds it survives.
        const rows = perConcernRows(blocking, new Map([['measured', [180, 190, 197]]]));
        const row = rows.find((r) => r.concern === 'measured');
        expect(row?.p95_us).toBe(197);
        expect(renderConcernRow(row!)).toContain('0.197 ms');
        expect(renderConcernRow(row!)).not.toMatch(/p95\s+0 ms/u);
    });

    it('sla_ms is null when unregistered and a number when registered', () => {
        const unregistered = perConcernRows(blocking, new Map(), {});
        expect(unregistered[0]?.sla_ms).toBeNull();
        const registered = perConcernRows(blocking, new Map(), { measured: 25 });
        expect(registered.find((r) => r.concern === 'measured')?.sla_ms).toBe(25);
        // An explicit null in the budget is a REGISTERED ABSENCE and must not
        // be read as a bound of zero.
        const explicitNull = perConcernRows(blocking, new Map(), { measured: null });
        expect(explicitNull.find((r) => r.concern === 'measured')?.sla_ms).toBeNull();
    });
});

describe('renderConcernRow', () => {
    it('prints not_measured for both nulls', () => {
        const line = renderConcernRow({
            concern: 'x',
            fail_closed: false,
            n: 0,
            p95_us: null,
            sla_ms: null,
        });
        expect(line.match(new RegExp(NOT_MEASURED, 'gu'))?.length).toBe(2);
        expect(line).not.toContain('0 ms');
    });
});

describe('blockingConcerns', () => {
    it('reads the live manifest and returns every blocking concern', () => {
        const got = blockingConcerns();
        const names = got.map((c) => c.name);
        // Read from the manifest rather than asserted as a fixed list: the
        // step was written against eight and step 1.2 of the same roadmap made
        // it nine, so a hardcoded count here would be stale by design.
        expect(names).toContain('block-no-verify');
        expect(names).toContain('block-plumbing-writes');
        expect(got.find((c) => c.name === 'block-no-verify')?.fail_closed).toBe(true);
        expect(got.length).toBeGreaterThanOrEqual(8);
    });
});

describe('_write_concern_timings — the dispatcher sink', () => {
    const envelope = { event: 'pre_tool_use', platform: 'claude' };

    it('writes nothing when the sink is unarmed', () => {
        const p = sink();
        _write_concern_timings(envelope, [{ concern: 'a', duration_us: 10 }], undefined);
        expect(fs.existsSync(p)).toBe(false);
    });

    it('APPENDS across calls — the property the feedback dir cannot provide', () => {
        const p = sink();
        _write_concern_timings(envelope, [{ concern: 'a', duration_us: 10 }], p);
        _write_concern_timings(envelope, [{ concern: 'a', duration_us: 20 }], p);
        // The feedback dir keeps one file per concern and overwrites it every
        // dispatch, so a p95 taken from it would be a p95 of one sample. This
        // assertion is the whole reason the sink is a separate mechanism.
        expect(readConcernTimings(p).get('a')).toEqual([10, 20]);
    });

    it('omits a sample whose duration is not finite', () => {
        const p = sink();
        _write_concern_timings(
            envelope,
            [
                { concern: 'a', duration_us: Number.NaN },
                { concern: 'b', duration_us: 7 },
            ],
            p,
        );
        const got = readConcernTimings(p);
        expect(got.has('a')).toBe(false);
        expect(got.get('b')).toEqual([7]);
    });

    it('never throws on an unwritable sink', () => {
        expect(() =>
            _write_concern_timings(
                envelope,
                [{ concern: 'a', duration_us: 1 }],
                path.join(tmp, 'no', 'such', 'dir', 'x.jsonl'),
            ),
        ).not.toThrow();
    });
});
