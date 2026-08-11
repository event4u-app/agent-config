/**
 * Mechanism tests for `src/scripts/lint_hedge_words.ts`.
 *
 * The gate is advisory by design, so "does it fail the build" is not the
 * property under test — `main` returns 0 on findings on purpose. What must hold
 * is that the scanner reads the right surface: added prose in `src/` and `docs/`
 * markdown, and nothing else. Every carve-out below exists because without it
 * the gate's loudest findings would be its own vocabulary.
 */
import { describe, expect, it } from 'vitest';

import { scanDiff } from '../../src/scripts/lint_hedge_words.js';

/** Build a minimal unified diff whose added lines are `lines`. */
function diff(file: string, lines: string[]): string {
    return [`--- a/${file}`, `+++ b/${file}`, '@@ -0,0 +1 @@', ...lines.map((l) => `+${l}`)].join('\n');
}

describe('lint_hedge_words — scanDiff', () => {
    it('flags a hedge word in added prose', () => {
        const r = scanDiff(diff('src/rules/example.md', ['The gate might fire when the path is absent.']));
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]?.words).toContain('might');
        expect(r.filesScanned).toBe(1);
    });

    it('does not flag a line with no hedge word', () => {
        const r = scanDiff(diff('src/rules/example.md', ['The gate fires when the path is absent.']));
        expect(r.findings).toHaveLength(0);
        expect(r.addedProseLines).toBe(1);
    });

    it('ignores a hedge word that is quoted rather than used', () => {
        const r = scanDiff(
            diff('docs/guidelines/example.md', [
                'Banned in a claim sentence: `might`, `could`, and "perhaps".',
            ]),
        );
        expect(r.findings).toHaveLength(0);
    });

    it('ignores fenced code between markers', () => {
        const r = scanDiff(
            diff('src/skills/example/SKILL.md', [
                'Prose before the fence.',
                '```ts',
                'const maybe = true; // this might be fine',
                '```',
                'Prose after the fence.',
            ]),
        );
        expect(r.findings).toHaveLength(0);
        expect(r.addedProseLines).toBe(2);
    });

    it('ignores indented code and comment lines', () => {
        const r = scanDiff(
            diff('src/skills/example/SKILL.md', [
                '    const x = 1; // possibly',
                '<!-- verify: this could change -->',
                '// it seems fine',
            ]),
        );
        expect(r.findings).toHaveLength(0);
    });

    it('ignores files outside src/ and docs/', () => {
        const r = scanDiff(diff('agents/roadmaps/plan.md', ['This might be the shape.']));
        expect(r.findings).toHaveLength(0);
        expect(r.filesScanned).toBe(0);
    });

    it('ignores non-markdown files under a scanned root', () => {
        const r = scanDiff(diff('src/scripts/thing.ts', ['// this might be the shape']));
        expect(r.findings).toHaveLength(0);
    });

    it('ignores the lexicon files themselves — the list is not hedging', () => {
        const r = scanDiff(diff('src/scripts/lint_hedge_words.ts', ['might, could, perhaps']));
        expect(r.findings).toHaveLength(0);
    });

    it('ignores removed lines', () => {
        const raw = ['--- a/src/rules/example.md', '+++ b/src/rules/example.md', '@@ -1 +1 @@', '-It might fire.', '+It fires.'].join('\n');
        const r = scanDiff(raw);
        expect(r.findings).toHaveLength(0);
    });

    it('counts added words so a rate can be derived', () => {
        const r = scanDiff(diff('src/rules/example.md', ['one two three four five']));
        expect(r.addedWords).toBe(5);
        expect(r.addedProseLines).toBe(1);
    });
});
