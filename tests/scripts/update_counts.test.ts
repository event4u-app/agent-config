// Tests for src/scripts/update_counts.ts (py2ts Phase 5).
//
// Two layers:
//   1. 1:1 port of tests/test_update_counts.py — apply_to_text substitutions /
//      drift detection, count() against the real tree, the TARGETS regression
//      guard, and the --check end-to-end on a clean tree.
//   2. Golden parity on the REAL REPO: python3 --check and tsx --check produce
//      byte-identical stdout/stderr/exit; tsx update mode leaves README /
//      getting-started / architecture with ZERO drift (the repo is in-sync).
//      Skipped when python3 is absent.
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as uc from '../../src/scripts/update_counts.js';


afterEach(() => {
    vi.restoreAllMocks();
});

// Suppress the stderr warning apply_to_text emits on a missed pattern (the
// unittest test_missing_pattern_does_not_crash expects no crash, not silence).
function withSilentStderr<T>(fn: () => T): T {
    const se = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
        return fn();
    } finally {
        se.mockRestore();
    }
}

// --- Layer 1: ported behavioural spec (apply_to_text) -----------------------

describe('update_counts.apply_to_text — ported from pytest', () => {
    it('replaces single number in match', () => {
        const text = 'Browse all 54 commands] today.';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toContain('Browse all 57 commands]');
        expect(drifts).toEqual([['commands', 54, 57]]);
    });

    it('no drift when number matches', () => {
        const text = 'Browse all 57 commands].';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toBe(text);
        expect(drifts).toEqual([]);
    });

    it('missing pattern does not crash', () => {
        const text = 'unrelated content';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = withSilentStderr(() => uc.apply_to_text(text, patterns, counts));
        expect(newText).toBe(text);
        expect(drifts).toEqual([]);
    });

    it('multiple patterns applied independently', () => {
        const text = 'Has 100 skills and 54 commands.';
        const counts = { skills: 112, commands: 57 };
        const patterns: Array<[string, string]> = [
            ['(Has )(\\d+)( skills)', 'skills'],
            ['(and )(\\d+)( commands)', 'commands'],
        ];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toContain('Has 112 skills');
        expect(newText).toContain('and 57 commands');
        const sorted = (d: Array<[string, number, number]>): Array<[string, number, number]> =>
            [...d].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        expect(sorted(drifts)).toEqual(
            sorted([
                ['skills', 100, 112],
                ['commands', 54, 57],
            ]),
        );
    });

    it('same pattern multiple matches all updated', () => {
        const text = 'Browse all 54 commands] and Browse all 54 commands] later.';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect((newText.match(/Browse all 57 commands\]/g) ?? []).length).toBe(2);
        expect(drifts.length).toBe(2);
    });
});

describe('update_counts.count — sanity against the real tree', () => {
    it('skills non-zero', () => {
        expect(uc.count('skills')).toBeGreaterThan(0);
    });
    it('rules non-zero', () => {
        expect(uc.count('rules')).toBeGreaterThan(0);
    });
    it('commands non-zero', () => {
        expect(uc.count('commands')).toBeGreaterThan(0);
    });
    it('guidelines counts nested', () => {
        expect(uc.count('guidelines')).toBeGreaterThan(0);
    });
    it('personas non-zero', () => {
        expect(uc.count('personas')).toBeGreaterThan(0);
    });
});

// `road-to-surfaces-no-gate-reads` Phase 1. The README sub-note carries four
// figures in prose, and three of them had no owner: at the base it said
// "Rules 121" against 122 source rules and "projection holds 120" against 121.
// The Commands half the audit reported was already correct, which is the point
// — a hand-typed figure is right until it is not, and nothing says when.
describe('update_counts — the README sub-note figures, 1.1', () => {
    it('counts top-level command files, non-recursively', () => {
        const top = uc.count('commands_toplevel');
        expect(top).toBeGreaterThan(0);
        // Non-recursive is the whole claim: the sub-note exists to explain why
        // the badge and the linked directory differ, so a recursive count here
        // would make the sentence explain nothing.
        expect(top).toBeLessThan(uc.count('commands_active'));
    });

    it('counts projected rules, which is not the source count', () => {
        const projected = uc.count('rules_projected');
        expect(projected).toBeGreaterThan(0);
        // A dormant rule is not projected, so the projection is at most the
        // source count — and the sub-note's job is to say so with real numbers.
        expect(projected).toBeLessThanOrEqual(uc.count('rules'));
    });

    it('the README entry carries a pattern for each of the four figures', () => {
        const readme = uc.TARGETS.find(([rel]) => rel === 'README.md');
        expect(readme).toBeDefined();
        const kinds = (readme as [string, ReadonlyArray<[string, string]>])[1].map(([, kind]) => kind);
        for (const kind of ['commands_active', 'commands_toplevel', 'rules', 'rules_projected']) {
            expect(kinds).toContain(kind);
        }
    });

    it('a stale sub-note figure is a drift, not a silent pass', () => {
        const stale =
            '**Commands 205** counts every command file **recursively** (the linked directory ' +
            'holds 60 at its top level), and **Rules 999** counts the **source** rules while the ' +
            'linked projection holds 998 — one rule is dormant and is not projected.';
        const readme = uc.TARGETS.find(([rel]) => rel === 'README.md') as [
            string,
            ReadonlyArray<[string, string]>,
        ];
        const counts = { commands_active: 205, commands_toplevel: 60, rules: 122, rules_projected: 121 };
        const [fixed, drifts] = withSilentStderr(() =>
            uc.apply_to_text(stale, readme[1] as Array<[string, string]>, counts),
        );
        expect(drifts.map(([kind]) => kind).sort()).toEqual(['rules', 'rules_projected']);
        expect(fixed).toContain('**Rules 122**');
        expect(fixed).toContain('projection holds 121');
        // The halves that were already right are left exactly as they were.
        expect(fixed).toContain('**Commands 205**');
        expect(fixed).toContain('holds 60 at its top level');
    });
});

describe('update_counts.apply_to_text — a kind with no count is refused', () => {
    it('never writes the literal `undefined` into a target', () => {
        // Measured 2026-10-12 while adding the sub-note patterns: two new
        // patterns whose kinds were not in KINDS rewrote the README to "holds
        // undefined at its top level", and `--check` then reported "All counts
        // in sync" because the pattern no longer matched its own output. A
        // generator that can corrupt the file it maintains, and then call the
        // corruption clean, is worse than one that does nothing.
        const text = 'the directory holds 60 at its top level';
        const patterns: Array<[string, string]> = [['(holds )(\\d+)( at its top level)', 'nonexistent_kind']];
        const [out, drifts] = withSilentStderr(() => uc.apply_to_text(text, patterns, { rules: 122 }));
        expect(out).toBe(text);
        expect(out).not.toContain('undefined');
        expect(drifts).toEqual([]);
    });

    it('every kind named in TARGETS has a count', () => {
        // The structural version of the same defect: this fails when a pattern
        // is added without its kind, instead of the README finding out.
        const counts: Record<string, number> = {};
        for (const kind of uc.KINDS) counts[kind] = uc.count(kind);
        for (const [, patterns] of uc.TARGETS) {
            for (const [, kind] of patterns) {
                expect(typeof counts[kind], `kind "${kind}" is in TARGETS but not in KINDS`).toBe('number');
            }
        }
    });
});

describe('update_counts.TARGETS — regression guard', () => {
    it('stronger-skills baseline is not tracked', () => {
        const paths = uc.TARGETS.map(([rel]) => rel);
        expect(paths).not.toContain('agents/roadmaps/road-to-stronger-skills.md');
        expect(paths).not.toContain('agents/roadmaps/skipped/road-to-stronger-skills.md');
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

