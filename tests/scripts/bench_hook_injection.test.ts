import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bench } from '../../src/scripts/bench_hook_injection.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inj-bench-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('bench_hook_injection — the injection budget gate (Phase 3.2)', () => {
    it('is green on the tree against the committed budget, with a non-dead scope', () => {
        const r = bench({});
        expect(r.measurements.length).toBeGreaterThan(10); // dead-scope guard has substance
        expect(r.measurements.filter((m) => m.breach)).toEqual([]);
        expect(Object.values(r.slotSums).filter((s) => s.breach)).toEqual([]);
        // The committed fixtures deterministically trigger at least the
        // session-start emitters — a bench where NOTHING emits proves nothing.
        expect(r.measurements.filter((m) => m.bytes > 0).length).toBeGreaterThan(0);
    });

    it('is RED on a fixture budget whose cap a real emitter exceeds (a new injector cannot ship without a row)', () => {
        const budgetPath = path.join(tmp, 'budget.json');
        fs.writeFileSync(
            budgetPath,
            JSON.stringify({
                default_cap_bytes: 1, // every real emitter breaches
                per_concern_caps_bytes: {},
                per_slot_sum_caps_bytes: { session_start: 1 },
            }),
        );
        const r = bench({ budgetPath });
        expect(r.measurements.some((m) => m.breach)).toBe(true);
        expect(r.slotSums['session_start']?.breach).toBe(true);
    });
});
