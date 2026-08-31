/**
 * Tests for the pathology archive (`src/scripts/_lib/pathology_archive.ts`,
 * road-to-governed-harness-evolution step 4.4).
 *
 * The step states its verify clause as two observable facts — "two candidates
 * with equal vectors but different pathology cells are both retained, and a
 * diversity-collapse stop reads the archive" — so those two are the
 * load-bearing tests here. Everything else exists because the council of
 * 2026-08-31 ruled the archive cannot be built until ranking, tie-break and
 * replacement are TOTAL, and a rule is only total if its tie-breaks are
 * reachable. Each one is exercised in isolation below.
 */
import { describe, expect, it } from 'vitest';

import { LADDER_RUNGS } from '../../src/scripts/_lib/activation_ladder.js';
import {
    ARCHIVE_SCHEMA_VERSION,
    CLASSIFICATION_RULE_VERSION,
    PATHOLOGY_DOMINANCE_THRESHOLD,
    PATHOLOGY_MIN_CLASSIFIABLE_ATTEMPTS,
    PATHOLOGY_WHERE,
    PATHOLOGY_WHY,
    PATHOLOGY_WINDOW_SIZE,
    PathologyArchive,
    PathologyArchiveError,
    RANKING_RULE_VERSION,
    cellKey,
    dominanceVerdict,
    replacesRetained,
    type PathologyAttempt,
    type PathologyWhere,
    type PathologyWhy,
} from '../../src/scripts/_lib/pathology_archive.js';

let seq = 0;
function attempt(over: Partial<PathologyAttempt> = {}): PathologyAttempt {
    seq += 1;
    return {
        attempt_id: `a${seq}`,
        attempt_sequence: seq,
        candidate_id: `c${seq}`,
        intervention_ref: `i${seq}`,
        where: 'delivered',
        why: 'execution_failed',
        reason_detail: '',
        classification_status: 'classified',
        validation_status: 'valid',
        observed_at: '2026-08-31T00:00:00Z',
        archive_schema_version: ARCHIVE_SCHEMA_VERSION,
        classification_rule_version: CLASSIFICATION_RULE_VERSION,
        ranking_rule_version: RANKING_RULE_VERSION,
        cohort_id: 'cohort-a',
        cohort_version: 1,
        ...over,
    };
}

describe('closed vocabularies', () => {
    it('WHERE reuses the activation ladder rather than inventing a taxonomy', () => {
        // The council warned a parallel execution-stage taxonomy must not be
        // invented if the ladder already defines the semantics. It does.
        expect([...PATHOLOGY_WHERE]).toEqual([...LADDER_RUNGS]);
        expect(PATHOLOGY_WHERE).toHaveLength(6);
    });

    it('WHY is a closed reason axis and does not restate WHERE', () => {
        expect(PATHOLOGY_WHY).toHaveLength(8);
        // The failure mode this pins: names like `projection_failed` /
        // `delivery_failed` collapse the two axes into one.
        for (const rung of LADDER_RUNGS) {
            expect(PATHOLOGY_WHY as readonly string[]).not.toContain(`${rung}_failed`);
            expect(PATHOLOGY_WHY as readonly string[]).not.toContain(rung);
        }
    });

    it('reason_unknown is last, so it is a fallback and never a precedence winner', () => {
        expect(PATHOLOGY_WHY[PATHOLOGY_WHY.length - 1]).toBe('reason_unknown');
    });

    it('an out-of-vocabulary value is refused on both axes', () => {
        const ar = new PathologyArchive();
        expect(() => ar.ingest(attempt({ where: 'nowhere' as PathologyWhere }))).toThrow(
            PathologyArchiveError,
        );
        expect(() => ar.ingest(attempt({ why: 'vibes' as PathologyWhy }))).toThrow(
            PathologyArchiveError,
        );
    });
});

describe('the verify clause — different cells are both retained', () => {
    it('two candidates with equal vectors but different cells are BOTH retained', () => {
        const ar = new PathologyArchive();
        // "Equal vectors" is the premise: nothing here distinguishes them
        // except the pathology cell. A pure frontier would keep one.
        ar.ingest(
            attempt({
                attempt_id: 'x1',
                candidate_id: 'same-vector',
                where: 'projected',
                why: 'dependency_unavailable',
            }),
        );
        ar.ingest(
            attempt({
                attempt_id: 'x2',
                candidate_id: 'same-vector',
                where: 'adhered',
                why: 'output_contract_violated',
            }),
        );
        const cells = ar.cells();
        expect(cells).toHaveLength(2);
        expect(cells.map((c) => cellKey(c.where, c.why)).sort()).toEqual([
            'adhered output_contract_violated',
            'projected dependency_unavailable',
        ]);
        for (const c of cells) expect(c.retained_attempt_id).not.toBeNull();
    });

    it('same WHERE, different WHY is TWO cells — the WHY axis is load-bearing', () => {
        // Without this, keying the cell on WHERE alone passes every other test
        // in this file: the "both retained" case above differs on both axes, so
        // it cannot tell a two-axis key from a one-axis one. Observed 2026-08-31
        // by deleting `a.why` from the cell key and watching 23/23 stay green.
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'w1', where: 'delivered', why: 'policy_blocked' }));
        ar.ingest(attempt({ attempt_id: 'w2', where: 'delivered', why: 'evidence_missing' }));
        expect(ar.cells()).toHaveLength(2);
    });

    it('same WHY, different WHERE is TWO cells — the WHERE axis is load-bearing', () => {
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'v1', where: 'selected', why: 'policy_blocked' }));
        ar.ingest(attempt({ attempt_id: 'v2', where: 'visible', why: 'policy_blocked' }));
        expect(ar.cells()).toHaveLength(2);
    });

    it('two attempts in the SAME cell collapse to one representative', () => {
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'y1', attempt_sequence: 10 }));
        ar.ingest(attempt({ attempt_id: 'y2', attempt_sequence: 11 }));
        const cells = ar.cells();
        expect(cells).toHaveLength(1);
        expect(cells[0]!.attempt_count).toBe(2);
        expect(cells[0]!.retained_attempt_id).toBe('y2');
    });
});

describe('the ranking rule is TOTAL — every tie-break is reachable', () => {
    it('ranks by attempt_sequence', () => {
        const lo = attempt({ attempt_sequence: 1 });
        const hi = attempt({ attempt_sequence: 2 });
        expect(replacesRetained(hi, lo)).toBe(true);
        expect(replacesRetained(lo, hi)).toBe(false);
    });

    it('tie-breaks on candidate_id when sequences collide', () => {
        const a = attempt({ attempt_sequence: 7, candidate_id: 'aaa' });
        const b = attempt({ attempt_sequence: 7, candidate_id: 'bbb' });
        expect(replacesRetained(a, b)).toBe(true);
        expect(replacesRetained(b, a)).toBe(false);
    });

    it('tie-breaks on attempt_id when sequence AND candidate_id collide', () => {
        const a = attempt({ attempt_sequence: 7, candidate_id: 'same', attempt_id: 'aaa' });
        const b = attempt({ attempt_sequence: 7, candidate_id: 'same', attempt_id: 'bbb' });
        expect(replacesRetained(a, b)).toBe(true);
        expect(replacesRetained(b, a)).toBe(false);
    });

    it('ordering never consults observed_at — producer clocks do not decide', () => {
        // A newer timestamp on a lower sequence must NOT win.
        const older = attempt({ attempt_sequence: 9, observed_at: '2020-01-01T00:00:00Z' });
        const newerClock = attempt({ attempt_sequence: 8, observed_at: '2099-01-01T00:00:00Z' });
        expect(replacesRetained(newerClock, older)).toBe(false);
    });

    it('an invalid or unclassifiable attempt can never become the representative', () => {
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'good', attempt_sequence: 1 }));
        ar.ingest(attempt({ attempt_id: 'bad', attempt_sequence: 99, validation_status: 'invalid' }));
        ar.ingest(
            attempt({
                attempt_id: 'murky',
                attempt_sequence: 98,
                classification_status: 'unclassifiable',
            }),
        );
        const cell = ar.cells()[0]!;
        expect(cell.retained_attempt_id).toBe('good');
        expect(cell.attempt_count).toBe(3);
        expect(cell.unclassifiable_count).toBe(1);
    });
});

describe('append-only and idempotent', () => {
    it('re-ingesting an attempt_id is a no-op and cannot inflate counts', () => {
        const ar = new PathologyArchive();
        const a = attempt({ attempt_id: 'dupe' });
        expect(ar.ingest(a)).toBe(true);
        expect(ar.ingest(a)).toBe(false);
        expect(ar.ingest({ ...a, candidate_id: 'sneaky' })).toBe(false);
        expect(ar.cells()[0]!.attempt_count).toBe(1);
        expect(ar.cells()[0]!.retained_candidate_id).not.toBe('sneaky');
    });

    it('a different classification_rule_version does not merge into the same cell', () => {
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'v1' }));
        ar.ingest(attempt({ attempt_id: 'v2', classification_rule_version: 2 }));
        // Same WHERE x WHY, different vocabulary version: summing them would
        // add counts described by two different enums.
        expect(ar.cells()).toHaveLength(2);
    });

    it('every cell carries the frequency-bearing metadata the guard needs', () => {
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'm1', attempt_sequence: 3 }));
        ar.ingest(attempt({ attempt_id: 'm2', attempt_sequence: 5 }));
        const c = ar.cells()[0]!;
        // Occupancy alone cannot tell 50/50 from 99.9/0.1 — these fields can.
        expect(c.attempt_count).toBe(2);
        expect(c.classifiable_count).toBe(2);
        expect(c.first_observed_attempt_sequence).toBe(3);
        expect(c.last_observed_attempt_sequence).toBe(5);
        expect(c.retained_ranking_rule).toMatch(/attempt_sequence DESC/);
        expect(c.retained_ranking_key).toBe('5|' + c.retained_candidate_id + '|m2');
        expect(c.archive_schema_version).toBe(ARCHIVE_SCHEMA_VERSION);
    });
});

describe('the diversity-collapse stop reads the archive', () => {
    function fill(n: number, where: PathologyWhere, why: PathologyWhy, from = 0): PathologyAttempt[] {
        return Array.from({ length: n }, (_, i) =>
            attempt({ attempt_id: `f${where}${why}${from + i}`, attempt_sequence: from + i, where, why }),
        );
    }

    /**
     * The guard is reached through the ARCHIVE, never through a raw array.
     * That is the point of the rewiring: `dominanceVerdict` takes a versioned
     * query, so a caller cannot hand it storage internals and get a verdict.
     */
    function verdictOf(rows: readonly PathologyAttempt[]) {
        const ar = new PathologyArchive();
        for (const r of rows) ar.ingest(r);
        return ar.collapseVerdict();
    }

    it('below the minimum sample it reports warming-up, which is NOT a pass', () => {
        const v = verdictOf(fill(3, 'delivered', 'execution_failed'));
        expect(v.status).toBe('warming-up');
        // The failure this pins: a guard that says "ok" on three observations.
        expect(v.status).not.toBe('ok');
    });

    it('a collapsed search trips the stop', () => {
        const attempts = [
            ...fill(24, 'delivered', 'execution_failed', 0),
            ...fill(6, 'adhered', 'policy_blocked', 100),
        ];
        const v = verdictOf(attempts);
        expect(v.status).toBe('collapsed');
        if (v.status === 'collapsed') {
            expect(v.dominant_share).toBeGreaterThanOrEqual(PATHOLOGY_DOMINANCE_THRESHOLD);
            expect(v.dominant_cell).toBe('delivered x execution_failed');
        }
    });

    it('a diverse search does not trip the stop', () => {
        const attempts = [
            ...fill(10, 'delivered', 'execution_failed', 0),
            ...fill(10, 'adhered', 'policy_blocked', 100),
            ...fill(10, 'projected', 'dependency_unavailable', 200),
        ];
        const v = verdictOf(attempts);
        expect(v.status).toBe('ok');
        if (v.status === 'ok') expect(v.dominant_share).toBeLessThan(PATHOLOGY_DOMINANCE_THRESHOLD);
    });

    it('unclassifiable attempts are excluded from the denominator', () => {
        // 24 in one cell + 30 unclassifiable. Counting the unclassifiable ones
        // would put the share at 24/54 = 0.44 and hide a real collapse.
        const attempts = [
            ...fill(24, 'delivered', 'execution_failed', 0),
            ...Array.from({ length: 30 }, (_, i) =>
                attempt({
                    attempt_id: `u${i}`,
                    attempt_sequence: 500 + i,
                    classification_status: 'unclassifiable',
                }),
            ),
        ];
        const v = verdictOf(attempts);
        expect(v.status).toBe('collapsed');
        if (v.status === 'collapsed') expect(v.classifiable_in_window).toBe(24);
    });

    it('the window is the LATEST N classifiable attempts, so old collapse ages out', () => {
        const attempts = [
            ...fill(50, 'delivered', 'execution_failed', 0),
            ...fill(25, 'adhered', 'policy_blocked', 100),
            ...fill(25, 'projected', 'evidence_missing', 200),
        ];
        const v = verdictOf(attempts);
        expect(v.status).toBe('ok');
        if (v.status === 'ok') expect(v.classifiable_in_window).toBe(PATHOLOGY_WINDOW_SIZE);
    });

    it('the constants are the ones the module publishes', () => {
        expect(PATHOLOGY_DOMINANCE_THRESHOLD).toBe(0.6);
        expect(PATHOLOGY_WINDOW_SIZE).toBe(50);
        expect(PATHOLOGY_MIN_CLASSIFIABLE_ATTEMPTS).toBe(20);
    });
});

describe('the guard consumes a versioned query, not storage internals', () => {
    it('the window query carries the version quad with its rows', () => {
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'q1' }));
        const q = ar.dominanceWindow();
        expect(q.archive_schema_version).toBe(ARCHIVE_SCHEMA_VERSION);
        expect(q.classification_rule_version).toBe(CLASSIFICATION_RULE_VERSION);
        expect(q.window_size).toBe(PATHOLOGY_WINDOW_SIZE);
        expect(q.rows).toHaveLength(1);
    });

    it('the query excludes unclassifiable rows and reports how many it dropped', () => {
        const ar = new PathologyArchive();
        ar.ingest(attempt({ attempt_id: 'ok1' }));
        ar.ingest(attempt({ attempt_id: 'no1', classification_status: 'unclassifiable' }));
        ar.ingest(attempt({ attempt_id: 'no2', classification_status: 'unclassifiable' }));
        const q = ar.dominanceWindow();
        expect(q.rows).toHaveLength(1);
        expect(q.unclassifiable_excluded).toBe(2);
    });

    it('collapseVerdict is the archive-side entry point and agrees with the query', () => {
        const ar = new PathologyArchive();
        for (let i = 0; i < 24; i += 1) {
            ar.ingest(attempt({ attempt_id: `z${i}`, attempt_sequence: i }));
        }
        expect(ar.collapseVerdict()).toEqual(dominanceVerdict(ar.dominanceWindow()));
    });
});

describe('the stop condition is wired, not an unwired library', () => {
    it('STOP_CONDITIONS names this guard, and the name resolves to a real export', async () => {
        // AC-3 and AC-5 on this roadmap are both open because their modules
        // have no production caller. A guard nobody registers has the same
        // problem, so the registration is asserted rather than assumed.
        const guards = await import('../../src/scripts/_lib/harness_evolution_guards.js');
        const mod = await import('../../src/scripts/_lib/pathology_archive.js');
        const row = guards.STOP_CONDITIONS.find((c) => c.id === 'pathology-dominance');
        expect(row).toBeDefined();
        expect(row!.detector).toBe('dominanceVerdict');
        expect(typeof (mod as Record<string, unknown>)[row!.detector!]).toBe('function');
    });

    it('it is a SECOND condition, not a replacement for diversity-collapse', () => {
        // Deleting the older one would silently drop the distinct-count check.
        return import('../../src/scripts/_lib/harness_evolution_guards.js').then((g) => {
            const ids = g.STOP_CONDITIONS.map((c) => c.id);
            expect(ids).toContain('diversity-collapse');
            expect(ids).toContain('pathology-dominance');
        });
    });
});
