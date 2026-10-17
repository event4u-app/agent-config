import { describe, expect, it } from 'vitest';

import {
    EXCHANGE_LOOPS,
    ExchangeError,
    auditSynthesis,
    buildExchange,
    crossExamCandidates,
    inventoryGaps,
    relabel,
    settleClaim,
    type Claim,
    type InventoryRow,
} from '../../src/scripts/analysis_exchange.js';

const CLAIMS: Claim[] = [
    { id: 'a1', analyst_id: 'an-1', text: 'The scope resolver ignores nested .git boundaries.' },
    { id: 'b1', analyst_id: 'an-2', text: 'The ledger never counts a retained item as a changed conclusion.' },
    { id: 'c1', analyst_id: 'an-3', text: 'Loop 4 runs even after a plateaued loop 3.' },
];

function row(claim_id: string, verdict: InventoryRow['verdict'], tier: InventoryRow['tier'], position = ''): InventoryRow {
    return { claim_id, verdict, tier, position };
}

const INVENTORIES: Record<string, InventoryRow[]> = {
    'an-1': [row('b1', 'still-true', 'read'), row('c1', 'never-true', 'executed', 'nextLoop returns plateau after loop 3.')],
    'an-2': [row('a1', 'unverifiable', 'inferred', 'No fixture with a submodule was available.'), row('c1', 'still-true', 'claimed')],
    'an-3': [row('a1', 'still-true', 'claimed'), row('b1', 'still-true', 'read')],
};

describe('exchange labels and inventory', () => {
    it('relabels analysts A/B/C in round order', () => {
        expect([...relabel(['an-1', 'an-2', 'an-3']).entries()]).toEqual([
            ['an-1', 'A'],
            ['an-2', 'B'],
            ['an-3', 'C'],
        ]);
    });

    it('names every foreign claim an inventory left unchecked', () => {
        expect(inventoryGaps('an-1', CLAIMS, [row('b1', 'still-true', 'read')])).toEqual(['an-1 did not check c1']);
        expect(inventoryGaps('an-1', CLAIMS, INVENTORIES['an-1'] ?? [])).toEqual([]);
    });
});

describe('facts are settled by the tree, never by majority', () => {
    it('leaves a claim unsettled when only claimed-tier votes oppose it, however many', () => {
        const rows = [row('x', 'never-true', 'claimed'), row('x', 'never-true', 'inferred'), row('x', 'never-true', 'claimed')];
        expect(settleClaim(rows)).toBe('unsettled');
    });

    it('settles on top-tier evidence, and names a top-tier contradiction contested', () => {
        expect(settleClaim([row('x', 'never-true', 'executed'), row('x', 'still-true', 'claimed')])).toBe('never-true');
        expect(settleClaim([row('x', 'still-true', 'read')])).toBe('still-true');
        expect(settleClaim([row('x', 'still-true', 'read'), row('x', 'never-true', 'executed')])).toBe('contested');
    });
});

describe('cross-exam', () => {
    it('turns a refuted claim into a conflicting pair and an unverifiable one into a disputed finding', () => {
        const labels = relabel(['an-1', 'an-2', 'an-3']);
        const cands = crossExamCandidates(CLAIMS, INVENTORIES, labels);
        expect(cands.map((c) => [c.id, c.kind, c.assertedBy, c.disputedBy])).toEqual([
            ['a1', 'disputed-finding', 'A', 'B'],
            ['c1', 'conflicting-pair', 'C', 'A'],
        ]);
    });
});

describe('a fixture exchange', () => {
    const synthesis =
        'Converged roadmap. On a1 we accepted the minority position that nested .git boundaries are ignored, ' +
        'because the resolver test shows the submodule case; c1 is rejected since nextLoop stops on plateau.';

    it('records cross-exam targets verbatim, one disagreement ledger per analyst and a minority audit with zero silent drops', () => {
        const ex = buildExchange({
            analysts: ['an-1', 'an-2', 'an-3'],
            claims: CLAIMS,
            inventories: INVENTORIES,
            maxTargets: 2,
            synthesis,
            minorities: [{ claim_id: 'a1', anchors: ['nested .git'] }],
        });
        expect(ex.targets.map((t) => t.target.id)).toEqual(['c1', 'a1']);
        for (const t of ex.targets) expect(t.prompt).toContain(t.target.claim);
        expect(ex.targets[0]?.prompt).toContain('nextLoop returns plateau after loop 3.');
        expect(Object.keys(ex.ledgers).sort()).toEqual(['an-1', 'an-2', 'an-3']);
        expect(ex.ledgers['an-3']).toEqual([{ claim_id: 'c1', foreign: 'never-true', settled: 'never-true', label: 'A' }]);
        expect(ex.loops).toEqual(EXCHANGE_LOOPS);
        expect(ex.minority_audit.silent_drops).toEqual([]);
    });

    it('names a minority finding the synthesis dropped silently', () => {
        const audit = auditSynthesis('Converged roadmap: c1 is rejected because nextLoop stops.', [
            { claim_id: 'a1', anchors: ['nested .git'] },
        ]);
        expect(audit.silent_drops).toEqual(['a1']);
    });

    it('names a minority finding mentioned without a reasoned disposition', () => {
        const audit = auditSynthesis('We note the nested .git point.', [{ claim_id: 'a1', anchors: ['nested .git'] }]);
        expect(audit.silent_drops).toEqual([]);
        expect(audit.unresolved).toEqual([{ claim_id: 'a1', failures: ['no-disposition'] }]);
    });

    it('refuses an exchange whose inventory skipped a foreign claim', () => {
        expect(() =>
            buildExchange({
                analysts: ['an-1', 'an-2', 'an-3'],
                claims: CLAIMS,
                inventories: { ...INVENTORIES, 'an-1': [row('b1', 'still-true', 'read')] },
                maxTargets: 2,
                synthesis,
                minorities: [],
            }),
        ).toThrow(ExchangeError);
    });
});
