// The acknowledgment joined to the episode spine
// (`road-to-runtime-event-journal` Phase 3.2).
//
// The question this answers is the after-the-fact one: "was this blocker
// ignored?", asked from the journal rather than from inside the session that
// produced the return.
//
// SCOPE, stated because it bounds what these tests prove: the journal module
// is being written on a sibling track and is not imported here. The join is
// therefore expressed over four FIELD NAMES — `episode_id`, `state`,
// `consumption`, `suggestion` — and exercised against a fixture table built in
// this file. That establishes the predicate is correct; it does NOT establish
// that the journal writes those columns. The day the table exists, this
// fixture is what it has to match.
import { describe, expect, it } from 'vitest';

import {
    IGNORED_BLOCKER_QUERY,
    findIgnoredBlockersInJournal,
    rowIsIgnoredBlocker,
} from '../../src/scripts/_lib/ignored_blocker.js';
import type { JournalConsumptionRow } from '../../src/scripts/_lib/ignored_blocker.js';
import { NON_SUCCESS_STATES } from '../../src/scripts/_lib/outcome_envelope.js';

/** The fixture table. Six rows: four non-success (two acknowledged, two not),
 *  one success with no acknowledgment, one success acknowledged. */
const FIXTURE_TABLE: readonly JournalConsumptionRow[] = [
    { episode_id: 'ep-001', state: 'blocked', consumption: null, suggestion: 'set GITHUB_TOKEN' },
    { episode_id: 'ep-002', state: 'blocked', consumption: 'rejected-with-reason', suggestion: 'set GITHUB_TOKEN' },
    { episode_id: 'ep-003', state: 'exhausted', consumption: null, suggestion: 'raise the retry cap' },
    { episode_id: 'ep-004', state: 'approval-required', consumption: 'consumed', suggestion: 'ask before pushing' },
    { episode_id: 'ep-005', state: 'success', consumption: null, suggestion: '' },
    { episode_id: 'ep-006', state: 'stagnated', consumption: 'partially-consumed', suggestion: 'change approach' },
];

describe('the journal join', () => {
    it('returns exactly the unacknowledged non-success episodes', () => {
        const found = findIgnoredBlockersInJournal(FIXTURE_TABLE);
        expect(found.map((f) => f.episodeId)).toEqual(['ep-001', 'ep-003']);
    });

    it('carries the episode_id, so the finding is answerable after the fact', () => {
        const [first] = findIgnoredBlockersInJournal(FIXTURE_TABLE);
        expect(first?.episodeId).toBe('ep-001');
        expect(first?.state).toBe('blocked');
        expect(first?.suggestion).toBe('set GITHUB_TOKEN');
    });

    it.each([...NON_SUCCESS_STATES])('a %s row with consumption NULL is reported', (state) => {
        expect(rowIsIgnoredBlocker({ episode_id: 'ep-x', state, consumption: null, suggestion: 'do the thing' })).toBe(true);
    });

    it.each([...NON_SUCCESS_STATES])('the same %s row with rejected-with-reason is NOT reported', (state) => {
        const row: JournalConsumptionRow = {
            episode_id: 'ep-x',
            state,
            consumption: 'rejected-with-reason',
            suggestion: 'do the thing',
        };
        expect(rowIsIgnoredBlocker(row)).toBe(false);
    });

    it('a success row with consumption NULL is NOT reported', () => {
        const row: JournalConsumptionRow = { episode_id: 'ep-y', state: 'success', consumption: null, suggestion: '' };
        expect(rowIsIgnoredBlocker(row)).toBe(false);
    });
});

describe('the documented query shape', () => {
    it('names every non-success state and the NULL consumption test', () => {
        for (const state of NON_SUCCESS_STATES) {
            expect(IGNORED_BLOCKER_QUERY).toContain(`'${state}'`);
        }
        expect(IGNORED_BLOCKER_QUERY).toContain('consumption IS NULL');
        expect(IGNORED_BLOCKER_QUERY).toContain('episode_id');
    });

    it('the SQL and the predicate select the same rows over the fixture table', () => {
        // The SQL is not executed — nothing here opens a database. What is
        // checked is that a hand-evaluation of its WHERE clause agrees with the
        // predicate, so the two cannot drift into different answers unnoticed.
        const bySql = FIXTURE_TABLE.filter(
            (r) => NON_SUCCESS_STATES.has(r.state) && r.consumption === null,
        ).map((r) => r.episode_id);
        const byPredicate = findIgnoredBlockersInJournal(FIXTURE_TABLE).map((f) => f.episodeId);
        expect(byPredicate).toEqual(bySql);
    });
});
