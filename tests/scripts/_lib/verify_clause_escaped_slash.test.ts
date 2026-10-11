import { describe, expect, it } from 'vitest';

import { parseVerifyClause } from '../../../src/scripts/_lib/verify_clause.js';

/**
 * Step 1.1 of `road-to-svg-review-followups`, review claim C4.
 *
 * The backticked form's slash-delimited tail used to be a lazy
 * `\/.*?\/(?=\s|$)`, which closes at ANY `/` followed by whitespace. A clause
 * whose regex deliberately spells a path separator as `\/` was therefore cut
 * at the escape and parsed to a truncated source — silently, because a shorter
 * regex is still a regex and nothing downstream could tell the difference.
 *
 * The rule is now "the first UNESCAPED closing `/`": one not preceded by an
 * odd number of backslashes.
 */
describe('backticked-form-keeps-an-escaped-slash', () => {
    const sourceOf = (text: string): string | null => {
        const exp = parseVerifyClause(text)?.expect;
        return exp && exp.kind === 'regex' ? exp.source : null;
    };

    it('backticked-form-keeps-an-escaped-slash', () => {
        // The canonical case from the review. Under the old tail this parsed to
        // `a\` — the clause survived and asserted something else.
        expect(sourceOf('verify: `cmd` -> /a\\/ b/')).toBe('a\\/ b');

        // Trailing prose after the clause does not extend the regex, which is
        // the property the lazy form existed to give and must not be lost.
        expect(sourceOf('verify: `cmd` -> /a\\/ b/ and then note the result')).toBe('a\\/ b');

        // A path-shaped pattern, which is the realistic shape of the defect.
        expect(sourceOf('verify: `ls` -> /src\\/scripts\\/_lib/')).toBe('src\\/scripts\\/_lib');
    });

    it('the escape rule does not change any form that already worked', () => {
        expect(sourceOf('verify: `cmd` -> /[1-9]/')).toBe('[1-9]');
        expect(sourceOf('verify: `cmd` -> /[1-9]/ and then note the result')).toBe('[1-9]');
        // An expectation containing a space, which the 2026-10-11 widening added.
        expect(sourceOf('verify: `cmd` -> /Icon-only button/')).toBe('Icon-only button');
        // An UNESCAPED inner slash still ends the literal where it always did,
        // via the non-space fallback branch — so this is not a silent widening.
        expect(sourceOf('verify: `cmd` -> /a/b/')).toBe('a/b');
    });

    it('an escaped backslash before the delimiter still closes the literal', () => {
        // `\\` is a literal backslash, so the `/` after it is UNESCAPED and the
        // literal ends there. The rule is about parity, not about any backslash.
        expect(sourceOf('verify: `cmd` -> /a\\\\/')).toBe('a\\\\');
    });

    it('an exit-code expectation is untouched', () => {
        expect(parseVerifyClause('verify: `cmd` -> 0')?.expect).toEqual({ kind: 'exit', code: 0 });
    });
});
