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
//
// The third group covers the aggregation an independent review caught: samples
// are keyed by (concern, event), and the row reports the MAX of the per-event
// p95s rather than the p95 of the pooled union.
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
import { writeConcernTimings } from '../../src/scripts/hooks/concern_timings.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-concern-timings-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const sink = (): string => path.join(tmp, 'timings.jsonl');

/** Samples for one concern on one event, in the nested shape `perConcernRows` takes. */
const nest = (rows: Record<string, Record<string, number[]>>): Map<string, Map<string, number[]>> =>
    new Map(Object.entries(rows).map(([c, ev]) => [c, new Map(Object.entries(ev))]));

describe('readConcernTimings', () => {
    it('groups samples by concern AND event', () => {
        const p = sink();
        fs.writeFileSync(
            p,
            [
                JSON.stringify({ concern: 'a', duration_us: 100, event: 'pre_tool_use' }),
                JSON.stringify({ concern: 'b', duration_us: 900, event: 'stop' }),
                JSON.stringify({ concern: 'a', duration_us: 300, event: 'pre_tool_use' }),
                JSON.stringify({ concern: 'a', duration_us: 700, event: 'stop' }),
            ].join('\n') + '\n',
        );
        const got = readConcernTimings(p);
        expect(got.byConcernEvent.get('a')?.get('pre_tool_use')).toEqual([100, 300]);
        // The split is the point: pooling these would produce a p95 that
        // describes neither slot.
        expect(got.byConcernEvent.get('a')?.get('stop')).toEqual([700]);
        expect(got.byConcernEvent.get('b')?.get('stop')).toEqual([900]);
        expect(got.skipped).toBe(0);
    });

    it('COUNTS the lines it skips, rather than only lowering n', () => {
        const p = sink();
        fs.writeFileSync(
            p,
            [
                'not json at all',
                JSON.stringify({ concern: 'a' }), // no duration
                JSON.stringify({ duration_us: 5 }), // no concern
                JSON.stringify({ concern: 'a', duration_us: 'slow' }), // wrong type
                '',
                JSON.stringify({ concern: 'a', duration_us: 42, event: 'pre_tool_use' }),
            ].join('\n') + '\n',
        );
        const got = readConcernTimings(p);
        expect(got.byConcernEvent.get('a')?.get('pre_tool_use')).toEqual([42]);
        // A lowered `n` shows the EFFECT of a skip; only this shows the cause.
        // The blank line is not a skip — it carries no sample and never did.
        expect(got.skipped).toBe(4);
    });

    it('files a sample with no event under `unknown` rather than dropping it', () => {
        const p = sink();
        fs.writeFileSync(p, JSON.stringify({ concern: 'a', duration_us: 11 }) + '\n');
        const got = readConcernTimings(p);
        expect(got.byConcernEvent.get('a')?.get('unknown')).toEqual([11]);
        expect(got.skipped).toBe(0);
    });

    it('returns empty for a sink that does not exist', () => {
        const got = readConcernTimings(path.join(tmp, 'absent.jsonl'));
        expect(got.byConcernEvent.size).toBe(0);
        expect(got.skipped).toBe(0);
    });
});

describe('perConcernRows — the two routes to a false zero', () => {
    const blocking = [
        { name: 'measured', fail_closed: true },
        { name: 'never-ran', fail_closed: false },
    ];

    it('route 1 — a concern with no samples is null, not 0', () => {
        const rows = perConcernRows(blocking, nest({ measured: { pre_tool_use: [500] } }));
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
        const rows = perConcernRows(blocking, nest({ measured: { pre_tool_use: [180, 190, 197] } }));
        const row = rows.find((r) => r.concern === 'measured');
        expect(row?.p95_us).toBe(197);
        expect(renderConcernRow(row!)).toContain('0.197 ms');
        expect(renderConcernRow(row!)).not.toMatch(/p95\s+0 ms/u);
    });
});

describe('perConcernRows — one number per concern, and it is the worst slot', () => {
    const one = [{ name: 'c', fail_closed: true }];

    it('reports the MAX of the per-event p95s, not the p95 of the union', () => {
        // Deliberately lopsided: 40 fast samples on one slot, 4 slow ones on
        // another. Pooled, the slow slot is below the 95th percentile and
        // vanishes; per-event, it sets the bound.
        const fast = Array.from({ length: 40 }, () => 100);
        const slow = [900, 950, 1000, 1100];
        const rows = perConcernRows(one, nest({ c: { pre_tool_use: fast, stop: slow } }));
        expect(rows[0]?.p95_us).toBe(1100);
        // Step 3.3 applies ONE timeout wherever the concern runs, so a bound
        // taken from the pooled p95 would refuse on `stop`.
        expect(rows[0]?.p95_event).toBe('stop');
        expect(rows[0]?.n).toBe(44);
        expect(renderConcernRow(rows[0]!)).toContain('worst on stop');
    });

    it('a single-slot concern is unaffected by the change', () => {
        const rows = perConcernRows(one, nest({ c: { stop: [10, 20, 30] } }));
        expect(rows[0]?.p95_us).toBe(30);
        expect(rows[0]?.p95_event).toBe('stop');
    });
});

describe('perConcernRows — the registered SLA', () => {
    const one = [{ name: 'c', fail_closed: false }];

    it('null when unregistered, a number when registered', () => {
        expect(perConcernRows(one, nest({}), {})[0]?.sla_ms).toBeNull();
        expect(perConcernRows(one, nest({}), { c: 25 })[0]?.sla_ms).toBe(25);
        // An explicit null in the budget is a REGISTERED ABSENCE and must not
        // be read as a bound of zero.
        expect(perConcernRows(one, nest({}), { c: null })[0]?.sla_ms).toBeNull();
    });

    it('a malformed budget value is LOUD, not silently not_measured', () => {
        // A typo in the budget file used to render identically to a concern
        // the bench never timed, so the error was invisible.
        const row = perConcernRows(one, nest({}), { c: 'not a number' })[0];
        expect(row?.sla_malformed).toBe(true);
        expect(renderConcernRow(row!)).toContain('MALFORMED');
        expect(renderConcernRow(row!)).not.toContain(`sla ${NOT_MEASURED}`);
        // The paired direction: the three legal states are not malformed.
        for (const v of [undefined, null, 25]) {
            expect(perConcernRows(one, nest({}), { c: v })[0]?.sla_malformed).toBe(false);
        }
    });
});

describe('renderConcernRow', () => {
    it('prints not_measured for both nulls', () => {
        const line = renderConcernRow({
            concern: 'x',
            fail_closed: false,
            n: 0,
            p95_us: null,
            p95_event: null,
            sla_ms: null,
            sla_malformed: false,
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

describe('writeConcernTimings — the dispatcher sink', () => {
    it('writes nothing when the sink is unarmed', () => {
        const p = sink();
        writeConcernTimings('pre_tool_use', 'claude', [{ concern: 'a', duration_us: 10 }], undefined);
        expect(fs.existsSync(p)).toBe(false);
    });

    it('APPENDS across calls — the property the feedback dir cannot provide', () => {
        const p = sink();
        writeConcernTimings('pre_tool_use', 'claude', [{ concern: 'a', duration_us: 10 }], p);
        writeConcernTimings('pre_tool_use', 'claude', [{ concern: 'a', duration_us: 20 }], p);
        // The feedback dir keeps one file per concern and overwrites it every
        // dispatch, so a p95 taken from it would be a p95 of one sample. This
        // assertion is the whole reason the sink is a separate mechanism.
        expect(readConcernTimings(p).byConcernEvent.get('a')?.get('pre_tool_use')).toEqual([10, 20]);
    });

    it('records the event, so the reader can key on it', () => {
        const p = sink();
        writeConcernTimings('pre_tool_use', 'claude', [{ concern: 'a', duration_us: 10 }], p);
        writeConcernTimings('stop', 'claude', [{ concern: 'a', duration_us: 90 }], p);
        const got = readConcernTimings(p).byConcernEvent.get('a');
        expect(got?.get('pre_tool_use')).toEqual([10]);
        expect(got?.get('stop')).toEqual([90]);
    });

    it('rounds the float the dispatcher hands it, without rounding it to zero', () => {
        const p = sink();
        // 0.197 ms as the dispatcher measures it — the reading that printed
        // `0 ms` before the unit changed.
        writeConcernTimings('pre_tool_use', 'claude', [{ concern: 'a', duration_us: 197.4 }], p);
        expect(readConcernTimings(p).byConcernEvent.get('a')?.get('pre_tool_use')).toEqual([197]);
    });

    it('omits a sample whose duration is not finite', () => {
        const p = sink();
        writeConcernTimings(
            'pre_tool_use',
            'claude',
            [
                { concern: 'a', duration_us: Number.NaN },
                { concern: 'b', duration_us: 7 },
            ],
            p,
        );
        const got = readConcernTimings(p);
        expect(got.byConcernEvent.has('a')).toBe(false);
        expect(got.byConcernEvent.get('b')?.get('pre_tool_use')).toEqual([7]);
    });

    it('never throws on an unwritable sink', () => {
        expect(() =>
            writeConcernTimings(
                'pre_tool_use',
                'claude',
                [{ concern: 'a', duration_us: 1 }],
                path.join(tmp, 'no', 'such', 'dir', 'x.jsonl'),
            ),
        ).not.toThrow();
    });
});
