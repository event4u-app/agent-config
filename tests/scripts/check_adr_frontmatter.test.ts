import { describe, expect, it } from 'vitest';

import {
    type AdrFinding,
    adr_number,
    check_amendment_links,
    check_amendment_shape,
    check_one,
    check_reopen_authority,
    split_dimensions,
} from '../../src/scripts/check_adr_frontmatter.js';

/**
 * Covers the reopen-authority fields added by road-to-adr-revisit-governance.
 * The pre-existing checks (required fields, status enum, `review_trigger`) had
 * no test file at all — the two smoke cases at the bottom close that gap for
 * the paths this change touches, not for the whole validator.
 */

function fm(body: string): string {
    return `---\n${body}\n---\n\n# ADR\n`;
}

describe('split_dimensions', () => {
    it('reads an inline list', () => {
        expect(split_dimensions('[purpose, security_floor]')).toEqual(['purpose', 'security_floor']);
    });

    it('reads a folded block list, dashes stripped', () => {
        expect(split_dimensions('- purpose - governance')).toEqual(['purpose', 'governance']);
    });

    it('is empty for an empty value', () => {
        expect(split_dimensions('')).toEqual([]);
    });
});

describe('check_reopen_authority', () => {
    it('says nothing when both fields are absent — absent is unclassified, not a finding', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { status: 'accepted' }, findings);
        expect(findings).toEqual([]);
    });

    it('accepts every documented policy value', () => {
        for (const policy of ['directional', 'owner', 'unclassified']) {
            const findings: AdrFinding[] = [];
            check_reopen_authority('x.md', { reopen_policy: policy, protected_dimensions: '[purpose]' }, findings);
            expect(findings.filter((f) => f.level === 'error')).toEqual([]);
        }
    });

    it('errors on an unknown policy — a typo must not silently mis-route authority', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { reopen_policy: 'council' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.level).toBe('error');
        expect(findings[0]?.message).toContain('reopen_policy');
    });

    it('errors on an unknown protected dimension', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { protected_dimensions: '[purpose, velocity]' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.message).toContain('velocity');
    });

    it('warns — never errors — on `owner` with no named reserved interest', () => {
        const findings: AdrFinding[] = [];
        check_reopen_authority('x.md', { reopen_policy: 'owner' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.level).toBe('warn');
    });
});

describe('check_one — the new fields never make an existing ADR fail', () => {
    it('passes a grandfathered ADR that carries neither new field', () => {
        const text = fm(['adr: 1', 'status: accepted', 'date: 2026-05-06', 'decision: something'].join('\n'));
        const errors = check_one('ADR-001-x.md', text).filter((f) => f.level === 'error');
        expect(errors).toEqual([]);
    });

    it('still fails a post-cutoff ADR with no review_trigger — the older gate is intact', () => {
        const text = fm(['adr: 200', 'status: accepted', 'date: 2026-08-01', 'decision: something'].join('\n'));
        const errors = check_one('ADR-200-x.md', text).filter((f) => f.level === 'error');
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toContain('review_trigger');
    });
});

describe('adr_number', () => {
    it('normalises every reference shape to a bare number', () => {
        expect(adr_number('ADR-035')).toBe('35');
        expect(adr_number('035')).toBe('35');
        expect(adr_number('35')).toBe('35');
        expect(adr_number(' 105 (Decision 2 only — the contract stands)')).toBe('105');
    });

    it('is null when nothing resolves', () => {
        expect(adr_number('—')).toBeNull();
        expect(adr_number('none')).toBeNull();
    });
});

describe('check_amendment_shape', () => {
    it('ignores the em-dash placeholder and an absent key', () => {
        const findings: AdrFinding[] = [];
        check_amendment_shape('x.md', { amends: '—' }, findings);
        check_amendment_shape('x.md', {}, findings);
        expect(findings).toEqual([]);
    });

    it('errors when a link value names no ADR number', () => {
        const findings: AdrFinding[] = [];
        check_amendment_shape('x.md', { amended_by: 'the other one' }, findings);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.level).toBe('error');
    });
});

describe('check_amendment_links — the reciprocal half `supersedes` never had', () => {
    const corpus = (rows: Record<string, string>[]) =>
        rows.map((fm, i) => ({ rel: `ADR-${String(i)}.md`, fm }));

    it('passes a bidirectional pair', () => {
        const f = check_amendment_links(
            corpus([
                { adr: '35', amended_by: 'ADR-232' },
                { adr: '232', amends: 'ADR-035' },
            ]),
        );
        expect(f).toEqual([]);
    });

    it('tolerates the annotated form the corpus already uses', () => {
        // ADR-117 carries `amends: 105 (Decision 2 only — …)`; the parenthetical
        // must not defeat the reciprocal match.
        const f = check_amendment_links(
            corpus([
                { adr: '117', amends: '105 (Decision 2 only — the contract itself stands)' },
                { adr: '105', amended_by: 'ADR-117' },
            ]),
        );
        expect(f).toEqual([]);
    });

    it('errors on a one-sided link — invisible from the stale side', () => {
        const f = check_amendment_links(corpus([{ adr: '35', amended_by: 'ADR-232' }, { adr: '232' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.message).toContain('one-sided');
    });

    it('errors when the target does not exist', () => {
        const f = check_amendment_links(corpus([{ adr: '35', amended_by: 'ADR-999' }]));
        expect(f).toHaveLength(1);
        expect(f[0]?.message).toContain('does not exist');
    });

    it('says nothing about a corpus with no amendment links at all', () => {
        expect(check_amendment_links(corpus([{ adr: '1' }, { adr: '2' }]))).toEqual([]);
    });
});
