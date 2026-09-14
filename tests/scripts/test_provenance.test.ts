/**
 * `road-to-adversarial-verification-and-long-runs` AC-2 — the per-test
 * independence record and the floor it has to clear.
 */
import { describe, expect, it } from 'vitest';

import {
    CRITICAL_FLOOR,
    INDEPENDENCE_LEVELS,
    criticalGaps,
    levelRank,
    parseProvenance,
} from '../../src/scripts/_lib/test_provenance.js';

const marked = (marker: string, group = 'T9 — typed ops'): string =>
    `${marker}\ndescribe('${group}', () => {\n    it('x', () => {});\n});\n`;

describe('parseProvenance', () => {
    it('reads level, criticality and evidence off the marker above a describe', () => {
        const { records, ungoverned } = parseProvenance(
            marked('// provenance: level=L4 | critical=yes | evidence=ac2-authorship-run-a'),
        );
        expect(ungoverned).toEqual([]);
        expect(records).toHaveLength(1);
        expect(records[0]?.group).toBe('T9 — typed ops');
        expect(records[0]?.level).toBe('L4');
        expect(records[0]?.critical).toBe(true);
        expect(records[0]?.evidence).toBe('ac2-authorship-run-a');
    });

    it('reports a describe with NO marker as ungoverned rather than defaulting it', () => {
        // The direction an absent record gets wrong by default. Inventing L0 for
        // an unmarked group would make "provenance is recorded per test" true by
        // construction and therefore unfalsifiable — which is the whole failure
        // this record exists against.
        const { records, ungoverned } = parseProvenance(
            "describe('T1 — unmarked', () => {});\n",
        );
        expect(records).toEqual([]);
        expect(ungoverned).toEqual(['T1 — unmarked']);
    });

    it('a marker that is not directly above the describe does not govern it', () => {
        // One blank line is fine; an intervening statement is not — otherwise a
        // marker anywhere in the file would appear to cover the next group.
        const detached =
            '// provenance: level=L4 | critical=yes | evidence=e\n' +
            'const x = 1;\n' +
            "describe('T1 — detached', () => {});\n";
        const { records, ungoverned } = parseProvenance(detached);
        expect(records).toEqual([]);
        expect(ungoverned).toEqual(['T1 — detached']);
    });

    it('rejects a level outside the vocabulary instead of accepting it', () => {
        const { records, ungoverned } = parseProvenance(
            marked('// provenance: level=L9 | critical=yes | evidence=e', 'T1 — bogus'),
        );
        expect(records).toEqual([]);
        expect(ungoverned).toEqual(['T1 — bogus']);
    });

    it('critical=no is a recorded value, not an absent one', () => {
        const { records } = parseProvenance(
            marked('// provenance: level=L0 | critical=no | evidence=', 'Phase 1.1 — prose'),
        );
        expect(records[0]?.critical).toBe(false);
        expect(records[0]?.evidence).toBe('');
    });
});

describe('levelRank', () => {
    it('orders the five levels, L0 lowest', () => {
        const ranks = INDEPENDENCE_LEVELS.map(levelRank);
        expect(ranks).toEqual([0, 1, 2, 3, 4]);
        expect(levelRank(CRITICAL_FLOOR)).toBe(3);
    });
});

describe('criticalGaps', () => {
    const rec = (over: Record<string, unknown> = {}): Parameters<typeof criticalGaps>[0][number] =>
        ({
            group: 'T9',
            level: 'L4',
            critical: true,
            evidence: 'ac2-authorship-run-a',
            line: 1,
            ...over,
        }) as Parameters<typeof criticalGaps>[0][number];

    it('a critical group at L4 with evidence clears the floor at two providers', () => {
        expect(criticalGaps([rec()], 2)).toEqual([]);
        expect(criticalGaps([rec({ level: 'L3' })], 2)).toEqual([]);
    });

    it('a critical group below the floor is a gap when two providers are configured', () => {
        for (const level of ['L0', 'L1', 'L2'] as const) {
            const gaps = criticalGaps([rec({ level })], 2);
            expect(gaps).toHaveLength(1);
            expect(gaps[0]).toContain('T9');
            expect(gaps[0]).toContain(level);
        }
    });

    it('with fewer than two providers the honest ceiling is L2, not L3', () => {
        // "Wherever two providers are configured", not always. Demanding L3 on a
        // single-provider install would demand a level that install cannot
        // reach, and a floor nobody can clear gets deleted rather than met.
        expect(criticalGaps([rec({ level: 'L2' })], 1)).toEqual([]);
        expect(criticalGaps([rec({ level: 'L1' })], 1)).toHaveLength(1);
    });

    it('an L3 or L4 claim with NO evidence is a gap, however high the level', () => {
        // An unattributed claim of independence is not one — it cannot be
        // checked for the independence it claims, which is
        // `evaluator-independence`'s own recorded failure.
        const gaps = criticalGaps([rec({ evidence: '' })], 2);
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toMatch(/evidence/);
    });

    it('a non-critical group is never a gap, at any level', () => {
        expect(criticalGaps([rec({ critical: false, level: 'L0', evidence: '' })], 2)).toEqual([]);
    });
});
