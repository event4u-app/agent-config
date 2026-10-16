import { describe, expect, it } from 'vitest';

import {
    LedgerError,
    appendLoop,
    ledgerSummary,
    nextLoop,
    type Evidence,
    type EvidenceTier,
    type ItemChange,
    type LedgerItem,
    type Lens,
    type LoopRow,
} from '../../src/scripts/analysis_ledger.js';

function ev(tier: EvidenceTier): Evidence {
    return { source_identity: 'S1:src/a.ts', digest: 'sha256:00', method: 'grep', claim: 'supported', tier };
}

function item(id: string, change: ItemChange, tier: EvidenceTier): LedgerItem {
    return { id, change, evidence: [ev(tier)] };
}

function build(rows: Array<[Lens, LedgerItem[]]>): LoopRow[] {
    return rows.reduce<LoopRow[]>((ledger, [lens, items]) => appendLoop(ledger, { lens, items }), []);
}

describe('analysis loop ledger', () => {
    it('marks a loop without top-tier evidence no-external-signal, and it does not count', () => {
        const ledger = build([
            ['coverage', [item('c1', 'added', 'claimed'), item('c2', 'changed', 'inferred')]],
            ['adversary', [item('a1', 'killed', 'read')]],
        ]);
        expect(ledger.map((r) => r.status)).toEqual(['no-external-signal', 'counted']);
        expect(ledgerSummary(ledger)).toBe('Loops: 2 run, 1 counted, 1 no-external-signal');
    });

    it('does not count top-tier evidence that changed no conclusion', () => {
        const ledger = build([['coverage', [item('c1', 'retained', 'executed')]]]);
        expect(ledger[0]?.status).toBe('no-external-signal');
    });

    it('refuses an item without an evidence object', () => {
        expect(() => appendLoop([], { lens: 'coverage', items: [{ id: 'x', change: 'added', evidence: [] }] })).toThrow(
            /carries no evidence object/,
        );
    });

    it('runs the lenses in order and refuses a skipped lens', () => {
        expect(() => appendLoop([], { lens: 'adversary', items: [] })).toThrow(/must run the coverage lens/);
    });

    it('never stops before the three lenses ran, even with no signal', () => {
        let ledger: LoopRow[] = [];
        const lenses: Lens[] = [];
        for (;;) {
            const next = nextLoop(ledger, 5);
            if (next.action === 'stop') break;
            lenses.push(next.lens);
            ledger = appendLoop(ledger, { lens: next.lens, items: [] });
        }
        expect(lenses).toEqual(['coverage', 'adversary', 'overbuild-sequencing']);
        expect(ledger.every((r) => r.status === 'no-external-signal')).toBe(true);
        expect(() => nextLoop([], 2)).toThrow(LedgerError);
    });

    it('stops loop 4 after a plateaued loop 3', () => {
        const ledger = build([
            ['coverage', [item('c1', 'added', 'read')]],
            ['adversary', [item('a1', 'killed', 'executed')]],
            ['overbuild-sequencing', [item('o1', 'changed', 'read')]],
        ]);
        expect(nextLoop(ledger, 5)).toEqual({ action: 'stop', reason: 'plateau' });
    });

    it('runs loop 4 while loop 3 added a top-tier item, and stops at the cap', () => {
        let ledger = build([
            ['coverage', [item('c1', 'added', 'read')]],
            ['adversary', [item('a1', 'killed', 'executed')]],
            ['overbuild-sequencing', [item('o1', 'added', 'executed')]],
        ]);
        expect(nextLoop(ledger, 3)).toEqual({ action: 'stop', reason: 'loop-cap' });
        expect(nextLoop(ledger, 5)).toEqual({ action: 'run', loop: 4, lens: 'coverage' });
        ledger = appendLoop(ledger, { lens: 'coverage', items: [item('c2', 'added', 'read')] });
        ledger = appendLoop(ledger, { lens: 'adversary', items: [item('a2', 'added', 'read')] });
        expect(nextLoop(ledger, 5)).toEqual({ action: 'stop', reason: 'loop-cap' });
        expect(() => appendLoop(ledger, { lens: 'overbuild-sequencing', items: [] })).toThrow(/exceeds the cap/);
    });
});
