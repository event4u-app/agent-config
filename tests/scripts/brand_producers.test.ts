/**
 * `producer-brand-read` — the four producers ask the resolver (roadmap 6.2).
 *
 * The defect behind this test is D10: `canvas-design`, `logo-generation` and
 * `fe-design` carried no brand reference at all, `html-deck` cited the rule but
 * no resolver, and `brand-asset-generation` loaded a filename the resolver never
 * reads. Each of those produces an asset that looks deliberate and is not.
 *
 * Three properties are asserted per producer, and they are separable on purpose:
 * it names the resolver (so the read happens through one answer), it marks
 * corpus fallback as corpus-sourced (so a gap-fill is never reported as the
 * brand), and it does not reach for a token file by path of its own (the
 * failure the resolver exists to prevent). A skill could satisfy the first and
 * still fail the third, which is why the third is not folded into it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The producers roadmap step 6.2 names. `fe-design` is canvas's, not this set. */
const PRODUCERS = ['canvas-design', 'html-deck', 'logo-generation', 'brand-asset-generation'] as const;

const RESOLVER = /brand:status\s+--json/;
const CORPUS_SOURCED = /corpus-sourced/;

/**
 * A bare `tokens.json` mention is fine — the producers describe what the
 * resolver reports. What is not fine is instructing a load from a path: that is
 * the second answer. Matches `load tokens.json`, `read agents/…/tokens.json`,
 * and the dotted near-miss in any form.
 */
const OWN_PATH_READ = /(?:load|open|read|parse)\s+(?:the\s+)?[`'"]?(?:[\w./-]*\/)?\.?tokens\.json/i;

function body(skill: string): string {
    return readFileSync(join(REPO, 'src', 'skills', skill, 'SKILL.md'), 'utf-8');
}

describe('producer-brand-read', () => {
    for (const skill of PRODUCERS) {
        it(`producer-brand-read: ${skill} asks the resolver before choosing`, () => {
            expect(body(skill)).toMatch(RESOLVER);
        });

        it(`producer-brand-read: ${skill} marks corpus fallback as corpus-sourced`, () => {
            expect(body(skill)).toMatch(CORPUS_SOURCED);
        });

        it(`producer-brand-read: ${skill} does not load a token file by its own path`, () => {
            const offenders = body(skill)
                .split('\n')
                .map((line, i) => [line, i + 1] as const)
                .filter(([line]) => OWN_PATH_READ.test(line))
                .map(([line, n]) => `${skill}:${n}: ${line.trim()}`);
            expect(offenders).toEqual([]);
        });
    }

    it('producer-brand-read: the matcher is sensitive to a producer that stopped asking', () => {
        // Non-vacuity: the assertions above pass only because the text is there.
        expect(RESOLVER.test('pick a palette from the brief')).toBe(false);
        expect(CORPUS_SOURCED.test('derive the palette from the brief')).toBe(false);
        expect(OWN_PATH_READ.test('load tokens.json (colors, typography)')).toBe(true);
        expect(OWN_PATH_READ.test('load the .tokens.json file')).toBe(true);
        expect(OWN_PATH_READ.test('the resolver reports tokens.json as valid')).toBe(false);
    });
});
