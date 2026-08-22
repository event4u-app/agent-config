import { describe, expect, it } from 'vitest';

import { lintSweep, recordKey, scanSweep } from '../../src/scripts/lint_adr_sweep_routing.js';

const ROUTING =
    '## Candidate routing\n\n' +
    '| Record | Disposition | Route | Dated follow-up |\n|---|---|---|---|\n' +
    '| ADR-016 | REVIEW-NOW | council | disposition by **2026-10-03** |\n';

function sweep(candidates: string, routing = ROUTING): string {
    return `# fixture\n\n## Tranche dispositions\n\n| ADR | Disposition |\n|---|---|\n${candidates}\n${routing}\n`;
}

describe('lint_adr_sweep_routing — record identity', () => {
    it('normalises the four label shapes the sweep actually uses', () => {
        // Not cosmetic: a literal match would report every row unrouted,
        // because the tranche tables and the anchor table label the same
        // record differently.
        expect(recordKey('208')).toBe('adr/208');
        expect(recordKey('ADR-239')).toBe('adr/239');
        expect(recordKey('ADR-016 installer-architecture')).toBe('adr/16');
        expect(recordKey('docs/adrs/router/0001 three-tier-routing')).toBe('router/1');
    });

    it('strips markdown decoration before reading the identity', () => {
        expect(recordKey('`ADR-016`')).toBe('adr/16');
        expect(recordKey('[ADR-016](ADR-016-x.md)')).toBe('adr/16');
    });

    it('returns null for a cell that names no record', () => {
        expect(recordKey('Record')).toBeNull();
        expect(recordKey('')).toBeNull();
    });
});

describe('lint_adr_sweep_routing — scanning', () => {
    it('counts a candidate once even when its disposition appears twice', () => {
        const s = scanSweep(sweep('| ADR-016 | REVIEW-NOW / REVIEW-NOW |'));
        expect([...s.candidates.keys()]).toEqual(['adr/16']);
    });

    it('does not read the routing table itself as a candidate list', () => {
        // The routing rows repeat the disposition. Counting them would make
        // every artifact self-satisfying.
        const s = scanSweep(sweep('| ADR-016 | REVIEW-NOW |'));
        expect(s.candidates.size).toBe(1);
        expect(s.routed.size).toBe(1);
    });

    it('ignores dispositions inside a fenced block', () => {
        const s = scanSweep(sweep('```\n| ADR-044 | REVIEW-NOW |\n```\n| ADR-016 | REVIEW-NOW |'));
        expect([...s.candidates.keys()]).toEqual(['adr/16']);
    });

    it('treats a terminal disposition as not a candidate', () => {
        const s = scanSweep(sweep('| ADR-016 | REVIEW-NOW |\n| ADR-044 | KEEP |'));
        expect([...s.candidates.keys()]).toEqual(['adr/16']);
    });
});

describe('lint_adr_sweep_routing — verdicts', () => {
    it('accepts a candidate carrying both a route and a date', () => {
        const [v, n] = lintSweep('f.md', sweep('| ADR-016 | REVIEW-NOW |'));
        expect(v).toEqual([]);
        expect(n).toBe(1);
    });

    it('refuses an artifact with candidates and no routing section', () => {
        const [v] = lintSweep('f.md', sweep('| ADR-016 | REVIEW-NOW |', ''));
        expect(v).toHaveLength(1);
        expect(v[0]?.msg).toContain('no `## Candidate routing` section');
    });

    it('refuses a candidate that has no routing row', () => {
        const [v] = lintSweep('f.md', sweep('| ADR-016 | REVIEW-NOW |\n| ADR-044 | REVIEW-NOW |'));
        expect(v.map((x) => x.key)).toEqual(['adr/44']);
    });

    it('refuses a dateless follow-up — the property the step was specified for', () => {
        const routing = ROUTING.replace('disposition by **2026-10-03**', 'disposition soon');
        const [v] = lintSweep('f.md', sweep('| ADR-016 | REVIEW-NOW |', routing));
        expect(v).toHaveLength(1);
        expect(v[0]?.msg).toContain('no YYYY-MM-DD');
    });

    it('refuses an em-dash route cell, which reads as routed and is not', () => {
        const routing = ROUTING.replace('| council |', '| — |');
        const [v] = lintSweep('f.md', sweep('| ADR-016 | REVIEW-NOW |', routing));
        expect(v).toHaveLength(1);
        expect(v[0]?.msg).toContain('empty route cell');
    });

    it('is silent on an artifact with no candidates at all', () => {
        const [v, n] = lintSweep('f.md', sweep('| ADR-016 | KEEP |', ''));
        expect(v).toEqual([]);
        expect(n).toBe(0);
    });
});
