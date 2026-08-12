// Tests for src/scripts/lint_symptom_intake.ts.
//
// Mirrors the sibling roadmap-gate test shape: unit-tests the pure functions
// directly (no filesystem / CLI plumbing). The load-bearing property is
// DISCRIMINATION — a resolved entry and an unresolved one must reach different
// verdicts, and the 30-day boundary must actually bind. A gate that returns
// "clean" for both is indistinguishable from no gate at all, which is the
// false-green class this repository has recorded repeatedly.
import { describe, expect, it } from 'vitest';

import { STALE_AFTER_DAYS, evaluate, isEntry, listMarkdown } from '../../src/scripts/lint_symptom_intake.js';

const NOW = new Date(Date.parse('2026-08-12T00:00:00Z'));

/** An ISO date `days` before NOW. */
function daysAgo(days: number): string {
    const d = new Date(NOW.getTime() - days * 86_400_000);
    return d.toISOString().slice(0, 10);
}

function entry(reported: string, resolution = ''): string {
    return ['---', `reported: ${reported}`, 'reporter: operator', 'host: claude-code', 'symptoms:', '  - it broke', '---', '', '# It broke', '', resolution].join(
        '\n',
    );
}

describe('lint_symptom_intake — evaluate', () => {
    it('a fresh unresolved entry is not a finding', () => {
        expect(evaluate(entry(daysAgo(1)), 'a.md', NOW)).toBeNull();
    });

    it('an entry exactly at the threshold is not yet a finding', () => {
        expect(evaluate(entry(daysAgo(STALE_AFTER_DAYS)), 'a.md', NOW)).toBeNull();
    });

    it('one day past the threshold IS a finding — the boundary binds', () => {
        const finding = evaluate(entry(daysAgo(STALE_AFTER_DAYS + 1)), 'a.md', NOW);
        expect(finding).not.toBeNull();
        expect(finding?.kind).toBe('unresolved');
        expect(finding?.ageDays).toBe(STALE_AFTER_DAYS + 1);
    });

    it('a stale entry with a confirmed: block is resolved', () => {
        const text = entry(daysAgo(400), '## confirmed:\n\n- **Defect:** x — `a.ts:1`');
        expect(evaluate(text, 'a.md', NOW)).toBeNull();
    });

    it('a stale entry with a null: block is resolved — a null is a result', () => {
        const text = entry(daysAgo(400), '## null:\n\n- **Verdict:** not reproducible');
        expect(evaluate(text, 'a.md', NOW)).toBeNull();
    });

    it('a resolution block that is not a heading does not count', () => {
        // Prose mentioning the word must not satisfy the gate — otherwise the
        // check is satisfiable by writing about it instead of doing it.
        const text = entry(daysAgo(400), 'We should probably add a confirmed: block at some point.');
        expect(evaluate(text, 'a.md', NOW)?.kind).toBe('unresolved');
    });

    it('a missing reported date is its own finding, regardless of content', () => {
        const text = ['---', 'reporter: operator', '---', '', '# No date'].join('\n');
        const finding = evaluate(text, 'a.md', NOW);
        expect(finding?.kind).toBe('no-reported-date');
        expect(finding?.ageDays).toBeNull();
    });

    it('an unparseable reported date is treated as missing, not as age zero', () => {
        const text = entry('2026-13-45');
        expect(evaluate(text, 'a.md', NOW)?.kind).toBe('no-reported-date');
    });
});

describe('lint_symptom_intake — isEntry', () => {
    it('report files are entries', () => {
        expect(isEntry('2026-08-12-something.md')).toBe(true);
    });

    it('the convention file and the template are not entries', () => {
        expect(isEntry('README.md')).toBe(false);
        expect(isEntry('_template.md')).toBe(false);
    });

    it('non-markdown is never an entry', () => {
        expect(isEntry('notes.txt')).toBe(false);
    });
});

describe('lint_symptom_intake — listMarkdown', () => {
    it('a directory that does not exist yields nothing rather than throwing', () => {
        expect(listMarkdown('/nonexistent/symptoms/dir')).toEqual([]);
    });
});
