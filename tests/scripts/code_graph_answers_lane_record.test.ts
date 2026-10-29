/**
 * road-to-a-graph-that-wins 4.8 — an answer drawn from a build whose lane threw
 * or declined the tree says that lane's facts are unknown; it never reads as
 * "nothing found". Synthetic rows and lane records only.
 */
import { describe, expect, it } from 'vitest';

import { type AskRow, type AskSource, type Scope, ask } from '../../src/scripts/code_graph/ask.js';
import type { LaneRunRecord } from '../../src/scripts/code_graph/types.js';
import { laneGaps } from '../../src/scripts/code_graph/uncertainty.js';

const scope: Scope = { repoId: 'repo-a', branch: 'main', worktree: '/w/a', user: 'u1' };
const empty: AskSource = { name: 'graph', owner: 'project', intents: ['query', 'affected', 'usage', 'explain', 'path'], rows: (): AskRow[] => [], lookup: () => null };

const lanes: LaneRunRecord[] = [
    { lane: 'code', facts: 120, relations: 300 },
    { lane: 'data', facts: 0, relations: 0, error: 'migrations/2024_x.php: unexpected token' },
    { lane: 'history', facts: 0, relations: 0, skipped_reason: 'shallow clone' },
    { lane: 'systems', facts: 0, relations: 0 },
];

describe('answers read the lane record', () => {
    it('names a failed and a skipped lane as unknown, and leaves a lane that ran and found nothing alone', () => {
        const gaps = laneGaps(lanes);
        expect(gaps).toHaveLength(2);
        expect(gaps[0]).toMatch(/^data lane failed .* unknown, not absent$/);
        expect(gaps[1]).toMatch(/^history lane skipped \(shallow clone\) .* unknown, not absent$/);
        expect(gaps.join('\n')).not.toMatch(/systems|code lane/);
    });

    it('an empty ask answer over a failed data lane is degraded and low confidence, not a bare empty result', () => {
        const r = ask('which tables does the import write', [empty], scope, { lanes });
        expect(r.envelope.answer).toEqual([]);
        expect(r.degraded.some((d) => /data lane failed/.test(d))).toBe(true);
        expect(r.envelope.confidence).toBe('low');
    });

    it('a build whose lanes all ran adds nothing', () => {
        const r = ask('which tables does the import write', [empty], scope, { lanes: [lanes[0]!, lanes[3]!] });
        expect(r.degraded).toEqual([]);
    });
});
