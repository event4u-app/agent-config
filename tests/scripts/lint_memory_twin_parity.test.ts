// Tests for src/scripts/lint_memory_twin_parity.ts
// (road-to-memory-twin-reconciliation Phase 3.1).
//
// The gate's own `--self-test` proves the CLI discriminates end to end. These
// tests pin the two pure functions underneath it, because the comment stripper
// and the changed-line metric are where a silent weakening would hide: a
// stripper that swallowed a real line, or a metric that returned 0 for a real
// divergence, would make the gate green over drift and no CLI case would
// notice as long as the fixtures happened to agree.
import { describe, expect, it } from 'vitest';

import {
    changedLineCount,
    evaluate,
    loadConfig,
    stripComments,
} from '../../src/scripts/lint_memory_twin_parity.js';

const REPO = new URL('../../', import.meta.url).pathname;

describe('lint_memory_twin_parity — stripComments', () => {
    it('drops line comments, block comments and blanks', () => {
        const src = ['// a', '/* b', '   c */', '', 'const x = 1;', ' * d', 'const y = 2; // trailing'].join('\n');
        expect(stripComments(src)).toEqual(['const x = 1;', 'const y = 2; // trailing']);
    });

    it('keeps a trailing comment on a code line — the line still carries behaviour', () => {
        // Deliberate: stripping the tail would make two lines that differ only
        // in their comment compare equal, which is a WEAKER check than the one
        // this gate advertises. The header states the stripper is line-level.
        expect(stripComments('const x = 1; // why')).toEqual(['const x = 1; // why']);
    });

    it('normalises trailing whitespace so it is never a divergence', () => {
        expect(changedLineCount(stripComments('const x = 1;   \n'), stripComments('const x = 1;\n'))).toBe(0);
    });
});

describe('lint_memory_twin_parity — changedLineCount', () => {
    it('is zero for identical content', () => {
        expect(changedLineCount(['a', 'b'], ['a', 'b'])).toBe(0);
    });

    it('is zero when lines are only REORDERED — moving code is not divergence', () => {
        expect(changedLineCount(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(0);
    });

    it('counts a substitution as two changed lines, one each way', () => {
        expect(changedLineCount(['a', 'b'], ['a', 'x'])).toBe(2);
    });

    it('counts a repeated line by its multiplicity delta', () => {
        expect(changedLineCount(['a', 'a', 'a'], ['a'])).toBe(2);
    });

    it('counts a pure addition on one side', () => {
        expect(changedLineCount(['a'], ['a', 'b'])).toBe(1);
    });
});

describe('lint_memory_twin_parity — the live tree', () => {
    it('every declared twin exists on both sides and is within its verdict', () => {
        const r = evaluate(REPO);
        expect(r.findings).toEqual([]);
        expect(r.scanned).toBeGreaterThanOrEqual(7);
    });

    it('the two reconciled twins really are at EXACT parity, not merely bounded', () => {
        // The point of the reconciliation: `exact` is a stronger claim than a
        // ceiling, and this asserts the claim rather than the mode string.
        const cfg = loadConfig(REPO);
        const exact = cfg.twins.filter((t) => t.mode === 'exact').map((t) => t.file);
        expect(exact).toContain('memory_signal.ts');
        const r = evaluate(REPO);
        for (const f of exact) {
            expect(r.measurements.find((m) => m.file === f)?.measured).toBe(0);
        }
    });

    it('every twin carries a non-empty reason — a verdict without one is not a verdict', () => {
        for (const t of loadConfig(REPO).twins) {
            expect(t.reason.trim().length).toBeGreaterThan(20);
            expect(t.verdict.trim()).not.toBe('');
        }
    });

    it('every bounded twin declares a ceiling — an absent one silently means zero', () => {
        for (const t of loadConfig(REPO).twins.filter((x) => x.mode === 'bounded')) {
            expect(typeof t.max_changed_lines).toBe('number');
        }
    });
});
