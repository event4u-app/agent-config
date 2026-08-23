/**
 * Step 4.2 of `road-to-review-independence` — the check flags a steered prompt and stays
 * silent on a neutral one, with both fixtures committed.
 *
 * The silent case is the one that matters more. A phrase list is only useful while it is
 * trusted, and a warn that fires on a correctly-written prompt is worse than no warn — so
 * the neutral fixture is a standing false-positive tripwire, not a formality.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    EXPECTATION_PHRASES,
    collectPrompts,
    main,
    scanPromptText,
} from '../../src/scripts/lint_judge_prompt_expectation.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
// The fixture root MIRRORS the real layout (agents/evidence/reviews/<slug>.review-input/)
// rather than flattening it, so \`collectPrompts\` is exercised on the path shape it
// actually walks. Flattening would have meant parameterising the production walker for a
// test's convenience.
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'judge-prompt-expectation');
const FIXTURE_REVIEWS = path.join(FIXTURES, 'agents', 'evidence', 'reviews');

describe('lint_judge_prompt_expectation — the steered fixture', () => {
    it('is flagged, and names the measured phrase', () => {
        const text = `NO-FINDINGS is expected and welcome — this change is small.`;
        const f = scanPromptText('steered.review-input/prompt.md', text);
        expect(f.length).toBeGreaterThan(0);
        expect(f[0]!.phrase.toLowerCase()).toContain('no-findings is expected');
        expect(f[0]!.line).toBe(1);
    });

    it('reports EVERY match, not just the first — a prompt can steer twice', () => {
        const text = ['no findings are expected here', 'and it should be clean anyway'].join('\n');
        const f = scanPromptText('x', text);
        expect(f.length).toBe(2);
        expect(f.map((x) => x.line)).toEqual([1, 2]);
    });
});

describe('lint_judge_prompt_expectation — the neutral fixture', () => {
    it('stays silent on a prompt that states scope and question only', () => {
        const text = [
            'Scope: the files listed in the manifest.',
            'Report every finding you can substantiate, with a file:line and a failure scenario.',
            'If you find nothing, say so.',
        ].join('\n');
        expect(scanPromptText('neutral.review-input/prompt.md', text)).toEqual([]);
    });

    it('does not fire on the word "expected" alone', () => {
        // The narrowest false positive the list could plausibly grow: an ordinary use of
        // "expected" that says nothing about the outcome.
        expect(scanPromptText('x', 'Compare actual output against the expected output.')).toEqual(
            [],
        );
    });
});

describe('lint_judge_prompt_expectation — the committed fixtures', () => {
    it('collects exactly the two fixture prompts', () => {
        const found = collectPrompts(FIXTURES).map((p) => path.relative(FIXTURE_REVIEWS, p));
        expect(found.sort()).toEqual([
            path.join('neutral.review-input', 'prompt.md'),
            path.join('steered.review-input', 'prompt.md'),
        ]);
    });

    it('flags the steered one and not the neutral one, end to end', () => {
        const out: string[] = [];
        const write = process.stdout.write.bind(process.stdout);
        // main() writes to stdout; capture rather than assert on the exit code alone,
        // because the check is WARN-ONLY and always exits 0 — an exit-code assertion
        // would pass with the detector removed.
        (process.stdout.write as unknown) = (chunk: string): boolean => {
            out.push(String(chunk));
            return true;
        };
        let code: number;
        try {
            code = main(['--repo-root', FIXTURES]);
        } finally {
            (process.stdout.write as unknown) = write;
        }
        const text = out.join('');
        expect(code).toBe(0); // warn-only, always
        expect(text).toContain('steered.review-input/prompt.md');
        expect(text).not.toContain('neutral.review-input/prompt.md');
        expect(text).toContain('WARN ONLY');
    });
});

describe('the phrase list is honest about being a phrase list', () => {
    it('is short enough to be trustworthy', () => {
        // A long list of guessed phrases produces false positives, and a warn nobody
        // trusts is worse than no warn. If this needs raising, the list has grown by
        // guessing rather than by observation.
        expect(EXPECTATION_PHRASES.length).toBeLessThanOrEqual(10);
    });
});
