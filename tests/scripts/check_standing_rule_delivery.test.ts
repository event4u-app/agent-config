// Unit tests for the standing-rule-delivery gate
// (`check_standing_rule_delivery.ts`) — P1.2 of
// `road-to-rule-delivery-integrity`.
//
// Two pure surfaces carry the gate's honesty and both are pinned here:
//
// 1. **The budget must come from config or not at all.** A budget gate that
//    falls back to an invented ceiling certifies a number nobody chose, which is
//    the same class of failure as a gate that scans nothing. An incomplete block
//    resolves to `null` and the caller exits 2.
// 2. **A cap raise needs a stated cause.** `cap_raise_reason` exists so a
//    ceiling cannot be bumped silently; a placeholder must not satisfy it.
//
// The measured numbers themselves are not asserted here — they are per-machine
// (both layers are machine-local; `.claude/rules/` is gitignored). The live
// readings and the derivation of the 110,000 cap live in
// `agents/evidence/analysis/standing-rule-delivery-topologies.md`.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    instructionsLoadedRecord,
    readBudget,
    reasonIsStated,
} from '../../src/scripts/check_standing_rule_delivery.js';

const BLOCK = [
    'standing_rule_delivery:',
    '  # a comment line is skipped',
    '  total_cap_tokens: 110000',
    '  warn_threshold: 0.85',
    "  cap_raise_reason: 'initial cap — derived from the 2026-08-08 measurement'",
    '',
    'next_top_level_key:',
    '  total_cap_tokens: 999',
].join('\n');

describe('readBudget', () => {
    it('reads the three keys and stops at the next top-level key', () => {
        expect(readBudget(BLOCK)).toEqual({
            total_cap_tokens: 110000,
            warn_threshold: 0.85,
            cap_raise_reason: 'initial cap — derived from the 2026-08-08 measurement',
        });
    });

    it('returns null when the block is absent — never a default ceiling', () => {
        expect(readBudget('some_other_key:\n  a: 1\n')).toBeNull();
    });

    it('returns null when any required key is missing', () => {
        const partial = 'standing_rule_delivery:\n  total_cap_tokens: 110000\n';
        expect(readBudget(partial)).toBeNull();
    });

    it('returns null on a non-numeric cap rather than coercing it', () => {
        const bad = [
            'standing_rule_delivery:',
            '  total_cap_tokens: lots',
            '  warn_threshold: 0.85',
            '  cap_raise_reason: x',
        ].join('\n');
        expect(readBudget(bad)).toBeNull();
    });

    it('strips surrounding quotes from the reason', () => {
        const quoted = [
            'standing_rule_delivery:',
            '  total_cap_tokens: 1',
            '  warn_threshold: 0.5',
            '  cap_raise_reason: "quoted reason"',
        ].join('\n');
        expect(readBudget(quoted)?.cap_raise_reason).toBe('quoted reason');
    });
});

describe('reasonIsStated', () => {
    it('accepts a real sentence', () => {
        expect(reasonIsStated('raised 4k for the new tenancy rule (PR #1234)')).toBe(true);
    });

    it.each(['', ' ', '-', 'TBD', 'todo', 'N/A', 'none', 'bump'])(
        'rejects the placeholder %j',
        (placeholder) => {
            expect(reasonIsStated(placeholder)).toBe(false);
        },
    );
});

describe('the shipped budgets.yml block is complete and its reason is stated', () => {
    // The gate is not in CI (both inputs are machine-local — see the script's
    // docstring), so this test is the only automatic check that its config block
    // has not been half-edited or silently bumped.
    const text = fs.readFileSync(
        path.join(process.cwd(), 'src', 'config', 'budgets.yml'),
        'utf-8',
    );

    it('parses', () => {
        expect(readBudget(text)).not.toBeNull();
    });

    it('carries a stated cap_raise_reason', () => {
        expect(reasonIsStated(readBudget(text)!.cap_raise_reason)).toBe(true);
    });

    it('keeps the cap inside the measured band 101,247 … 176,354', () => {
        // Below the band a complete single layer would fail; above it the doubled
        // corpus would pass. Both readings are from the 2026-08-08 measurement.
        const cap = readBudget(text)!.total_cap_tokens;
        expect(cap).toBeGreaterThan(101247);
        expect(cap).toBeLessThan(176354);
    });
});

describe('instructionsLoadedRecord', () => {
    it('points at the metrics dir under the given repo root', () => {
        expect(instructionsLoadedRecord('/repo')).toBe(
            path.join('/repo', 'agents', 'runtime', 'metrics', 'instructions-loaded.jsonl'),
        );
    });
});
