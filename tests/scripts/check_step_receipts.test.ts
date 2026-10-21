import { describe, expect, it } from 'vitest';

import { enforcing, loweredClaimAllowed, main, missingReceipts } from '../../src/scripts/check_step_receipts.js';
import { loadDepthTable, type DepthTable } from '../../src/scripts/step_receipt.js';
import { runInProc } from '../_lib/run_in_process.js';

const RECEIPT = '<!-- receipt: class=R1 · shadow · would-skip=review · bound=fixture -->';

function diff(file: string, removed: readonly string[], added: readonly string[]): string {
    return [
        `diff --git a/${file} b/${file}`,
        `--- a/${file}`,
        `+++ b/${file}`,
        '@@ -1 +1 @@',
        ...removed.map((l) => `-${l}`),
        ...added.map((l) => `+${l}`),
    ].join('\n');
}

describe('check_step_receipts — missingReceipts', () => {
    it('a step ticked in this diff without a receipt is reported', () => {
        const res = missingReceipts(diff('agents/roadmaps/road-x.md', ['- [ ] **1.1 Step.**'], ['- [x] **1.1 Step.** Done.']));
        expect(res).toEqual({ files: 1, missing: [{ file: 'agents/roadmaps/road-x.md', step: '1.1' }], lowered: [] });
    });

    it('a step ticked with its receipt passes', () => {
        const res = missingReceipts(diff('agents/roadmaps/road-x.md', ['- [ ] **1.1 Step.**'], [`- [x] **1.1 Step.** Done. ${RECEIPT}`]));
        expect(res.missing).toEqual([]);
    });

    it('an older tick reworded in this diff is not newly ticked', () => {
        const res = missingReceipts(diff('agents/roadmaps/road-x.md', ['- [x] **0.1 Old.** Done.'], ['- [x] **0.1 Old.** Done, reworded.']));
        expect(res.missing).toEqual([]);
    });

    it('a renamed roadmap keys on its new path and still reads its added ticks', () => {
        const text = diff('agents/roadmaps/archive/road-x.md', ['- [ ] **2.1 Step.**'], ['- [x] **2.1 Step.**']).replace(
            '--- a/agents/roadmaps/archive/road-x.md',
            '--- a/agents/roadmaps/road-x.md',
        );
        expect(missingReceipts(text).missing).toEqual([{ file: 'agents/roadmaps/archive/road-x.md', step: '2.1' }]);
    });

    it('acceptance criteria and indented lines are not steps', () => {
        const res = missingReceipts(diff('agents/roadmaps/road-x.md', ['- [ ] AC-1 — x', '  - [ ] **1.1 nested**'], ['- [x] AC-1 — x', '  - [x] **1.1 nested**']));
        expect(res.missing).toEqual([]);
    });

    it('a deleted roadmap contributes nothing', () => {
        const text = ['diff --git a/agents/roadmaps/road-x.md b/agents/roadmaps/road-x.md', '--- a/agents/roadmaps/road-x.md', '+++ /dev/null', '-- [x] **1.1 Step.**'].join('\n');
        expect(missingReceipts(text)).toEqual({ files: 0, missing: [], lowered: [] });
    });
});

describe('check_step_receipts — a lowered-depth claim is checked against the diff', () => {
    const table = loadDepthTable();
    const active: DepthTable = { ...table, mode: 'active' };

    it('a newly ticked receipt reading active is collected for the check', () => {
        const res = missingReceipts(
            diff('agents/roadmaps/road-x.md', ['- [ ] **1.1 Step.**'], [`- [x] **1.1 Step.** ${RECEIPT.replace('· shadow ·', '· active ·')}`]),
        );
        expect(res.lowered).toEqual([{ file: 'agents/roadmaps/road-x.md', step: '1.1' }]);
    });

    it('stands only when the table is active and the whole diff is safe and of a flip class', () => {
        expect(loweredClaimAllowed(active, ['agents/roadmaps/road-x.md'])).toBe(true);
        expect(loweredClaimAllowed(table, ['agents/roadmaps/road-x.md'])).toBe(false);
        expect(loweredClaimAllowed(active, ['agents/roadmaps/road-x.md', 'src/scripts/x.ts'])).toBe(false);
        expect(loweredClaimAllowed(active, ['agents/roadmaps/road-x.md', 'src/rules/x.md'])).toBe(false);
        expect(loweredClaimAllowed(active, [])).toBe(false);
    });
});

describe('check_step_receipts — when it blocks', () => {
    it('reports in shadow mode and refuses once the depth table is active, or under --enforce', () => {
        expect(enforcing('shadow', [])).toBe(false);
        expect(enforcing('shadow', ['--enforce'])).toBe(true);
        expect(enforcing('active', [])).toBe(true);
    });
});

describe('check_step_receipts — CLI', () => {
    it('the self-test passes against the real binary', () => {
        expect(runInProc(main, ['--self-test']).status).toBe(0);
    }, 120_000);

    it('an unreadable base is exit 2, never a pass', () => {
        expect(runInProc(main, ['--base', 'no-such-ref-xyz']).status).toBe(2);
    });
});
