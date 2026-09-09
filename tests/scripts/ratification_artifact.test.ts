import { describe, expect, it } from 'vitest';

import {
    isRatified,
    RATIFICATION_VERDICTS,
    readRatification,
} from '../../src/scripts/_lib/ratification_artifact.js';

/**
 * Fixture G15's reader half, plus the one rejection Phase 5.1 names by hand.
 *
 * Every case below is written as a whole artifact rather than as a field bag:
 * the defect these tests exist to catch is a real file passing the gate, and a
 * field bag would prove the validator against a shape no author writes.
 */

function artifact(overrides: Record<string, string> = {}, providers = ['anthropic', 'openai']): string {
    const fields: Record<string, string> = {
        proposed_by: 'claude/session-a',
        implemented_by: 'claude/session-a',
        reviewed_by: 'openai/gpt-5',
        verdict: 'ratified',
        effective_after: 'merge',
        ...overrides,
    };
    const lines = ['---'];
    for (const [key, value] of Object.entries(fields)) {
        if (value === '') {
            continue;
        }
        lines.push(`${key}: ${value}`);
    }
    lines.push('providers:');
    for (const p of providers) {
        lines.push(`  - ${p}`);
    }
    lines.push('---', '', '# Ratification', '', 'Body.', '');
    return lines.join('\n');
}

describe('readRatification', () => {
    it('accepts a well-formed, provider-diverse, independently reviewed artifact', () => {
        const reading = readRatification(artifact(), 2);
        expect(reading.problems).toEqual([]);
        expect(reading.artifact).not.toBeNull();
        expect(reading.artifact?.providers).toEqual(['anthropic', 'openai']);
        expect(isRatified(reading)).toBe(true);
    });

    // Phase 5.1's named fixture.
    it('rejects an artifact whose proposed_by equals its reviewed_by', () => {
        const reading = readRatification(
            artifact({ proposed_by: 'claude/session-a', reviewed_by: 'claude/session-a' }),
            2,
        );
        expect(reading.artifact).toBeNull();
        expect(reading.problems.map((p) => p.code)).toContain('self-ratified');
    });

    // The same defect wearing the other producer field's name.
    it('rejects an artifact whose implemented_by equals its reviewed_by', () => {
        const reading = readRatification(
            artifact({ implemented_by: 'openai/gpt-5', reviewed_by: 'openai/gpt-5' }),
            2,
        );
        expect(reading.artifact).toBeNull();
        expect(reading.problems.map((p) => p.code)).toContain('self-ratified');
    });

    it('requires provider diversity when two providers are configured', () => {
        const reading = readRatification(artifact({}, ['anthropic']), 2);
        expect(reading.artifact).toBeNull();
        expect(reading.problems.map((p) => p.code)).toContain('diversity-required');
    });

    it('does not require diversity when only one provider is configured', () => {
        const reading = readRatification(artifact({}, ['anthropic']), 1);
        expect(reading.problems.map((p) => p.code)).not.toContain('diversity-required');
        expect(reading.artifact).not.toBeNull();
    });

    it('does not require diversity when the configured count could not be established', () => {
        const reading = readRatification(artifact({}, ['anthropic']), null);
        expect(reading.problems.map((p) => p.code)).not.toContain('diversity-required');
    });

    it('names every missing required field', () => {
        const reading = readRatification(artifact({ proposed_by: '', effective_after: '' }), 2);
        const missing = reading.problems.filter((p) => p.code === 'missing-field');
        expect(missing).toHaveLength(2);
    });

    it('closes the verdict vocabulary', () => {
        const reading = readRatification(artifact({ verdict: 'approved' }), 2);
        expect(reading.problems.map((p) => p.code)).toContain('unknown-verdict');
        expect(RATIFICATION_VERDICTS).not.toContain('approved');
    });

    it('accepts every verdict in the vocabulary and ratifies only one of them', () => {
        for (const verdict of RATIFICATION_VERDICTS) {
            const reading = readRatification(artifact({ verdict }), 2);
            expect(reading.problems).toEqual([]);
            expect(isRatified(reading)).toBe(verdict === 'ratified');
        }
    });

    it('rejects an effective_after that is neither `merge` nor an ISO instant', () => {
        const reading = readRatification(artifact({ effective_after: 'later' }), 2);
        expect(reading.problems.map((p) => p.code)).toContain('bad-effective-after');
    });

    it('accepts an ISO-8601 instant as effective_after', () => {
        const reading = readRatification(artifact({ effective_after: '2026-09-10T08:00:00Z' }), 2);
        expect(reading.problems).toEqual([]);
    });

    it('reads providers written inline as well as as a list', () => {
        const inline = [
            '---',
            'proposed_by: claude/session-a',
            'implemented_by: claude/session-a',
            'reviewed_by: openai/gpt-5',
            'providers: [anthropic, openai]',
            'verdict: ratified',
            'effective_after: merge',
            '---',
            '',
            'Body.',
            '',
        ].join('\n');
        const reading = readRatification(inline, 2);
        expect(reading.problems).toEqual([]);
        expect(reading.artifact?.providers).toEqual(['anthropic', 'openai']);
    });

    it('reports a file with no frontmatter as such rather than as six missing fields', () => {
        const reading = readRatification('# Just a heading\n', 2);
        expect(reading.problems.map((p) => p.code)).toEqual(['no-frontmatter']);
    });
});
