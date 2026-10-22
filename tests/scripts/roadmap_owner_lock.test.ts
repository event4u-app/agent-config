// road-to-a-tick-the-shipped-path-earns 2.1–2.3: the owner Iron Law of
// ownership_classes.ts reaches the two roadmap lints.
import { describe, expect, it } from 'vitest';

import { checkFile } from '../../src/scripts/lint_decision_classes.js';
import { _scanBoth } from '../../src/scripts/lint_roadmap_blockers.js';

const _scan = (text: string) => _scanBoth(text).ownerClose;

const HEADER = '| ID | ownership | resolved by | decision | evidence | revisit if |';
const SEP = '|---|---|---|---|---|---|';

function decisions(...rows: string[]): string {
    return ['---', 'status: ready', '---', '# x', '', '## Decisions', '', HEADER, SEP, ...rows, ''].join('\n');
}

describe('lint_decision_classes — a locked class is closed by the owner', () => {
    it('refuses a product-owned row resolved by the council', () => {
        const text = decisions('| A9 | product-owned | council:agents/evidence/council/x.md | (a) | y | z |');
        expect(checkFile('x.md', text).some((v) => /locked to the owner/.test(v.reason))).toBe(true);
    });

    it('refuses business-owned and destructive-owned resolved by an agent', () => {
        for (const cls of ['business-owned', 'destructive-owned']) {
            const text = decisions(`| D1 | ${cls} | agent | x | y | z |`);
            expect(checkFile('x.md', text).length).toBeGreaterThan(0);
        }
    });

    it('accepts a locked row resolved by the owner, and a proposed one', () => {
        const text = decisions(
            '| A9 | product-owned | owner | (a), the owner on 2026-10-23 | y | z |',
            '| A10 | product-owned | owner | proposed — council 2/2 recommends (b) | y | z |',
        );
        expect(checkFile('x.md', text)).toEqual([]);
    });

    it('leaves critical-technical with a council resolver alone', () => {
        const text = decisions('| D2 | critical-technical | council:rec | x | y | z |');
        expect(checkFile('x.md', text)).toEqual([]);
    });
});

describe('lint_roadmap_blockers — a resolved class-3 blocker names its owner decision', () => {
    const blocker = (status: string, cls = '') =>
        [
            '## Blockers',
            '',
            '### blocker: free-route-admission',
            `- **Status:** ${status}`,
            '- **Owner:** maintainer',
            ...(cls ? [`- **Class:** ${cls}`] : []),
            '- **Blocks:** step 2.1',
            '- **What to do:** pick (a) or (b).',
            '- **Recommendation:** (a).',
            '- **If you do nothing:** the step stays open.',
            '- **Resolved when:** an owner row exists.',
            '',
        ].join('\n');

    const ownerRow = [
        '## Decisions',
        '',
        HEADER,
        SEP,
        '| A9 | product-owned | owner | Blocker `free-route-admission`: (a), 2026-10-23 | y | z |',
        '',
    ].join('\n');

    it('refuses resolved with no owner decision row', () => {
        const gaps = _scan(blocker('resolved — council 2/2 chose (a)'));
        expect(gaps.some((g) => /owner decision/.test(g.message))).toBe(true);
    });

    it('refuses resolved when the only row naming it has a council resolver', () => {
        const councilRow = ownerRow.replace('| owner |', '| council:x |');
        const gaps = _scan(`${councilRow}\n${blocker('resolved')}`);
        expect(gaps.some((g) => /owner decision/.test(g.message))).toBe(true);
    });

    it('accepts resolved with a dated owner row naming the blocker', () => {
        const gaps = _scan(`${ownerRow}\n${blocker('resolved — the owner chose (a)')}`);
        expect(gaps.filter((g) => /owner decision/.test(g.message))).toEqual([]);
    });

    it('does not apply to a technical class', () => {
        const gaps = _scan(blocker('resolved', '0 — auto-run'));
        expect(gaps.filter((g) => /owner decision/.test(g.message))).toEqual([]);
    });
});
