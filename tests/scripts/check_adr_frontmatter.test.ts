import { describe, expect, it } from 'vitest';

import {
    type AdrFinding,
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
