/**
 * A quoted credential after an assignment keyword is one value, whitespace and
 * all. The row used to capture only the first whitespace-free run, so
 * `password = "Tr0ub4dorXyz9 correct horse"` sent `correct horse` on to the
 * provider (council FIX-BEFORE-RELEASE, finding 39ef3dba582a). Values are built
 * at runtime and never printed.
 */
import { describe, expect, it } from 'vitest';

import { detect, EGRESS_RULES, replaceSpans } from './egress_rules.js';

const ALNUM = 'Qw3Er5Ty7Ui9Op2As4Df6Gh8Jk1Lz3Xc5Vb7Nm9';
const run = (n: number, shift = 0): string => {
    let s = '';
    for (let i = 0; i < n; i += 1) s += ALNUM[(i + shift) % ALNUM.length];
    return s;
};

const generic = (text: string) => detect(text, EGRESS_RULES.filter((r) => r.rule === 'generic-assignment'));
const scrub = (text: string): string => replaceSpans(text, generic(text), () => '<SECRET>');

describe('generic-assignment: a quoted multi-word value is replaced whole', () => {
    for (const q of ['"', "'"]) {
        it(`a secret-shaped first word takes the rest of the ${q}-quoted value with it`, () => {
            const value = `${run(20, 2)} correct horse battery`;
            const out = scrub(`password = ${q}${value}${q}`);
            expect(out).toBe(`password = ${q}<SECRET>${q}`);
        });

        it(`a secret-shaped later word still covers the whole ${q}-quoted value`, () => {
            const value = `correct horse ${run(18, 5)} staple`;
            const out = scrub(`api_key: ${q}${value}${q}`);
            expect(out).toBe(`api_key: ${q}<SECRET>${q}`);
        });
    }

    // Ratification review 2026-10-22 (openai seat): the old row stopped at an
    // inner quote and validated the run before it, so a secret-shaped run glued
    // to a low-entropy tail by the other quote character must still be caught.
    for (const [outer, inner] of [['"', "'"], ["'", '"']] as const) {
        it(`a secret-shaped run before an inner ${inner} in a ${outer}-quoted value is still a secret`, () => {
            const value = `${run(20, 4)}${inner}${'a'.repeat(64)}`;
            const out = scrub(`password = ${outer}${value}${outer}`);
            expect(out).toBe(`password = ${outer}<SECRET>${outer}`);
        });
    }

    it('nothing after the closing quote is taken', () => {
        const out = scrub(`password = "${run(20, 1)} two words" # comment`);
        expect(out).toBe('password = "<SECRET>" # comment');
    });

    it('quoted prose with no secret-shaped word is left alone, as before', () => {
        for (const t of ['password = "just some ordinary words here"', 'secret: "short"', "pwd = 'see the vault'"]) {
            expect(generic(t)).toEqual([]);
        }
    });

    it('a bare value still ends at whitespace, as before', () => {
        const out = scrub(`secret=${run(24, 3)} trailing words`);
        expect(out).toBe('secret=<SECRET> trailing words');
    });
});
