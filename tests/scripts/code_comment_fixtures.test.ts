// Proves the decidable patterns (P1–P5) in tests/code-comments/eval-fixtures.md
// are actually decidable: each sample-wrong block trips its named patterns and
// each sample-right block is clean while KEEPING the machine-precision
// docblocks (the carve-out must not be overshot into "no docblocks ever").
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'code-comments', 'eval-fixtures.md');

// P1: @param with a bare native type (no generics/shape) and nothing beyond
// the parameter name — or with pure restating prose ("The lines.").
const P1_SIGNATURE_MIRROR_PARAM = /@param\s+(?:\??[A-Za-z\\]+)\s+\$\w+(?:\s+The\s+\w+\.?)?\s*$/m;
// P2: bare @return with a native scalar/class type, no generics.
const P2_BARE_RETURN = /@return\s+(?:void|int|string|bool|float)\b(?!\S)/;
// P3: /** @var T */ on a natively-typed property (docblock line directly above
// a typed property declaration).
const P3_REDUNDANT_VAR = /\/\*\*\s*@var\s+[A-Za-z\\]+[^<>\n]*\*\/\s*\n\s*(?:private|protected|public)\s+(?:readonly\s+)?[A-Za-z\\]+\s+\$\w+/;
// P4: line comment that narrates ("loop over", "round the", "increment").
const P4_WHAT_NARRATION = /\/\/\s*(?:loop over|round the|increment|call the)\b/i;
// P5: JSDoc braces-type annotation in TS.
const P5_JSDOC_TYPE = /@(?:param|returns)\s+\{[^}]+\}/;

const CARVEOUT_ARRAY_SHAPE = /@param\s+array<int,\s*OrderLine>\s+\$lines/;
const CARVEOUT_GENERIC_RETURN = /@return\s+Collection<int,\s*Invoice>/;

function extractSample(md: string, fixtureId: string, kind: 'wrong' | 'right'): string {
    const section = md.split(`### ${fixtureId}`)[1];
    if (section === undefined) throw new Error(`fixture section ${fixtureId} not found`);
    const block = section.split(`#### sample-${kind}`)[1];
    if (block === undefined) throw new Error(`sample-${kind} not found in ${fixtureId}`);
    const m = block.match(/```(?:php|ts)\n([\s\S]*?)```/);
    if (m?.[1] === undefined) throw new Error(`fenced sample-${kind} block missing in ${fixtureId}`);
    return m[1];
}

describe('code-comment-discipline fixture decidability', () => {
    const md = fs.readFileSync(FIXTURES, 'utf-8');

    it('ccd-php-class-generation: sample-wrong trips P1–P4', () => {
        const wrong = extractSample(md, 'ccd-php-class-generation', 'wrong');
        expect(wrong).toMatch(P1_SIGNATURE_MIRROR_PARAM);
        expect(wrong).toMatch(P2_BARE_RETURN);
        expect(wrong).toMatch(P3_REDUNDANT_VAR);
        expect(wrong).toMatch(P4_WHAT_NARRATION);
    });

    it('ccd-php-class-generation: sample-right is clean AND keeps carve-out docblocks', () => {
        const right = extractSample(md, 'ccd-php-class-generation', 'right');
        expect(right).not.toMatch(P1_SIGNATURE_MIRROR_PARAM);
        expect(right).not.toMatch(P2_BARE_RETURN);
        expect(right).not.toMatch(P3_REDUNDANT_VAR);
        expect(right).not.toMatch(P4_WHAT_NARRATION);
        expect(right).toMatch(CARVEOUT_ARRAY_SHAPE);
        expect(right).toMatch(CARVEOUT_GENERIC_RETURN);
    });

    it('ccd-ts-module-generation: sample-wrong trips P4 + P5', () => {
        const wrong = extractSample(md, 'ccd-ts-module-generation', 'wrong');
        expect(wrong).toMatch(P5_JSDOC_TYPE);
        expect(wrong).toMatch(P4_WHAT_NARRATION);
    });

    it('ccd-ts-module-generation: sample-right is clean and keeps the why-comment', () => {
        const right = extractSample(md, 'ccd-ts-module-generation', 'right');
        expect(right).not.toMatch(P5_JSDOC_TYPE);
        expect(right).not.toMatch(P4_WHAT_NARRATION);
        expect(right).toMatch(/half-up/);
    });
});
