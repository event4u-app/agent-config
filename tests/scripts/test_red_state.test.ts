// `road-to-evidence-gated-change` step 4.1 — the durable RED-run record.
//
// The record exists so that "a relevant test was observed failing" stops being a
// claim nobody can check. `assurance-capability-registry.json` named its own exit
// condition — "a durable RED-run identifier is emitted somewhere a later reader
// can check" — and these tests are what make that emission trustworthy.
//
// The invalid-class half is the load-bearing half. A store that accepted a
// broken fixture as a RED would let a production edit through on a failure that
// was never about the behaviour under test, which is precisely the thing the TDD
// skill's Test-Red row rejects.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    RED_FAILURE_CLASSES,
    TEST_RESULTS_REL,
    VALID_RED_CLASSES,
    isValidRed,
    latestValidRed,
    readState,
    recordRed,
    runId,
} from '../../src/scripts/_lib/test_red_state.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'red-state-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the valid/invalid split is the whole point', () => {
    it.each(['assertion', 'missing-target', 'contract'] as const)('%s is a valid RED', (cls) => {
        expect(isValidRed(cls)).toBe(true);
    });

    it.each([
        'broken-fixture',
        'test-syntax-error',
        'missing-unrelated-dependency',
        'runner-fault',
    ] as const)('%s is NOT a valid RED', (cls) => {
        expect(isValidRed(cls)).toBe(false);
    });

    it('the two sets partition the union — no class is unclassified', () => {
        const valid = new Set<string>(VALID_RED_CLASSES);
        for (const c of RED_FAILURE_CLASSES) {
            expect(typeof isValidRed(c)).toBe('boolean');
        }
        expect(valid.size).toBe(3);
        expect(RED_FAILURE_CLASSES.length).toBe(7);
    });

    it('`missing-target` is valid — the case the pre-4.1 contract rejected', () => {
        // A class that does not exist yet cannot fail an assertion. An
        // assertion-only RED contract is unsatisfiable for it, which is the
        // defect Phase 2 names and this class answers.
        expect(isValidRed('missing-target')).toBe(true);
    });
});

describe('recordRed', () => {
    it('writes the record and marks a valid red', () => {
        const run = recordRed(tmp, 'tests/foo.test.ts', 'assertion', { now: '2026-08-26T00:00:00.000Z' });
        expect(run.valid_red).toBe(true);
        expect(run.run_id).toMatch(/^[0-9a-f]{12}$/);
        const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, TEST_RESULTS_REL), 'utf8')) as {
            schema: number;
            runs: unknown[];
        };
        expect(onDisk.schema).toBe(1);
        expect(onDisk.runs).toHaveLength(1);
    });

    it('records an INVALID class too, marked invalid rather than dropped', () => {
        // Dropping it would lose the fact that a run happened and produced a
        // harness failure — which is exactly what a later reader needs to know.
        const run = recordRed(tmp, 'tests/foo.test.ts', 'broken-fixture');
        expect(run.valid_red).toBe(false);
        expect(readState(tmp).runs).toHaveLength(1);
    });

    it('appends newest-first and bounds the file at 200', () => {
        for (let i = 0; i < 205; i++) {
            recordRed(tmp, `t${String(i)}`, 'assertion', { now: `2026-08-26T00:00:${String(i % 60).padStart(2, '0')}.000Z` });
        }
        const runs = readState(tmp).runs;
        expect(runs).toHaveLength(200);
        expect(runs[0]!.target).toBe('t204');
    });

    it('trims an over-long detail rather than storing it whole', () => {
        const run = recordRed(tmp, 't', 'assertion', { detail: 'x'.repeat(900) });
        expect(run.detail).toHaveLength(400);
    });
});

describe('readState is failure-tolerant — advisory state must not break its reader', () => {
    it('an absent file reads as empty', () => {
        expect(readState(tmp)).toEqual({ schema: 1, runs: [] });
    });

    it('a CORRUPT file reads as empty rather than throwing', () => {
        const p = path.join(tmp, TEST_RESULTS_REL);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, '{ not json', 'utf8');
        expect(() => readState(tmp)).not.toThrow();
        expect(readState(tmp).runs).toEqual([]);
    });

    it('a wrong schema reads as empty', () => {
        const p = path.join(tmp, TEST_RESULTS_REL);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify({ schema: 99, runs: [{ target: 'x' }] }), 'utf8');
        expect(readState(tmp).runs).toEqual([]);
    });
});

describe('latestValidRed — exact match, deliberately not fuzzy', () => {
    it('finds the newest valid red for the target', () => {
        recordRed(tmp, 'a', 'assertion', { now: '2026-08-26T00:00:00.000Z' });
        recordRed(tmp, 'a', 'contract', { now: '2026-08-26T00:00:01.000Z' });
        expect(latestValidRed(tmp, 'a')?.failure_class).toBe('contract');
    });

    it('IGNORES an invalid-class run for the same target', () => {
        recordRed(tmp, 'a', 'assertion', { now: '2026-08-26T00:00:00.000Z' });
        recordRed(tmp, 'a', 'runner-fault', { now: '2026-08-26T00:00:01.000Z' });
        // The newest run is a harness fault. The newest VALID red is the older
        // assertion, and that is what a guard must see.
        expect(latestValidRed(tmp, 'a')?.failure_class).toBe('assertion');
    });

    it('does NOT match a near-miss target', () => {
        // A fuzzy match would clear a production edit on a red observed for a
        // different behaviour — the failure the guard exists to catch.
        recordRed(tmp, 'tests/foo.test.ts', 'assertion');
        expect(latestValidRed(tmp, 'tests/foo.test.ts.bak')).toBeNull();
        expect(latestValidRed(tmp, 'tests/foo')).toBeNull();
    });

    it('returns null when only invalid reds exist', () => {
        recordRed(tmp, 'a', 'broken-fixture');
        expect(latestValidRed(tmp, 'a')).toBeNull();
    });
});

describe('runId', () => {
    it('is stable for the same inputs and differs on any change', () => {
        const a = runId('t', 'assertion', '2026-08-26T00:00:00.000Z');
        expect(runId('t', 'assertion', '2026-08-26T00:00:00.000Z')).toBe(a);
        expect(runId('t', 'contract', '2026-08-26T00:00:00.000Z')).not.toBe(a);
        expect(runId('u', 'assertion', '2026-08-26T00:00:00.000Z')).not.toBe(a);
        expect(runId('t', 'assertion', '2026-08-26T00:00:01.000Z')).not.toBe(a);
    });

    it('carries no path from the producing machine', () => {
        expect(runId('/Users/someone/repo/tests/x.ts', 'assertion', 'now')).not.toContain('/');
    });
});
