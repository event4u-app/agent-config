
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    BAND_HIGH,
    BAND_LOW,
    BAND_MEDIUM,
    RISK_LOW,
    RISK_MEDIUM,
    derive_confidence_band,
    derive_risk_class,
    summarise_memory,
    summarise_verify,
} from '../../../src/agent-src/templates/scripts/work_engine/scoring/decision_trace.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

describe('scoring/decision_trace — constants', () => {
    it('band + risk constants match the contract', () => {
        expect(BAND_HIGH).toBe('high');
        expect(BAND_MEDIUM).toBe('medium');
        expect(BAND_LOW).toBe('low');
        expect(RISK_MEDIUM).toBe('medium');
        expect(RISK_LOW).toBe('low');
    });
});

describe('scoring/decision_trace — derive_confidence_band', () => {
    const cases: Array<[number, number, number, boolean, string]> = [
        [2, 1, 1, false, 'high'], // hits>=2, claims==passes, no ambiguity
        [3, 4, 4, false, 'high'],
        [2, 1, 1, true, 'medium'], // ambiguity flag drops high → medium
        [2, 2, 1, false, 'medium'], // passes != claims → medium (hits>=1)
        [2, 0, 0, false, 'medium'], // claims==0 not high; hits>=1 → medium
        [1, 0, 0, false, 'medium'], // hits>=1
        [0, 1, 1, false, 'medium'], // first_try_passes>=1
        [0, 0, 0, false, 'low'],
        [0, 5, 0, false, 'low'], // claims without passes, no hits → low
    ];
    it.each(cases)(
        'hits=%i claims=%i passes=%i amb=%s → %s',
        (memory_hits, verify_claims, verify_first_try_passes, ambiguity_flag, expected) => {
            const got = derive_confidence_band({
                memory_hits,
                verify_claims,
                verify_first_try_passes,
                ambiguity_flag,
            });
            expect(got).toBe(expected);
        },
    );
});

describe('scoring/decision_trace — derive_risk_class', () => {
    it('falsy / empty → low; non-empty list → medium', () => {
        expect(derive_risk_class(null)).toBe(RISK_LOW);
        expect(derive_risk_class([])).toBe(RISK_LOW);
        expect(derive_risk_class('')).toBe(RISK_LOW);
        expect(derive_risk_class(0)).toBe(RISK_LOW);
        expect(derive_risk_class(false)).toBe(RISK_LOW);
        expect(derive_risk_class([{ file: 'a.py' }])).toBe(RISK_MEDIUM);
        expect(derive_risk_class([{ a: 1 }, { b: 2 }])).toBe(RISK_MEDIUM);
    });
    it('non-empty string → medium (string is iterable in Python)', () => {
        expect(derive_risk_class('x')).toBe(RISK_MEDIUM);
    });
    it('non-iterable truthy (number) → low', () => {
        expect(derive_risk_class(42)).toBe(RISK_LOW);
    });
});

describe('scoring/decision_trace — summarise_memory', () => {
    it('empty / falsy memory → zeros', () => {
        expect(summarise_memory(null)).toEqual({ asks: 0, hits: 0, ids: [] });
        expect(summarise_memory([])).toEqual({ asks: 0, hits: 0, ids: [] });
    });
    it('counts asks/hits and collects ids, hit defaults True', () => {
        const memory = [
            { id: 'a', asks: 2 },
            { rule_id: 'b' }, // hit defaults True, asks defaults 1
            { id: 'c', hit: false }, // not a hit
            'not-a-dict', // skipped
            { id: 'd', asks: 0 }, // asks=0 → `or 1` → counts 1
        ];
        // asks: 2 + 1 + 1 + 1(d) = 5 (only over dict entries that pass; the
        // skipped non-dict adds nothing). hit=false entry still adds its asks.
        const got = summarise_memory(memory);
        // hits = a, b, d (c has hit:false → not a hit). a, b, d all carry an
        // id/rule_id so all three land in ids, in retrieval order.
        expect(got).toEqual({ asks: 5, hits: 3, ids: ['a', 'b', 'd'] });
    });
    it('respects the ids limit', () => {
        const memory = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}` }));
        const got = summarise_memory(memory, { limit: 3 }) as { ids: string[]; hits: number };
        expect(got.ids).toEqual(['r0', 'r1', 'r2']);
        expect(got.hits).toBe(40);
    });
});

describe('scoring/decision_trace — summarise_verify', () => {
    it('null → zeros', () => {
        expect(summarise_verify(null)).toEqual({ claims: 0, first_try_passes: 0 });
    });
    it('dict form', () => {
        expect(summarise_verify({ claims: 3, first_try_passes: 2 })).toEqual({
            claims: 3,
            first_try_passes: 2,
        });
        expect(summarise_verify({})).toEqual({ claims: 0, first_try_passes: 0 });
    });
    it('list form counts first_try_pass', () => {
        const verify = [{ first_try_pass: true }, { first_try_pass: false }, { x: 1 }, 'skip'];
        expect(summarise_verify(verify)).toEqual({ claims: 4, first_try_passes: 1 });
    });
    it('unknown shape → zeros', () => {
        expect(summarise_verify(42)).toEqual({ claims: 0, first_try_passes: 0 });
        expect(summarise_verify('x')).toEqual({ claims: 0, first_try_passes: 0 });
    });
});
