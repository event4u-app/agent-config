import { describe, expect, it } from 'vitest';

import { receiptCoverage, reviewEscapes, type ReviewRow } from '../../src/scripts/probe_depth_shadow.js';

const roadmap = [
    '## Phase 1',
    '- [x] **1.1 One.** Done. <!-- receipt: class=R0 · shadow · would-skip=review · bound=x -->',
    '- [x] **1.2 Two.** Done. <!-- receipt: class=R1 · shadow · would-skip=council · bound=y -->',
    '- [x] **1.3 Three.** Done, no receipt.',
    '- [ ] **1.4 Four.** <!-- receipt: class=R0 · shadow · would-skip=review · bound=z -->',
    '- [x] **1.5 Five.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=w -->',
].join('\n');

describe('probe_depth_shadow', () => {
    it('counts receipts on ticked steps by class, and the ticked steps without one', () => {
        const c = receiptCoverage([roadmap]);
        expect(c.ticked).toBe(4);
        expect(c.byClass).toEqual({ R0: 1, R1: 1, R2: 0, R3: 1 });
        expect(c.missing).toBe(1);
    });

    it('a since-window counts only ticks dated on or after it', () => {
        const dated = ['- [x] **2.1 A.** Done 2026-10-20. <!-- receipt: class=R0 · shadow · would-skip=review · bound=a -->', '- [x] **2.2 B.** Done 2026-10-22.', '- [x] **2.3 C.** Undated.'].join('\n');
        const c = receiptCoverage([dated], '2026-10-21');
        expect(c.ticked).toBe(1);
        expect(c.missing).toBe(1);
    });

    it('a would-have-escape is a high/critical row the class row would not have reviewed', () => {
        const rows: ReviewRow[] = [
            { cls: 'R0', round: 1, sev: 'high' },
            { cls: 'R1', round: 1, sev: 'critical' },
            { cls: 'R1', round: 2, sev: 'high' },
            { cls: 'R1', round: 3, sev: 'low' },
            { cls: 'R2', round: 4, sev: 'critical' },
        ];
        const e = reviewEscapes(rows);
        expect(e.R0).toEqual({ rows: 1, escaped: 1, critical: 0 });
        expect(e.R1).toEqual({ rows: 2, escaped: 1, critical: 0 });
        expect(e.R2).toEqual({ rows: 1, escaped: 0, critical: 0 });
    });
});
